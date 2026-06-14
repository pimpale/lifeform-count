"""The normalized long-format schema every source adapter emits into.

One row = one (taxon, sub_taxon, realm, biome) cell of biomass and/or count,
tagged with its source and the resolution at which it is known. Global-only
taxa (no biome structure) emit a single row with ``biome=None`` and
``resolution='global'``.

All biomass is in **grams of carbon** (g C) so sources are directly summable;
adapters are responsible for converting their native units before emitting.
"""

from __future__ import annotations

import pandas as pd

# Long-format columns, in order.
COLUMNS = [
    "taxon",          # canonical taxon, e.g. "Terrestrial arthropods", "Nematodes"
    "sub_taxon",      # finer split where available, else None (e.g. trophic group)
    "realm",          # "land" | "marine"
    "biome",          # fine WWF biome name, or None (group-only / global)
    "biome_group",    # aggregated group, or None (global)
    "biomass_gC",     # best estimate, grams of carbon
    "biomass_gC_low", # lower bound (g C), or NaN
    "biomass_gC_high",# upper bound (g C), or NaN
    "count",          # number of individuals, or NaN
    "source",         # "rosenberg2023" | "greenspoon2023" | "vandenhoogen2019" | "baron2018"
    "resolution",     # "fine" | "group" | "global"
]

GT_C = 1e15   # grams of carbon per Gt C
MT_C = 1e12   # grams of carbon per Mt C


def row(
    *,
    taxon: str,
    realm: str,
    source: str,
    resolution: str,
    biomass_gC: float,
    sub_taxon: str | None = None,
    biome: str | None = None,
    biome_group: str | None = None,
    biomass_gC_low: float = float("nan"),
    biomass_gC_high: float = float("nan"),
    count: float = float("nan"),
) -> dict:
    """Build one schema row as a dict (validated on frame()))."""
    return {
        "taxon": taxon,
        "sub_taxon": sub_taxon,
        "realm": realm,
        "biome": biome,
        "biome_group": biome_group,
        "biomass_gC": biomass_gC,
        "biomass_gC_low": biomass_gC_low,
        "biomass_gC_high": biomass_gC_high,
        "count": count,
        "source": source,
        "resolution": resolution,
    }


def frame(rows: list[dict]) -> pd.DataFrame:
    """Assemble rows into a validated DataFrame with the canonical column order."""
    df = pd.DataFrame(rows)
    missing = set(COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"rows missing columns: {sorted(missing)}")
    bad_res = set(df["resolution"]) - {"fine", "group", "global"}
    if bad_res:
        raise ValueError(f"invalid resolution values: {bad_res}")
    bad_realm = set(df["realm"]) - {"land", "marine"}
    if bad_realm:
        raise ValueError(f"invalid realm values: {bad_realm}")
    return df[COLUMNS]


__all__ = ["COLUMNS", "GT_C", "MT_C", "row", "frame"]
