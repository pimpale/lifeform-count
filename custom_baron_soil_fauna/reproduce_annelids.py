"""Reconstruct Bar-On (2018) annelid biomass *per biome* and cache it.

Bar-On's committed annelid notebook/script is broken: the scenario totals
(`all_savanna_mean`, `all_pastures_mean`, ...) used in
`best_estimate = gmean([...])` are never defined. We reconstruct the obvious
intended computation from the variable names + the "consider only savanna /
only pastures" comments, and *validate* that it reproduces the published
0.1985 Gt C before exporting a per-biome breakdown.

Method (faithful to the reconstructed code):
  total_X = sum over the 7 Fierer biomes of density_X[biome] * area[biome]
  scenario "all savanna":  add supp-biome term with savanna area x2, pasture 0
  scenario "all pastures": add supp-biome term with pasture area x2, savanna 0
  best_estimate = geomean(savanna_mean, savanna_median, pasture_mean, pasture_median)

Per-biome export: the matrix needs additive cells, but the published number is a
geomean over mutually-exclusive savanna/pasture *scenarios*. We therefore build a
per-biome *shape* using geomean(mean,median) density x base area (savanna and
pasture each take their base = half the tropical-grassland area, so the area is
not double-counted), then **rescale the whole vector to the validated total** so
it sums exactly to the published 0.1985 Gt C.

This script reads only Bar-On's *data* (the xlsx); it does not modify Bar-On code.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import gmean

BARON = Path(__file__).resolve().parent.parent / "baron2018_biomass_distribution"
AF = BARON / "animals" / "annelids" / "annelid_biomass_data.xlsx"
OUT = Path(__file__).resolve().parent / "output" / "annelid_biome_biomass.csv"

PUBLISHED_GTC = 0.1985  # Bar-On results.xlsx Animals/Annelids


def _gmean2(a: float, b: float) -> float:
    vals = [v for v in (a, b) if v == v and v > 0]
    return float(gmean(vals)) if vals else 0.0


def reproduce() -> pd.DataFrame:
    data = pd.read_excel(AF, "Fierer", skiprows=1)
    data.columns = ["Biome", "avg", "median", "Taxon"]
    area = pd.read_excel(AF, "Biome area", skiprows=1, index_col="Biome")["Area [m^2]"]
    dens = data.groupby("Biome")[["avg", "median"]].sum()
    supp = pd.read_excel(AF, "Supplementary biomes")
    mean_supp = supp.groupby("Biome")["Biomass density [g C m^-2]"].mean()
    median_supp = supp.groupby("Biome")["Biomass density [g C m^-2]"].median()

    # --- Validation: reconstruct Bar-On's gmean-of-4-scenarios total ---
    main_mean = (dens["avg"] * area).sum()
    main_median = (dens["median"] * area).sum()

    def scenario(a_sav: float, a_pas: float) -> tuple[float, float]:
        a = area.copy()
        a["Native tropical savanna"] = a_sav
        a["Tropical pastures"] = a_pas
        return (main_mean + (mean_supp * a).sum(),
                main_median + (median_supp * a).sum())

    sav_m, sav_md = scenario(area["Native tropical savanna"] * 2, 0)
    pas_m, pas_md = scenario(0, area["Tropical pastures"] * 2)
    best = gmean([pas_md, pas_m, sav_m, sav_md])
    rel = best / 1e15 / PUBLISHED_GTC
    assert 0.97 < rel < 1.03, f"annelid reconstruction off: {best/1e15:.4f} vs {PUBLISHED_GTC}"

    # --- Per-biome shape: geomean(mean,median) density x base area ---
    rows = []
    for b in dens.index:
        rows.append((b, area[b] * _gmean2(dens.loc[b, "avg"], dens.loc[b, "median"])))
    for b in ("Crops", "Native tropical savanna", "Tropical pastures"):
        rows.append((b, area[b] * _gmean2(mean_supp.get(b, np.nan), median_supp.get(b, np.nan))))
    df = pd.DataFrame(rows, columns=["Biome", "biomass_gC"])

    # Rescale so the per-biome vector sums to the validated published total.
    df["biomass_gC"] *= (best / df["biomass_gC"].sum())

    print(f"[annelids] reconstructed total {best/1e15:.4f} Gt C "
          f"(published {PUBLISHED_GTC}); per-biome vector rescaled to match")
    return df


def main() -> int:
    df = reproduce()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"[annelids] wrote {len(df)} biome rows -> {OUT}")
    print(df.assign(Gt_C=lambda d: d.biomass_gC / 1e15).round(4).to_string(index=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
