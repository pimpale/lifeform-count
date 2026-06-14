"""Bar-On (2018) adapter: the aggregator.

Provides (a) the published global-biomass table as the validation baseline,
(b) a recompute of the global total after swapping in the updated leaf
estimates (terrestrial arthropods <- Rosenberg, wild mammals <- Greenspoon,
nematodes <- van den Hoogen), reusing Bar-On's own uncertainty propagation, and
(c) schema rows so every Bar-On taxon appears in the biome x taxon matrix —
annelids at biome resolution (soil fauna), the rest as global-only rows.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

from . import biomes, schema
from .repro_rosenberg import REPO_ROOT

SOURCE = "baron2018"
BARON_DIR = REPO_ROOT / "baron2018_biomass_distribution"
RESULTS_XLSX = BARON_DIR / "results.xlsx"
SHEET = "Table1 & Fig1"

# Reuse Bar-On's own confidence-interval propagation.
sys.path.insert(0, str(BARON_DIR / "statistics_helper"))
from CI_helper import CI_sum_prop  # noqa: E402

# Leaf rows replaced by updated sources, and which source supplies each.
SWAP_ROWS = {
    ("Animals", "Terrestrial arthropods"): "rosenberg2023",
    ("Animals", "Wild mammals"): "greenspoon2023",
    ("Animals", "Nematodes"): "vandenhoogen2019",
}


# --------------------------------------------------------------------------
# Reference table + global-total recompute
# --------------------------------------------------------------------------
def reference_table() -> pd.DataFrame:
    """Bar-On's published Table 1 (kingdom x taxon), the validation baseline."""
    return pd.read_excel(RESULTS_XLSX, SHEET, index_col=[0, 1])


def published_global_total() -> float:
    """Bar-On's published global biomass (Gt C); ~550."""
    return float(reference_table()["Biomass [Gt C]"].sum())


def recompute_global_total(swaps: dict[tuple[str, str], dict]) -> dict:
    """Recompute the global total after overriding leaf rows.

    ``swaps`` maps (kingdom, taxon) -> {"best_gtc": float, "uncertainty": float}.
    Returns the new total, the per-kingdom breakdown, and the propagated
    global uncertainty (Bar-On's method: sum kingdoms via CI_sum_prop).
    """
    t = reference_table().copy()
    t = t.drop(index="Total biomass", level=0, errors="ignore")
    for (kingdom, taxon), new in swaps.items():
        if (kingdom, taxon) not in t.index:
            raise KeyError(f"swap row not in Bar-On table: {(kingdom, taxon)}")
        t.loc[(kingdom, taxon), "Biomass [Gt C]"] = new["best_gtc"]
        if new.get("uncertainty") == new.get("uncertainty"):  # not NaN
            t.loc[(kingdom, taxon), "Uncertainty"] = new["uncertainty"]

    total = float(t["Biomass [Gt C]"].sum())

    # Per-kingdom totals and uncertainties (mirrors global_biomass.py).
    kingdoms = t.groupby(level=0)["Biomass [Gt C]"].sum()
    # Kingdom-level uncertainty: propagate each kingdom's taxa that have one.
    k_unc = {}
    for k in kingdoms.index:
        sub = t.loc[k]
        mask = sub["Uncertainty"].notna()
        if mask.any():
            k_unc[k] = CI_sum_prop(
                estimates=sub.loc[mask, "Biomass [Gt C]"].values,
                mul_CIs=sub.loc[mask, "Uncertainty"].values,
            )
    global_unc = CI_sum_prop(
        estimates=np.array([kingdoms[k] for k in k_unc]),
        mul_CIs=np.array([k_unc[k] for k in k_unc]),
    ) if k_unc else float("nan")

    return {
        "total_gtc": total,
        "kingdoms_gtc": kingdoms.to_dict(),
        "global_uncertainty": float(global_unc),
        "table": t,
    }


# --------------------------------------------------------------------------
# Rows for the biome x taxon matrix
# --------------------------------------------------------------------------
def annelid_biome_rows() -> list[dict]:
    """Annelid biomass per biome (Fierer densities x biome area), soil fauna.

    Biomass = sum_taxa(avg density [g C/m^2]) x biome area [m^2]; plus the
    supplementary biomes (Crops / savanna / pasture). Crosswalked to canonical
    biomes; sum approximates Bar-On's annelid total (~0.20 Gt C).
    """
    af = BARON_DIR / "animals" / "annelids" / "annelid_biomass_data.xlsx"
    fierer = pd.read_excel(af, "Fierer", skiprows=1)
    fierer.columns = ["Biome", "avg_density", "median_density", "Taxon"]
    area = pd.read_excel(af, "Biome area", skiprows=1).set_index("Biome")["Area [m^2]"]
    dens = fierer.groupby("Biome")["avg_density"].sum()

    sup = pd.read_excel(af, "Supplementary biomes")
    sup_dens = sup.groupby("Biome")["Biomass density [g C m^-2]"].mean()
    dens = pd.concat([dens, sup_dens])

    rows: list[dict] = []
    for biome_label, d in dens.items():
        if biome_label not in area.index:
            continue
        fine, group = biomes.normalize("baron_annelid", biome_label)
        biomass_gC = float(d) * float(area[biome_label])  # g C/m^2 * m^2
        rows.append(schema.row(
            taxon="Annelids", realm="land", biome=fine, biome_group=group,
            biomass_gC=biomass_gC, source=SOURCE,
            resolution="fine" if fine else "group",
        ))
    return rows


# Taxa provided at biome/group grain by the updated-source adapters; these must
# NOT also be emitted as global-only rows (would double-count).
#
# NOTE: annelids and terrestrial protists *could* be biome-resolved from Bar-On's
# Fierer tables (the "soil fauna only" scope), but a faithful per-biome
# reproduction (savanna/pasture are mutually-exclusive scenarios; Bar-On uses the
# geomean of mean & median densities plus enchytraeid adjustments) is a follow-up.
# `annelid_biome_rows()` is a first approximation and is intentionally NOT wired
# into the matrix yet; annelids/protists stay global-only until validated.
_BIOME_RESOLVED = {
    "Terrestrial arthropods",  # Rosenberg
    "Nematodes",               # van den Hoogen
    "Wild mammals",            # Greenspoon
}


def global_only_rows(swaps: dict[tuple[str, str], dict] | None = None) -> list[dict]:
    """One global (biome=None) row per remaining Bar-On taxon.

    Uses swapped values where a swap is provided (so the matrix totals match the
    recomputed global total). Marine realm is tagged where obvious.
    """
    swaps = swaps or {}
    t = reference_table().drop(index="Total biomass", level=0, errors="ignore")
    rows: list[dict] = []
    for (kingdom, taxon), r in t.iterrows():
        if taxon in _BIOME_RESOLVED:
            continue
        best = float(r["Biomass [Gt C]"])
        if (kingdom, taxon) in swaps:
            best = swaps[(kingdom, taxon)]["best_gtc"]
        realm = "marine" if "Marine" in taxon or taxon in {"Fish", "Cnidarians", "Molluscs"} else "land"
        rows.append(schema.row(
            taxon=f"{kingdom}: {taxon}", realm=realm,
            biome=None, biome_group=None,
            biomass_gC=best * schema.GT_C,
            source=SOURCE, resolution="global",
        ))
    return rows


__all__ = [
    "reference_table", "published_global_total", "recompute_global_total",
    "annelid_biome_rows", "global_only_rows", "SWAP_ROWS", "SOURCE",
]
