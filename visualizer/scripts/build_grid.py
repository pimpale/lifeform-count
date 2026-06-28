#!/usr/bin/env python
"""Bake the model's input feature rasters into a compact global grid for the web
visualizer.

The exported model (results/biomass_density_model_weights.csv) predicts, per
taxon,

    log10(density [tonnes C/km^2]) = intercept
        + c_temperature      * temperature        [deg C]
        + c_rainfall         * rainfall           [mm/yr]
        + c_farm_development * farm_development    {0,1}
        + c_urban_development * urban_development  {0,1}

So a *single* global grid of those four features is enough for the browser to
evaluate any taxon on the fly. This script regrids every source raster onto a
common lon/lat grid and writes:

    public/data/meta.json          grid shape + bounds + var layout
    public/data/temperature.f32    float32, NaN over ocean / non-land
    public/data/rainfall.f32       float32
    public/data/farm.u8            uint8  {0,1}
    public/data/urban.u8           uint8  {0,1}
    public/data/biomass_density_model_weights.csv   (copied for the app)

Land domain = where the Ramankutty cropland raster has data (terrestrial, the
domain the densities are defined on). Run:

    uv run --project ../integrated_biomass python scripts/build_grid.py --deg 0.25
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from rasterio import features

HERE = Path(__file__).resolve().parent
VIS_ROOT = HERE.parent
REPO_ROOT = VIS_ROOT.parent
OUT_DIR = VIS_ROOT / "public" / "data"

ROSENBERG = REPO_ROOT / "rosenberg2023_biomass_terrestrial_arthropods"
CROPLAND_TIF = ROSENBERG / "data" / "cropland.tif"
PASTURE_TIF = ROSENBERG / "data" / "pasture.tif"
WEIGHTS_CSV = REPO_ROOT / "integrated_biomass" / "results" / "biomass_density_model_weights.csv"

# Reuse the integrated_biomass cache/download helpers so CHELSA + Natural Earth
# urban areas come from the exact same files the model itself samples.
sys.path.insert(0, str(REPO_ROOT / "integrated_biomass" / "src"))
from integrated_biomass.model_biomass import (  # noqa: E402
    CHELSA, FARM_THRESHOLD, _ensure_chelsa, _ensure_urban,
)

BOUNDS = (-180.0, -90.0, 180.0, 90.0)  # west, south, east, north


def _regrid(src_path, transform, width, height, *, resampling, src_nodata=None):
    """Reproject/aggregate a raster onto the common grid; ocean/nodata -> NaN."""
    dst = np.full((height, width), np.nan, dtype="float32")
    with rasterio.open(src_path) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata if src_nodata is None else src_nodata,
            dst_transform=transform,
            dst_crs="EPSG:4326",
            dst_nodata=np.nan,
            resampling=resampling,
        )
    return dst


def build(deg: float) -> None:
    width = int(round(360.0 / deg))
    height = int(round(180.0 / deg))
    transform = from_bounds(*BOUNDS, width, height)
    print(f"[grid] target {width}x{height} @ {deg} deg", file=sys.stderr)

    # Land use (fractions, 0..1) and the terrestrial land mask it implies.
    print("[grid] regridding cropland / pasture", file=sys.stderr)
    crop = _regrid(CROPLAND_TIF, transform, width, height, resampling=Resampling.average)
    past = _regrid(PASTURE_TIF, transform, width, height, resampling=Resampling.average)
    land = np.isfinite(crop)
    farm = (((np.nan_to_num(crop) > FARM_THRESHOLD) |
             (np.nan_to_num(past) > FARM_THRESHOLD)) & land).astype("uint8")

    # Climate (CHELSA v2.1 uint16; value*scale + offset). Downloaded by the model
    # helper on first use, then read locally.
    temp_path = _ensure_chelsa("temperature")
    rain_path = _ensure_chelsa("rainfall")
    _, t_scale, t_off = CHELSA["temperature"]
    _, r_scale, r_off = CHELSA["rainfall"]
    print("[grid] regridding CHELSA temperature", file=sys.stderr)
    temperature = _regrid(temp_path, transform, width, height,
                          resampling=Resampling.average) * t_scale + t_off
    print("[grid] regridding CHELSA rainfall", file=sys.stderr)
    rainfall = _regrid(rain_path, transform, width, height,
                       resampling=Resampling.average, src_nodata=65535) * r_scale + r_off

    # Restrict climate to the terrestrial domain so the app's land test (finite
    # temperature) matches the densities' domain.
    temperature = np.where(land, temperature, np.nan).astype("float32")
    rainfall = np.where(land, rainfall, np.nan).astype("float32")

    # Urban built-up areas (Natural Earth polygons) rasterized to the grid.
    print("[grid] rasterizing Natural Earth urban areas", file=sys.stderr)
    urban_gdf = _ensure_urban().to_crs("EPSG:4326")
    urban = features.rasterize(
        ((geom, 1) for geom in urban_gdf.geometry if geom is not None),
        out_shape=(height, width), transform=transform, fill=0, dtype="uint8",
    )
    urban = (urban & land).astype("uint8")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    temperature.tofile(OUT_DIR / "temperature.f32")
    rainfall.tofile(OUT_DIR / "rainfall.f32")
    farm.tofile(OUT_DIR / "farm.u8")
    urban.tofile(OUT_DIR / "urban.u8")
    shutil.copyfile(WEIGHTS_CSV, OUT_DIR / WEIGHTS_CSV.name)

    meta = {
        "width": width,
        "height": height,
        "degrees": deg,
        # [west, south, east, north]; row 0 is the northern edge (north-up).
        "bounds": list(BOUNDS),
        "weights_csv": WEIGHTS_CSV.name,
        "vars": {
            "temperature": {"file": "temperature.f32", "dtype": "float32", "units": "degC"},
            "rainfall": {"file": "rainfall.f32", "dtype": "float32", "units": "mm/yr"},
            "farm_development": {"file": "farm.u8", "dtype": "uint8", "units": "0/1"},
            "urban_development": {"file": "urban.u8", "dtype": "uint8", "units": "0/1"},
        },
    }
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, indent=2))

    n_land = int(land.sum())
    print(f"[grid] wrote {OUT_DIR} | land cells: {n_land} "
          f"({100*n_land/(width*height):.1f}%) | farm: {int(farm.sum())} "
          f"urban: {int(urban.sum())}", file=sys.stderr)
    print(f"[grid]   temperature {np.nanmin(temperature):.1f}..{np.nanmax(temperature):.1f} C | "
          f"rainfall {np.nanmin(rainfall):.0f}..{np.nanmax(rainfall):.0f} mm", file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Bake model feature rasters into a web grid.")
    ap.add_argument("--deg", type=float, default=0.25,
                    help="grid cell size in degrees (default 0.25 -> 1440x720)")
    build(ap.parse_args().deg)
