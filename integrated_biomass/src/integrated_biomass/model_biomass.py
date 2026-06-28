"""Interpretable, exportable per-taxon models of biomass density (mass/km^2).

For each taxon we fit a linear (additive) model

    density [tonnes C / km^2] = b0 + b1*temperature + b2*rainfall
                                   + b3*farm_intensity + b4*urban_intensity

and export the weights to a CSV. Each weight is mass/km^2 per unit feature, so
prediction is a plain dot product. The four features are interpretable world
properties sampled from real rasters at each point:

    temperature        mean annual temperature      [deg C]  (CHELSA bio1)
    rainfall           annual precipitation         [mm]     (CHELSA bio12)
    farm_intensity     cropland + pasture fraction  [0..1]   (Ramankutty rasters)
    urban_intensity    built-up area fraction       [0..1]   (GHS-BUILT-S)

farm_intensity and urban_intensity are *continuous* degrees of land use (not
0/1 flags): the response varies continuously with them -- wild density is a
land-use mixture (nat/cropland/pasture by area fraction) and human/livestock/
commensal density scales with built-up / farm fraction.

Taxa modelled:
  - the five biome-resolved wild taxa (terrestrial arthropods, nematodes, wild
    mammals, annelids, terrestrial protists), each from its biome density
    (land-use aware where the source has cropland/pasture rows, else the natural
    biome density);
  - Humans, Livestock, and Urban commensals (dogs/cats/mice/rats) from the
    Greenspoon human_and_domesticated breakdown, attributed to urban / farm
    land — so the farm and urban weights are grounded in real biomass;
  - Total (all of the above summed per pixel).

CHELSA rasters are downloaded whole to the cache on first use (~3 GB total) and
sampled locally thereafter -- this is far gentler on the CHELSA server than
thousands of small /vsicurl range requests. **The sampled feature table is also
cached** (keyed by point count + seed), so a re-run reuses it without touching
the rasters at all. `--download-chelsa` just prefetches the rasters up front.

Run:  uv run python -m integrated_biomass.model_biomass --points 4000
"""

from __future__ import annotations

import os
import sys
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from . import biomes
from .conversions import MAMMAL_WET_TO_C
from .repro_rosenberg import PROJECT_ROOT, REPO_ROOT, ROSENBERG_DIR
from .bootstrap_data import WWF_DIR

RESULTS = PROJECT_ROOT / "results"
CACHE = PROJECT_ROOT / "data" / "cache" / "model"
WWF_SHP = WWF_DIR / "Ecoregions2017.shp"
CROPLAND_TIF = ROSENBERG_DIR / "data" / "cropland.tif"
PASTURE_TIF = ROSENBERG_DIR / "data" / "pasture.tif"
MATRIX_CSV = RESULTS / "biome_taxon_matrix.csv"
AGG_BIOMES_CSV = ROSENBERG_DIR / "data" / "aggregated biomes data.csv"
HUMAN_DOM_CSV = REPO_ROOT / "greenspoon2023_mammal_biomass" / "results" / "human_and_domesticated.csv"

# CHELSA v2.1 (uint16; value*scale + offset). Sampled remotely unless cached.
CHELSA_BASE = ("https://os.zhdk.cloud.switch.ch/chelsav2/GLOBAL/"
               "climatologies/1981-2010/bio/")
CHELSA = {
    "temperature": (CHELSA_BASE + "CHELSA_bio1_1981-2010_V.2.1.tif", 0.1, -273.15),
    "rainfall": (CHELSA_BASE + "CHELSA_bio12_1981-2010_V.2.1.tif", 0.1, 0.0),
}
NE_URBAN_URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_urban_areas.zip"
# GHS-BUILT-S 2020, 1 km, Mollweide (ESRI:54009). Pixel value = built-up
# surface in m^2 per 1 km^2 cell, so built-up *fraction* = value / 1e6. This is
# the continuous "degree of urbanization", symmetric with the cropland/pasture
# area fractions used for farmland.
GHS_BUILTUP_URL = (
    "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/"
    "GHS_BUILT_S_GLOBE_R2023A/GHS_BUILT_S_E2020_GLOBE_R2023A_54009_1000/V1-0/"
    "GHS_BUILT_S_E2020_GLOBE_R2023A_54009_1000_V1_0.zip"
)
GHS_CELL_M2 = 1e6  # 1 km cell -> m^2 built-up to fraction

EQUAL_AREA = "EPSG:6933"
ICE_FREE_LAND_M2 = 1.3e14   # Bar-On ice-free land area
G_PER_MT = 1e12
FLOOR = 1e-3                  # tonnes C/km^2 floor so log10 is defined

# Greenspoon human_and_domesticated items split by where the biomass lives.
URBAN_HUMAN_SHARE = 0.56
COMMENSAL_ITEMS = ["Dog", "Cat", "Rats", "Mouse", "Rodents, other"]
FARM_ITEMS = ["Cattle", "Buffaloes", "Sheep", "Swine", "Goats", "Horses",
              "Camels", "Asses", "Mules", "Camelids, other", "Rabbits and hares"]

WILD_TAXA = ["Terrestrial arthropods", "Nematodes", "Wild mammals",
             "Annelids", "Protists (terrestrial)"]
# Continuous features: farm_intensity = cropland+pasture areal fraction (0..1);
# urban_intensity = built-up areal fraction (0..1).
FEATURES = ["temperature", "rainfall", "farm_intensity", "urban_intensity"]


# --------------------------------------------------------------------------
# Areas + densities
# --------------------------------------------------------------------------
def group_areas_m2() -> dict[str, float]:
    import geopandas as gpd

    eco = gpd.read_file(WWF_SHP, columns=["BIOME_NUM"])
    eco = eco[eco["BIOME_NUM"].isin(range(1, 15))].copy()
    eco["group"] = eco["BIOME_NUM"].astype(int).map(
        lambda n: biomes.FINE_TO_GROUP[biomes.BIOME_NUM_TO_FINE[n]])
    eco = eco.to_crs(EQUAL_AREA)
    areas = eco.assign(a=eco.geometry.area).groupby("group")["a"].sum().to_dict()
    agg = pd.read_csv(AGG_BIOMES_CSV)
    for grp in ("Croplands", "Pasture"):
        a = agg.loc[agg["aggregated biome 1"] == grp, "area"].sum()
        if a > 0:
            areas[grp] = float(a)
    return areas


ALL = "(all)"


def wild_densities() -> dict[tuple[str, str], dict[str, float]]:
    """Per (wild taxon, sub_taxon) and per (taxon, '(all)'), areal density
    (g C/m^2 == tonnes C/km^2) per biome group, from the integrated matrix."""
    m = pd.read_csv(MATRIX_CSV)
    br = m[m["resolution"] != "global"].copy()
    br["sub_taxon"] = br["sub_taxon"].fillna(ALL)
    areas = group_areas_m2()

    def dens(g):
        gc = g.groupby("biome_group")["biomass_gC"].sum()
        return {grp: float(gc[grp] / areas[grp]) for grp in gc.index if areas.get(grp, 0) > 0}

    out: dict[tuple[str, str], dict[str, float]] = {}
    for (t, s), g in br.groupby(["taxon", "sub_taxon"]):
        out[(t, s)] = dens(g)
    for t, g in br.groupby("taxon"):           # taxon-level aggregate
        out[(t, ALL)] = dens(g)
    return out


def _urban_area_m2() -> float:
    return float(_ensure_urban().to_crs(EQUAL_AREA).geometry.area.sum())


def anthropogenic_densities() -> dict[str, float]:
    """Areal densities (tonnes C/km^2) of human-associated taxa by land use."""
    hd = pd.read_csv(HUMAN_DOM_CSV).set_index("Item")["biomass_Mt"]
    to_gc = lambda mt: mt * G_PER_MT * MAMMAL_WET_TO_C

    human_gc = to_gc(float(hd.get("Human", 0.0)))
    commensal_gc = to_gc(sum(float(hd.get(i, 0.0)) for i in COMMENSAL_ITEMS))
    livestock_gc = to_gc(sum(float(hd.get(i, 0.0)) for i in FARM_ITEMS))

    areas = group_areas_m2()
    farm_area = areas.get("Croplands", 0.0) + areas.get("Pasture", 0.0)
    urban_area = _urban_area_m2()
    rural_area = ICE_FREE_LAND_M2 - urban_area
    return {
        "human_urban": human_gc * URBAN_HUMAN_SHARE / urban_area,
        "human_rural": human_gc * (1 - URBAN_HUMAN_SHARE) / rural_area,
        "commensal_urban": commensal_gc / urban_area,
        "livestock_farm": livestock_gc / farm_area,
    }


# --------------------------------------------------------------------------
# Raster sampling + downloads
# --------------------------------------------------------------------------
def _ensure_urban():
    import geopandas as gpd

    shp = next(CACHE.glob("**/ne_10m_urban_areas.shp"), None)
    if shp is None:
        CACHE.mkdir(parents=True, exist_ok=True)
        zp = CACHE / "ne_urban.zip"
        print("[model] downloading Natural Earth urban areas", file=sys.stderr)
        req = urllib.request.Request(NE_URBAN_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as r, open(zp, "wb") as fh:
            fh.write(r.read())
        with zipfile.ZipFile(zp) as zf:
            zf.extractall(CACHE / "ne_urban")
        shp = next(CACHE.glob("**/ne_10m_urban_areas.shp"))
    return gpd.read_file(shp)


def _ensure_chelsa(var: str) -> str:
    """Return the local CHELSA tif, downloading the whole raster if absent.

    Downloading each file once (~1.5 GB) is the main pathway: it avoids
    hammering the CHELSA server with thousands of small /vsicurl range requests
    during sampling. The download is atomic (via a .part temp file) so an
    interrupted run never leaves a truncated tif that looks cached."""
    dst = CACHE / f"CHELSA_{var}.tif"
    if dst.is_file():
        return str(dst)
    CACHE.mkdir(parents=True, exist_ok=True)
    url = CHELSA[var][0]
    tmp = dst.with_name(dst.name + ".part")
    print(f"[model] downloading {url} -> {dst}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r, open(tmp, "wb") as fh:
        while chunk := r.read(1 << 22):
            fh.write(chunk)
    tmp.replace(dst)
    return str(dst)


def download_chelsa() -> None:
    """Fetch all CHELSA rasters to the cache (~3 GB) for offline sampling."""
    for var in CHELSA:
        _ensure_chelsa(var)


def _ensure_ghs_builtup() -> str:
    """Local GHS-BUILT-S tif (built-up m^2/cell), downloading+unzipping if absent."""
    tif = next(CACHE.glob("**/GHS_BUILT_S_*.tif"), None)
    if tif is not None:
        return str(tif)
    CACHE.mkdir(parents=True, exist_ok=True)
    zp = CACHE / "ghs_builtup.zip"
    print(f"[model] downloading GHS-BUILT-S -> {zp}", file=sys.stderr)
    req = urllib.request.Request(GHS_BUILTUP_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r, open(zp, "wb") as fh:
        while chunk := r.read(1 << 22):
            fh.write(chunk)
    with zipfile.ZipFile(zp) as zf:
        zf.extractall(CACHE / "ghs_builtup")
    return str(next(CACHE.glob("**/GHS_BUILT_S_*.tif")))


def _sample_raster(path_or_url, pts, scale, offset, src_crs_from_raster=False):
    """Sample a raster at (lon, lat) points. If src_crs_from_raster, transform
    the lon/lat coords into the raster's CRS first (e.g. GHS Mollweide)."""
    import rasterio

    os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
    with rasterio.open(path_or_url) as s:
        sample_pts = pts
        if src_crs_from_raster and s.crs is not None and s.crs.to_epsg() != 4326:
            from pyproj import Transformer
            tr = Transformer.from_crs("EPSG:4326", s.crs, always_xy=True)
            sample_pts = [tr.transform(lon, lat) for lon, lat in pts]
        nodata = s.nodata
        out = []
        for v in s.sample(sample_pts):
            x = float(v[0])
            out.append(np.nan if (nodata is not None and x == nodata) else x * scale + offset)
    return np.array(out)


# --------------------------------------------------------------------------
# Sampled points (cached)
# --------------------------------------------------------------------------
def build_points(n_points: int = 4000, seed: int = 0, use_cache: bool = True) -> pd.DataFrame:
    """Sample land points + features, caching so CHELSA is hit once per config."""
    cache_file = CACHE / f"points_v2_n{n_points}_s{seed}.csv"
    if use_cache and cache_file.is_file():
        return pd.read_csv(cache_file)

    import geopandas as gpd
    from shapely.geometry import Point

    rng = np.random.default_rng(seed)
    eco = gpd.read_file(WWF_SHP, columns=["BIOME_NUM"])
    eco = eco[eco["BIOME_NUM"].isin(range(1, 15))].copy()
    eco["group"] = eco["BIOME_NUM"].astype(int).map(
        lambda n: biomes.FINE_TO_GROUP[biomes.BIOME_NUM_TO_FINE[n]])

    pts = []
    while len(pts) < n_points:
        k = (n_points - len(pts)) * 3
        lon = rng.uniform(-180, 180, k)
        lat = np.degrees(np.arcsin(rng.uniform(-1, 1, k)))  # equal-area on sphere
        cand = gpd.GeoDataFrame(geometry=[Point(a, b) for a, b in zip(lon, lat)], crs="EPSG:4326")
        j = gpd.sjoin(cand, eco[["group", "geometry"]], how="inner", predicate="within")
        for _, r in j.iterrows():
            pts.append((r.geometry.x, r.geometry.y, r["group"]))
            if len(pts) >= n_points:
                break
    df = pd.DataFrame(pts, columns=["lon", "lat", "natural_group"])
    coords = list(zip(df["lon"], df["lat"]))

    print(f"[model] sampling land-use rasters at {len(df)} points", file=sys.stderr)
    # Continuous land-use fractions (0..1).
    crop = np.clip(np.nan_to_num(_sample_raster(CROPLAND_TIF, coords, 1.0, 0.0)), 0, 1)
    past = np.clip(np.nan_to_num(_sample_raster(PASTURE_TIF, coords, 1.0, 0.0)), 0, 1)
    df["cropland_frac"] = crop
    df["pasture_frac"] = past
    df["farm_intensity"] = np.clip(crop + past, 0, 1)

    builtup = _sample_raster(_ensure_ghs_builtup(), coords, 1.0 / GHS_CELL_M2, 0.0,
                             src_crs_from_raster=True)
    df["urban_intensity"] = np.clip(np.nan_to_num(builtup), 0, 1)

    for var, (_, scale, offset) in CHELSA.items():
        print(f"[model] sampling CHELSA {var}", file=sys.stderr)
        df[var] = _sample_raster(_ensure_chelsa(var), coords, scale, offset)

    df = df.dropna(subset=["temperature", "rainfall"]).reset_index(drop=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    df.to_csv(cache_file, index=False)
    return df


# --------------------------------------------------------------------------
# Per (taxon, sub_taxon) density columns + fitting
# --------------------------------------------------------------------------
def unit_density_columns(df: pd.DataFrame) -> dict[tuple[str, str], np.ndarray]:
    """Per-pixel density (tonnes C/km^2) for every (taxon, sub_taxon) unit:
    the wild taxa and their sub-taxa, the anthropogenic taxa and their
    individual animals, and a Total."""
    wild = wild_densities()
    hd = pd.read_csv(HUMAN_DOM_CSV).set_index("Item")["biomass_Mt"]
    to_gc = lambda mt: float(mt) * G_PER_MT * MAMMAL_WET_TO_C

    nat = df["natural_group"].values
    crop = df["cropland_frac"].values
    past = df["pasture_frac"].values
    nat_frac = np.clip(1.0 - crop - past, 0.0, 1.0)
    farm_int = df["farm_intensity"].values
    urb_int = df["urban_intensity"].values
    cols: dict[tuple[str, str], np.ndarray] = {}

    # Wild taxa + sub-taxa: continuous land-use mixture per pixel --
    #   density = nat_frac*natural + cropland_frac*Croplands + pasture_frac*Pasture
    # (taxa without cropland/pasture rows fall back to natural, so the mixture
    # collapses to the natural density).
    for key, dmap in wild.items():
        n_d = np.array([dmap.get(g, np.nan) for g in nat])
        c_d = np.array([dmap.get("Croplands", dmap.get(g, np.nan)) for g in nat])
        p_d = np.array([dmap.get("Pasture", dmap.get(g, np.nan)) for g in nat])
        cols[key] = nat_frac * n_d + crop * c_d + past * p_d

    # Anthropogenic densities scale continuously with land-use intensity.
    # Calibrate per-unit-intensity densities so global totals are conserved:
    # total built-up / farm area estimated from the sample (mean fraction * land).
    builtup_area = max(urb_int.mean() * ICE_FREE_LAND_M2, 1.0)
    farm_area = max(farm_int.mean() * ICE_FREE_LAND_M2, 1.0)

    # Humans: distributed in proportion to built-up fraction.
    cols[("Humans", ALL)] = urb_int * (to_gc(hd.get("Human", 0.0)) / builtup_area)

    # Livestock: per animal, in proportion to farm intensity (+ aggregate).
    live_total = 0.0
    for item in FARM_ITEMS:
        d_per = to_gc(hd.get(item, 0.0)) / farm_area
        cols[("Livestock", item)] = farm_int * d_per
        live_total += d_per
    cols[("Livestock", ALL)] = farm_int * live_total

    # Urban commensals: per animal, in proportion to built-up fraction.
    com_total = 0.0
    for item in COMMENSAL_ITEMS:
        d_per = to_gc(hd.get(item, 0.0)) / builtup_area
        cols[("Urban commensals", item)] = urb_int * d_per
        com_total += d_per
    cols[("Urban commensals", ALL)] = urb_int * com_total

    # Total = sum of every taxon-level aggregate.
    tot = np.zeros(len(df))
    for (t, s), arr in cols.items():
        if s == ALL:
            tot = tot + np.nan_to_num(arr)
    cols[("Total", ALL)] = tot
    return cols


def fit_and_export(n_points: int = 4000, seed: int = 0) -> pd.DataFrame:
    from sklearn.linear_model import LinearRegression

    df = build_points(n_points=n_points, seed=seed)
    cols = unit_density_columns(df)
    X = df[FEATURES].to_numpy(float)

    # Linear (additive) model: density [tonnes C/km^2] = intercept + sum(coef*feature).
    # Linear space (not log) because the response scales *proportionally* with the
    # continuous land-use intensities, so a log fit would explode on extrapolation.
    # Each coefficient is therefore mass/km^2 per unit feature (per degC, per mm,
    # and the added mass/km^2 at full farm / full built-up).
    rows = []
    for (taxon, sub), d in cols.items():
        mask = np.isfinite(d)
        if mask.sum() < len(FEATURES) + 1:
            continue
        y = d[mask]
        reg = LinearRegression().fit(X[mask], y)
        r2 = reg.score(X[mask], y)
        for feat, coef in zip(["intercept", *FEATURES], [reg.intercept_, *reg.coef_]):
            rows.append({
                "taxon": taxon, "sub_taxon": sub, "feature": feat,
                "coefficient": coef, "r2": r2,
            })
    weights = pd.DataFrame(rows)

    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / "biomass_density_model_weights.csv"
    weights.to_csv(out, index=False)
    df.to_csv(RESULTS / "biomass_density_training_sample.csv", index=False)

    n_units = weights[["taxon", "sub_taxon"]].drop_duplicates().shape[0]
    print("=" * 74)
    print("PER (TAXON, SUB-TAXON) BIOMASS-DENSITY MODELS  (tonnes C/km^2 = b0 + sum b*feature)")
    print("=" * 74)
    print(f"{len(df)} points | {n_units} models | weights -> {out}\n")
    # Readable summary: taxon-level aggregates only (full sub-taxon detail in CSV).
    agg = weights[weights["sub_taxon"] == ALL]
    wide = agg.pivot(index="taxon", columns="feature", values="coefficient")
    wide = wide[["intercept", *FEATURES]]
    r2map = agg.drop_duplicates("taxon").set_index("taxon")["r2"]
    wide["R2"] = r2map
    pd.options.display.float_format = "{:+.4f}".format
    print("Taxon-level aggregates (sub-taxa in the CSV):")
    print(wide.to_string())
    print(f"\nFull CSV has {n_units} models incl. sub-taxa (arthropod groups, "
          f"nematode\ntrophic groups, mammal orders, individual livestock & "
          f"commensal animals).")
    return weights


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Per-taxon biomass-density models.")
    ap.add_argument("--points", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--download-chelsa", action="store_true",
                    help="prefetch the CHELSA rasters (~3 GB) up front; they are "
                         "downloaded on demand anyway")
    args = ap.parse_args()
    if args.download_chelsa:
        download_chelsa()
    fit_and_export(n_points=args.points, seed=args.seed)
