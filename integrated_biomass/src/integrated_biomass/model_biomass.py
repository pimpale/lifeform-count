"""Interpretable, exportable per-taxon models of biomass density (mass/km^2).

For each taxon we fit

    log10(density [tonnes C / km^2]) ~ temperature + rainfall + farm + urban

and export the weights to a CSV. The four features are interpretable world
properties sampled from real rasters at each point:

    temperature        mean annual temperature  [deg C]   (CHELSA bio1)
    rainfall           annual precipitation     [mm]      (CHELSA bio12)
    farm_development   cropland or pasture?     {0, 1}    (Ramankutty rasters)
    urban_development  built-up area?           {0, 1}    (Natural Earth)

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

EQUAL_AREA = "EPSG:6933"
ICE_FREE_LAND_M2 = 1.3e14   # Bar-On ice-free land area (rural-human denominator)
G_PER_MT = 1e12
FARM_THRESHOLD = 0.5
FLOOR = 1e-3                  # tonnes C/km^2 floor so log10 is defined

# Greenspoon human_and_domesticated items split by where the biomass lives.
URBAN_HUMAN_SHARE = 0.56
COMMENSAL_ITEMS = ["Dog", "Cat", "Rats", "Mouse", "Rodents, other"]
FARM_ITEMS = ["Cattle", "Buffaloes", "Sheep", "Swine", "Goats", "Horses",
              "Camels", "Asses", "Mules", "Camelids, other", "Rabbits and hares"]

WILD_TAXA = ["Terrestrial arthropods", "Nematodes", "Wild mammals",
             "Annelids", "Protists (terrestrial)"]
FEATURES = ["temperature", "rainfall", "farm_development", "urban_development"]


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


def _sample_raster(path_or_url, pts, scale, offset):
    import rasterio

    os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
    with rasterio.open(path_or_url) as s:
        nodata = s.nodata
        out = []
        for v in s.sample(pts):
            x = float(v[0])
            out.append(np.nan if (nodata is not None and x == nodata) else x * scale + offset)
    return np.array(out)


# --------------------------------------------------------------------------
# Sampled points (cached)
# --------------------------------------------------------------------------
def build_points(n_points: int = 4000, seed: int = 0, use_cache: bool = True) -> pd.DataFrame:
    """Sample land points + features, caching so CHELSA is hit once per config."""
    cache_file = CACHE / f"points_n{n_points}_s{seed}.csv"
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
    crop = np.nan_to_num(_sample_raster(CROPLAND_TIF, coords, 1.0, 0.0))
    past = np.nan_to_num(_sample_raster(PASTURE_TIF, coords, 1.0, 0.0))
    df["farm_development"] = ((crop > FARM_THRESHOLD) | (past > FARM_THRESHOLD)).astype(int)
    eff = df["natural_group"].copy()
    eff[crop > FARM_THRESHOLD] = "Croplands"
    eff[(past > FARM_THRESHOLD) & (past >= crop)] = "Pasture"
    df["effective_group"] = eff

    urban = _ensure_urban().to_crs("EPSG:4326")
    gpts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(df["lon"], df["lat"]), crs="EPSG:4326")
    inurb = gpd.sjoin(gpts, urban[["geometry"]], how="left", predicate="within")
    df["urban_development"] = (~inurb.groupby(level=0)["index_right"].first().isna()).astype(int).values

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
    areas = group_areas_m2()
    urban_area = _urban_area_m2()
    farm_area = areas.get("Croplands", 0.0) + areas.get("Pasture", 0.0)
    rural_area = ICE_FREE_LAND_M2 - urban_area
    hd = pd.read_csv(HUMAN_DOM_CSV).set_index("Item")["biomass_Mt"]
    to_gc = lambda mt: float(mt) * G_PER_MT * MAMMAL_WET_TO_C

    eff = df["effective_group"].values
    nat = df["natural_group"].values
    urb = df["urban_development"].values
    farm = df["farm_development"].values
    cols: dict[tuple[str, str], np.ndarray] = {}

    # Wild taxa + sub-taxa (land-use aware: fall back to natural biome density).
    for key, dmap in wild.items():
        cols[key] = np.array([dmap.get(e, dmap.get(n, np.nan)) for e, n in zip(eff, nat)])

    # Humans (present everywhere; concentrated in urban).
    hu = to_gc(hd.get("Human", 0.0))
    cols[("Humans", ALL)] = np.where(urb == 1, hu * URBAN_HUMAN_SHARE / urban_area,
                                     hu * (1 - URBAN_HUMAN_SHARE) / rural_area)

    # Livestock: per animal on farmland (+ aggregate).
    live_total = 0.0
    for item in FARM_ITEMS:
        d = to_gc(hd.get(item, 0.0)) / farm_area
        cols[("Livestock", item)] = np.where(farm == 1, d, FLOOR)
        live_total += d
    cols[("Livestock", ALL)] = np.where(farm == 1, live_total, FLOOR)

    # Urban commensals: per animal in urban areas (+ aggregate).
    com_total = 0.0
    for item in COMMENSAL_ITEMS:
        d = to_gc(hd.get(item, 0.0)) / urban_area
        cols[("Urban commensals", item)] = np.where(urb == 1, d, FLOOR)
        com_total += d
    cols[("Urban commensals", ALL)] = np.where(urb == 1, com_total, FLOOR)

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

    rows = []
    for (taxon, sub), d in cols.items():
        mask = np.isfinite(d)
        if mask.sum() < len(FEATURES) + 1:
            continue
        y = np.log10(np.maximum(d[mask], FLOOR))
        reg = LinearRegression().fit(X[mask], y)
        r2 = reg.score(X[mask], y)
        for feat, coef in zip(["intercept", *FEATURES], [reg.intercept_, *reg.coef_]):
            rows.append({
                "taxon": taxon, "sub_taxon": sub, "feature": feat,
                "coefficient": coef, "multiplicative_effect": 10 ** coef, "r2": r2,
            })
    weights = pd.DataFrame(rows)

    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / "biomass_density_model_weights.csv"
    weights.to_csv(out, index=False)
    df.to_csv(RESULTS / "biomass_density_training_sample.csv", index=False)

    n_units = weights[["taxon", "sub_taxon"]].drop_duplicates().shape[0]
    print("=" * 74)
    print("PER (TAXON, SUB-TAXON) BIOMASS-DENSITY MODELS  (log10 tonnes C/km^2 ~ features)")
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
