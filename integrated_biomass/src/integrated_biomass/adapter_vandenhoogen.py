"""van den Hoogen (2019) adapter: soil nematode biomass & count per biome.

Reads the committed Track B reproduction outputs (Table S7 = biomass per biome
x trophic group in Mt C; Table 1 = global totals incl. individuals). These are
already in carbon mass and already on the WWF biome scheme, so this is a
near-drop-in: biomass needs no conversion and biomes crosswalk 1:1.

Per-biome counts are not exported by Track B, but within a trophic group van
den Hoogen's biomass is exactly linear in count (biomass = count x mean_mass x
cperw, mean_mass constant per group), so per-biome count is recovered exactly
as count_total[g] * biomass[b,g] / sum_b biomass[b,g].

This source *replaces* Bar-On's older Fierer-based nematode estimate.
"""

from __future__ import annotations

import pandas as pd

from . import biomes, schema
from .repro_rosenberg import REPO_ROOT

SOURCE = "vandenhoogen2019"
TAXON = "Nematodes"

TRACKB = REPO_ROOT / "vandenhoogen2019_crowther_lab_nematodes" / "Track_B_reproduction" / "output"
TABLE_S7 = TRACKB / "TableS7_biomass.csv"
TABLE_1 = TRACKB / "Table1_carbon_budget.csv"

TROPHIC_GROUPS = ["Bacterivores", "Fungivores", "Herbivores", "Omnivores", "Predators"]


def _require_outputs() -> None:
    if TABLE_S7.is_file() and TABLE_1.is_file():
        return
    raise FileNotFoundError(
        "van den Hoogen Track B outputs not found:\n"
        f"  {TABLE_S7}\n  {TABLE_1}\n"
        "Reproduce them by running (see the repo README quickstart):\n"
        "  R_LIBS_USER=~/R/libs Rscript "
        "vandenhoogen2019_crowther_lab_nematodes/Track_B_reproduction/biomass_carbon.R"
    )


def biome_taxon_rows() -> list[dict]:
    """Emit schema rows: biomass (g C) and count per (trophic group, biome)."""
    _require_outputs()
    s7 = pd.read_csv(TABLE_S7)
    s7 = s7[s7["Biome"] != "Total"].copy()

    t1 = pd.read_csv(TABLE_1).set_index("Trophic group")
    count_total = t1["Computed individuals"].astype(float)  # per trophic group
    # biomass total per trophic group (for exact count apportionment)
    biomass_total = {g: s7[g].sum() for g in TROPHIC_GROUPS}

    rows: list[dict] = []
    for _, r in s7.iterrows():
        fine, group = biomes.normalize("vandenhoogen", r["Biome"])
        for g in TROPHIC_GROUPS:
            bm_mtc = float(r[g])
            share = bm_mtc / biomass_total[g] if biomass_total[g] else 0.0
            rows.append(schema.row(
                taxon=TAXON, sub_taxon=g, realm="land",
                biome=fine, biome_group=group,
                biomass_gC=bm_mtc * schema.MT_C,
                count=count_total[g] * share,
                source=SOURCE, resolution="fine",
            ))
    return rows


def global_total_gtc() -> dict:
    """Global nematode totals for the Bar-On leaf swap (Gt C and count).

    Bar-On carried no uncertainty for nematodes, so none is asserted here.
    """
    _require_outputs()
    t1 = pd.read_csv(TABLE_1).set_index("Trophic group")
    total_mtc = float(t1.loc["Total", "Biomass (Mt C)"])
    total_count = float(t1.loc["Total", "Computed individuals"])
    return {
        "best_gtc": total_mtc * schema.MT_C / schema.GT_C,  # Mt C -> Gt C
        "low_gtc": float("nan"),
        "high_gtc": float("nan"),
        "uncertainty": float("nan"),
        "count": total_count,
    }


__all__ = ["biome_taxon_rows", "global_total_gtc", "SOURCE", "TAXON"]
