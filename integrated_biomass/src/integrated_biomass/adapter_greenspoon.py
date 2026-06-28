"""Greenspoon (2023) adapter: wild mammal biomass & count, land split by biome.

Land mammals: per-species wet biomass (and population) are distributed across
WWF biomes using the IUCN x WWF range fractions from ``repro_mammal_biomes``.
Species not matched to an IUCN range (taxonomic synonyms, ~6% of biomass) fall
back to a single global-only land row. Marine mammals are global-only (not
attributable to terrestrial biomes).

Wet weight -> carbon uses Bar-On's mammal factor (0.15).
"""

from __future__ import annotations

import math

import pandas as pd

from . import biomes, schema
from .conversions import MAMMAL_WET_TO_C
from .repro_mammal_biomes import load_fractions
from .repro_rosenberg import REPO_ROOT

SOURCE = "greenspoon2023"
TAXON = "Wild mammals"

GDIR = REPO_ROOT / "greenspoon2023_mammal_biomass" / "results"
LAND = GDIR / "wild_land_mammal_biomass.csv"
LAND_POP = GDIR / "wild_land_mammal_biomass_inluding_populations.csv"
MARINE = GDIR / "wild_marine_biomass.csv"

G_PER_MT = 1e12


_ORDER_FILES = [
    "data/species_to_infer_w_ranges.csv",
    "data/species_w_pop_reports_w_ranges.csv",
]


def _order_map() -> dict[str, str]:
    """binomial -> taxonomic order (title-cased), for sub-taxon detail."""
    gdir = REPO_ROOT / "greenspoon2023_mammal_biomass"
    frames = []
    for f in _ORDER_FILES:
        d = pd.read_csv(gdir / f)
        if "Order" in d.columns:
            frames.append(d[["binomial", "Order"]])
    m = pd.concat(frames).dropna().drop_duplicates("binomial")
    return {b: str(o).title() for b, o in zip(m["binomial"], m["Order"])}


def _land_species() -> pd.DataFrame:
    land = pd.read_csv(LAND)[["binomial", "biomass_g", "lower", "upper"]]
    pop = pd.read_csv(LAND_POP)[["binomial", "estimated_population"]]
    df = land.merge(pop, on="binomial", how="left")
    for c in ("biomass_g", "lower", "upper"):
        df[c] = df[c] * MAMMAL_WET_TO_C  # wet g -> g C
    df["order"] = df["binomial"].map(_order_map()).fillna("Other")
    return df


def biome_taxon_rows() -> list[dict]:
    """Emit land mammal rows per biome (+ unmatched/global), and marine global."""
    land = _land_species()
    frac = load_fractions()  # binomial, biome, fraction

    matched = frac.merge(land, on="binomial", how="inner")
    matched["gc_b"] = matched["biomass_g"] * matched["fraction"]
    matched["low_b"] = matched["lower"] * matched["fraction"]
    matched["high_b"] = matched["upper"] * matched["fraction"]
    matched["pop_b"] = matched["estimated_population"] * matched["fraction"]

    rows: list[dict] = []
    # Max detail: split land mammals by biome x taxonomic order.
    for (fine, order), g in matched.groupby(["biome", "order"]):
        rows.append(schema.row(
            taxon=TAXON, sub_taxon=order, realm="land",
            biome=fine, biome_group=biomes.FINE_TO_GROUP[fine],
            biomass_gC=float(g["gc_b"].sum()),
            biomass_gC_low=float(g["low_b"].sum()),
            biomass_gC_high=float(g["high_b"].sum()),
            count=float(g["pop_b"].sum()),
            source=SOURCE, resolution="fine",
        ))

    # Unmatched land species (no IUCN range) -> global-only land row.
    unmatched = land[~land["binomial"].isin(set(frac["binomial"]))]
    if len(unmatched):
        rows.append(schema.row(
            taxon=TAXON, sub_taxon="land (unmatched range)", realm="land",
            biome=None, biome_group=None,
            biomass_gC=float(unmatched["biomass_g"].sum()),
            biomass_gC_low=float(unmatched["lower"].sum()),
            biomass_gC_high=float(unmatched["upper"].sum()),
            count=float(unmatched["estimated_population"].sum()),
            source=SOURCE, resolution="global",
        ))

    # Marine mammals -> global-only.
    marine = pd.read_csv(MARINE)
    marine_gc = marine["biomass_Mt"].sum() * G_PER_MT * MAMMAL_WET_TO_C
    rows.append(schema.row(
        taxon=TAXON, sub_taxon="marine", realm="marine",
        biome=None, biome_group=None,
        biomass_gC=float(marine_gc), source=SOURCE, resolution="global",
    ))
    return rows


def global_total_gtc() -> dict:
    """Global wild-mammal totals (land + marine) for the Bar-On leaf swap."""
    land = _land_species()
    marine = pd.read_csv(MARINE)
    land_gc = land["biomass_g"].sum()
    land_low = land["lower"].sum()
    land_high = land["upper"].sum()
    marine_gc = marine["biomass_Mt"].sum() * G_PER_MT * MAMMAL_WET_TO_C
    best = (land_gc + marine_gc) / schema.GT_C
    # Approximate land CI -> multiplicative factor; marine treated as point.
    low = (land_low + marine_gc) / schema.GT_C
    high = (land_high + marine_gc) / schema.GT_C
    mult = math.sqrt(high / low) if low > 0 else float("nan")
    return {"best_gtc": best, "low_gtc": low, "high_gtc": high, "uncertainty": mult}


__all__ = ["biome_taxon_rows", "global_total_gtc", "SOURCE", "TAXON"]
