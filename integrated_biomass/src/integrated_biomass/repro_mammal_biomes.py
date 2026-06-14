"""Compute, and cache, each wild land-mammal species' range fraction per biome.

This is the spatial step that is *not* reproducible from the Greenspoon repo
(it ships no geometry). We intersect IUCN terrestrial mammal range polygons
(``sci_name``) with WWF/RESOLVE biomes and area-weight, giving, for each
species, the fraction of its extant-native-resident range falling in each
canonical fine biome. The Greenspoon adapter then splits per-species biomass
across biomes by these fractions.

Heavy (a polygon overlay over thousands of ranges), so the result is cached to
``data/cache/mammals/species_biome_fraction.csv`` and regenerated only if
missing. Requires the datasets fetched by ``bootstrap_data``.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from . import biomes
from .bootstrap_data import IUCN_DIR, WWF_DIR
from .repro_rosenberg import PROJECT_ROOT, REPO_ROOT

CACHE_DIR = PROJECT_ROOT / "data" / "cache" / "mammals"
CACHE_FILE = CACHE_DIR / "species_biome_fraction.csv"
RANGES_CACHE = CACHE_DIR / "ranges_equalarea.gpkg"  # filtered, dissolved ranges

IUCN_SHP = IUCN_DIR / "MAMMALS_TERRESTRIAL_ONLY.shp"
WWF_SHP = WWF_DIR / "Ecoregions2017.shp"
GREENSPOON_LAND = (
    REPO_ROOT / "greenspoon2023_mammal_biomass" / "results" / "wild_land_mammal_biomass.csv"
)

# World Cylindrical Equal Area — area-true, for fraction-of-range computation.
EQUAL_AREA = "EPSG:6933"
# IUCN range filters: extant (1) or probably extant (2); native (1) or
# reintroduced (2); resident (1) or breeding (2). Drops introduced/vagrant/etc.
RANGE_WHERE = "presence IN (1,2) AND origin IN (1,2) AND seasonal IN (1,2)"


def _load_biomes():
    import geopandas as gpd

    g = gpd.read_file(WWF_SHP, columns=["BIOME_NUM", "BIOME_NAME"])
    g = g[g["BIOME_NUM"].isin(range(1, 15))].copy()
    g["fine"] = g["BIOME_NUM"].astype(int).map(biomes.BIOME_NUM_TO_FINE)
    g = g.dissolve(by="fine", as_index=False)[["fine", "geometry"]]
    g = g.to_crs(EQUAL_AREA)
    g["geometry"] = g.geometry.buffer(0)  # repair invalid rings before overlay
    return g


def _load_ranges(species: set[str]):
    """Load filtered, dissolved, equal-area species ranges (cached to GPKG).

    Reading the 1.26 GB IUCN shapefile is the slow part, so the result is cached;
    later runs read the small GeoPackage instead.
    """
    import geopandas as gpd

    if RANGES_CACHE.is_file():
        return gpd.read_file(RANGES_CACHE)

    print("[mammals] reading IUCN shapefile (1.26 GB, slow)...", flush=True)
    # NOTE: OGR SQL `where` is unreliable in this GDAL build (returns 0 rows),
    # so we read the filter columns and apply the range filter in pandas.
    g = gpd.read_file(
        IUCN_SHP, columns=["sci_name", "presence", "origin", "seasonal"]
    )
    g = g[
        g["sci_name"].isin(species)
        & g["presence"].isin([1, 2])
        & g["origin"].isin([1, 2])
        & g["seasonal"].isin([1, 2])
    ].copy()
    print(f"[mammals] {len(g)} range polygons after filter; reprojecting + dissolving",
          flush=True)
    g = g.to_crs(EQUAL_AREA)
    g["geometry"] = g.geometry.buffer(0)
    g = g[["sci_name", "geometry"]].dissolve(by="sci_name", as_index=False)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    g.to_file(RANGES_CACHE, driver="GPKG")
    return g


def compute(force: bool = False) -> Path:
    """Compute and cache species->biome range fractions; return cache path."""
    if CACHE_FILE.is_file() and not force:
        return CACHE_FILE
    import geopandas as gpd

    for p in (IUCN_SHP, WWF_SHP):
        if not p.is_file():
            raise FileNotFoundError(
                f"Missing {p}. Run: python -m integrated_biomass.bootstrap_data"
            )

    species = set(pd.read_csv(GREENSPOON_LAND)["binomial"])
    print(f"[mammals] {len(species)} Greenspoon species; loading WWF biomes",
          flush=True)
    biome_g = _load_biomes()
    ranges = _load_ranges(species)
    ranges = ranges[~ranges.geometry.is_empty & ranges.geometry.notna()].reset_index(drop=True)
    print(f"[mammals] {len(ranges)} species ranges; intersecting against "
          f"{len(biome_g)} biomes", flush=True)

    # Per-biome vectorized intersection area (robust; avoids overlay's
    # keep_geom_type pitfalls). Sindex-accelerated bbox prefilter per biome.
    records: list[tuple[str, str, float]] = []
    sindex = ranges.sindex
    for _, brow in biome_g.iterrows():
        cand = list(sindex.query(brow.geometry, predicate="intersects"))
        if not cand:
            continue
        sub = ranges.iloc[cand]
        inter_area = sub.geometry.intersection(brow.geometry).area
        for sci, a in zip(sub["sci_name"].values, inter_area.values):
            if a > 0:
                records.append((sci, brow["fine"], float(a)))
        print(f"  [{brow['fine'][:28]:28s}] {len(cand):5d} candidates", flush=True)

    inter = pd.DataFrame(records, columns=["binomial", "biome", "area"])
    tot = inter.groupby("binomial")["area"].transform("sum")
    inter["fraction"] = inter["area"] / tot
    out = inter[["binomial", "biome", "fraction"]].query("fraction > 0").reset_index(drop=True)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out.to_csv(CACHE_FILE, index=False)
    print(f"[mammals] cached {len(out)} (species, biome) fractions for "
          f"{out['binomial'].nunique()} species -> {CACHE_FILE}", flush=True)
    return CACHE_FILE


def load_fractions(force: bool = False) -> pd.DataFrame:
    """Return the species->biome fraction table, computing it if absent."""
    compute(force=force)
    return pd.read_csv(CACHE_FILE)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Compute/cache mammal range x biome fractions.")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    path = compute(force=args.force)
    df = pd.read_csv(path)
    print("cached", len(df), "rows for", df["binomial"].nunique(), "species ->", path)
