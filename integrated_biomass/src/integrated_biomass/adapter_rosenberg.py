"""Rosenberg (2023) adapter: terrestrial arthropod biomass & count per biome.

Reads the cached biome x taxon tables (reproduced from Rosenberg's Monte-Carlo
notebook by ``repro_rosenberg``; regenerated on demand if absent) and emits
normalized schema rows. Also exposes ``sites()`` — per-site coordinates and
biomass density — to feed the climate model.

Rosenberg reports *dry* biomass (Mt); we convert to grams of carbon with the
Bar-On terrestrial-arthropod factor (carbon = 50% of dry weight). Rosenberg is
group-grain on biomes, so emitted rows carry ``biome=None`` and a
``biome_group``.
"""

from __future__ import annotations

import math
import re

import pandas as pd

from . import biomes, schema
from .conversions import ARTHROPOD_DRY_TO_C
from .repro_rosenberg import CACHE_DIR, ROSENBERG_DIR, ensure_tables

SOURCE = "rosenberg2023"
TAXON = "Terrestrial arthropods"
MT_TO_G = 1e12  # grams per megatonne

RAW_DATA = ROSENBERG_DIR / "data" / "RawData.xlsx"


# --------------------------------------------------------------------------
# Biome x taxon rows
# --------------------------------------------------------------------------
def _mass_to_gc(total_mt_dry: float) -> float:
    return total_mt_dry * MT_TO_G * ARTHROPOD_DRY_TO_C


def biome_taxon_rows() -> list[dict]:
    """Emit schema rows: biomass (g C) and count per (sub_taxon, biome_group)."""
    ensure_tables()
    rows: list[dict] = []

    # --- Soil: taxon x biome ---
    mass = pd.read_csv(CACHE_DIR / "soil_biome_taxon_mass_Mt.csv")
    pop = pd.read_csv(CACHE_DIR / "soil_biome_taxon_pop.csv")
    pop_key = pop.set_index(["aggregated taxon", "aggregated biome"])["Total"]
    for _, r in mass.iterrows():
        taxon, biome_label = r["aggregated taxon"], r["aggregated biome"]
        _, group = biomes.normalize("rosenberg", biome_label)
        count = pop_key.get((taxon, biome_label), float("nan"))
        rows.append(schema.row(
            taxon=TAXON, sub_taxon=f"{taxon} (soil)", realm="land",
            biome=None, biome_group=group,
            biomass_gC=_mass_to_gc(r["Total"]),
            biomass_gC_low=_mass_to_gc(r["Total_low"]),
            biomass_gC_high=_mass_to_gc(r["Total_high"]),
            count=count, source=SOURCE, resolution="group",
        ))

    # --- Above-ground: biome only (taxon = "Combined") ---
    a_mass = pd.read_csv(CACHE_DIR / "aboveground_biome_mass_Mt.csv")
    a_pop = pd.read_csv(CACHE_DIR / "aboveground_biome_pop.csv")
    a_pop_key = a_pop.set_index("aggregated biome")["Total"]
    for _, r in a_mass.iterrows():
        biome_label = r["aggregated biome"]
        _, group = biomes.normalize("rosenberg", biome_label)
        rows.append(schema.row(
            taxon=TAXON, sub_taxon="Combined (above-ground)", realm="land",
            biome=None, biome_group=group,
            biomass_gC=_mass_to_gc(r["Total"]),
            biomass_gC_low=_mass_to_gc(r["Total_low"]),
            biomass_gC_high=_mass_to_gc(r["Total_high"]),
            count=a_pop_key.get(biome_label, float("nan")),
            source=SOURCE, resolution="group",
        ))
    return rows


def global_total_gtc() -> dict:
    """Global terrestrial-arthropod totals for the Bar-On leaf swap.

    Returns best/low/high in Gt C plus a multiplicative 95% uncertainty factor
    (geometric: sqrt(high/low)), matching Bar-On's 'Uncertainty' column.
    """
    df = schema.frame(biome_taxon_rows())
    best = df["biomass_gC"].sum() / schema.GT_C
    low = df["biomass_gC_low"].sum() / schema.GT_C
    high = df["biomass_gC_high"].sum() / schema.GT_C
    mult = math.sqrt(high / low) if low > 0 else float("nan")
    return {"best_gtc": best, "low_gtc": low, "high_gtc": high, "uncertainty": mult}


# --------------------------------------------------------------------------
# Site-level view for the climate model
# --------------------------------------------------------------------------
_DMS = re.compile(
    r"""(?P<deg>\d+(?:\.\d+)?)\s*[°d]\s*
        (?:(?P<min>\d+(?:\.\d+)?)\s*['′′]\s*)?
        (?:(?P<sec>\d+(?:\.\d+)?)\s*(?:''|["″″])\s*)?
        \s*(?P<hemi>[NSEW])""",
    re.VERBOSE,
)


def _parse_coords(text: str) -> tuple[float, float] | None:
    """Parse a 'lat, lon' DMS string into decimal (lat, lon); None if unparseable."""
    if not isinstance(text, str):
        return None
    found = list(_DMS.finditer(text))
    lat = lon = None
    for m in found:
        deg = float(m["deg"])
        deg += float(m["min"]) / 60 if m["min"] else 0.0
        deg += float(m["sec"]) / 3600 if m["sec"] else 0.0
        hemi = m["hemi"]
        if hemi in "NS":
            lat = -deg if hemi == "S" else deg
        else:
            lon = -deg if hemi == "W" else deg
    if lat is None or lon is None:
        return None
    return lat, lon


def sites() -> pd.DataFrame:
    """Per-site mass-density observations with decimal coords, for modeling.

    Mirrors Rosenberg's own filtering (drops 'Microarthropods' except soil
    Acari/Collembola, and the 'Shrubland/Grassland' ants). Returns one row per
    (site, taxon) mass measurement with columns:
    site, taxon, aggregated_taxon, aggregated_biome, biome_group, lat, lon,
    mass_density_mg_m2, environment.
    """
    raw = pd.read_excel(RAW_DATA)
    raw["studied group"] = raw["studied group"].str.strip()
    valid = raw[
        (raw["studied group"] != "Microarthropods")
        | (
            (raw["studied group"] == "Microarthropods")
            & (raw["sub-class"].isin(["Acari", "Collembola"]))
            & (raw["aggregated environment"] == "soil/litter")
        )
    ]
    valid = valid[valid["aggregated biome"] != "Shrubland/Grassland"]

    # Mass measurements only (mg/m^2), wet or dry; tag and keep the value.
    mass = valid[valid["units"].astype(str).str.startswith("mg")].copy()
    coords = mass["coordinates"].fillna(mass["synthetic coordinates"]).map(_parse_coords)
    mass["lat"] = [c[0] if c else float("nan") for c in coords]
    mass["lon"] = [c[1] if c else float("nan") for c in coords]
    mass["biome_group"] = mass["aggregated biome"].map(
        lambda b: biomes.normalize("rosenberg", b)[1]
        if b in biomes.ROSENBERG_TO_GROUP else None
    )
    out = pd.DataFrame({
        "site": mass["site"].values,
        "taxon": mass["taxon"].values,
        "aggregated_biome": mass["aggregated biome"].values,
        "biome_group": mass["biome_group"].values,
        "lat": mass["lat"].values,
        "lon": mass["lon"].values,
        "mass_density_mg_m2": mass["numerical value"].values,
        "environment": mass["aggregated environment"].values,
    })
    return out.dropna(subset=["lat", "lon"]).reset_index(drop=True)


__all__ = ["biome_taxon_rows", "global_total_gtc", "sites", "SOURCE", "TAXON"]
