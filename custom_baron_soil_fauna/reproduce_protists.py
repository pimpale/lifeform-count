"""Reproduce Bar-On (2018) terrestrial protist biomass *per biome* and cache it.

Faithfully re-runs Bar-On's terrestrial-protist computation reading only its
*data* (no Bar-On code is modified). The one substitution is reading the soil
bulk-density raster with `rasterio` instead of `gdal` (same array, same mean).

Flow (mirrors terrestrial_protists.ipynb):
  number per gram by habitat (gmean & mean across studies, with the paper's
  missing-value fills) -> number per m^2 (x bulk density x sampling depth /
  depth-fraction) -> number per biome (x biome area) -> x per-group carbon
  content (incl. Finlay & Fenchel cell-volume estimate) -> biomass.

The global scalars (bulk density, sampling depth, depth fraction) are constant
across biomes, so the per-biome *shape* is robust; we still reproduce them to
*validate* the absolute total against the published 1.605 Gt C, then rescale the
per-biome vector to that total so the matrix conserves mass.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import gmean

BARON = Path(__file__).resolve().parent.parent / "baron2018_biomass_distribution"
PDIR = BARON / "protists" / "terrestrial_protists"
XLSX = PDIR / "terrestrial_protist_data.xlsx"
TIF = PDIR / "bulk_density_data.tif"
OUT = Path(__file__).resolve().parent / "output" / "protist_biome_biomass.csv"

sys.path.insert(0, str(BARON / "statistics_helper"))
from fraction_helper import frac_mean  # noqa: E402

PUBLISHED_GTC = 1.6055  # Bar-On results.xlsx Protists/Terrestrial

NUM_COLS = [
    "Number of ciliates [# g^-1]", "Number of naked amoebae [# g^-1]",
    "Number of testate amoebae [# g^-1]", "Number of flagellates [# g^-1]",
]
CC_COLS = [
    "Carbon content of ciliates [g C cell^-1]",
    "Carbon content of naked amoebae [g C cell^-1]",
    "Carbon content of testate amoebae [g C cell^-1]",
    "Carbon content of flagellates [g C cell^-1]",
]


def _gmean_row(df, cols):
    return pd.DataFrame({c: gmean(df[c].dropna()) for c in cols}, index=[0])


def _mean_row(df, cols):
    return pd.DataFrame({c: np.nanmean(df[c].dropna()) for c in cols}, index=[0])


def reproduce() -> pd.DataFrame:
    data = pd.read_excel(XLSX, "Density of Individuals")

    g = data.groupby(["Habitat", "DOI"]).apply(lambda d: _gmean_row(d, NUM_COLS))
    m = data.groupby(["Habitat", "DOI"]).apply(lambda d: _mean_row(d, NUM_COLS))
    hg = g.groupby("Habitat").apply(lambda d: _gmean_row(d, NUM_COLS))
    hm = m.groupby("Habitat").apply(lambda d: _mean_row(d, NUM_COLS))
    hg.set_index(hg.index.droplevel(1), inplace=True)
    hm.set_index(hm.index.droplevel(1), inplace=True)

    # Missing-value fills (cell 8 of the notebook).
    for h in (hm, hg):
        h.loc["Boreal Forest", [NUM_COLS[0], NUM_COLS[3], NUM_COLS[1]]] = \
            h.loc["Temperate Forest", [NUM_COLS[0], NUM_COLS[3], NUM_COLS[1]]]
        h.loc[["Shrubland", "Tropical Forest", "Tundra", "Woodland"], NUM_COLS[1]] = \
            h.loc["General", NUM_COLS[1]]
        h.loc[["Desert", "Grassland", "Shrubland", "Tropical Forest", "Woodland"], NUM_COLS[3]] = \
            h.loc["General", NUM_COLS[3]]
        h.loc["Tropical Forest", NUM_COLS[0]] = h.loc["Temperate Forest", NUM_COLS[0]]
    hg.loc["Tundra", NUM_COLS[0]] = gmean(hm[NUM_COLS[0]].dropna())
    hm.loc["Tundra", NUM_COLS[0]] = hm[NUM_COLS[0]].dropna().mean()

    # Soil bulk density (rasterio in place of gdal) and depth correction.
    import rasterio

    with rasterio.open(TIF) as src:
        arr = src.read(1).astype(float)
    arr[arr == arr[0, 1]] = np.nan
    bulk_density = np.nanmean(arr) * 1000  # g m^-3

    sampling_depth = data.groupby("DOI").mean(numeric_only=True).mean()["Sampling Depth [cm]"]
    jackson = 1 - 0.966 ** sampling_depth
    fierer = 1 - (-0.132 * np.log(sampling_depth) + 0.605)
    depth_frac = frac_mean(np.array([jackson, fierer]))

    factor = bulk_density * sampling_depth / 100 / depth_frac
    hg_m2, hm_m2 = hg * factor, hm * factor
    for h in (hg_m2, hm_m2):
        h.loc["Tropical Savanna"] = gmean(
            h.loc[["Tropical Forest", "Woodland", "Shrubland", "Grassland"]]
        ) if h is hg_m2 else h.loc[
            ["Tropical Forest", "Woodland", "Shrubland", "Grassland"]].mean(axis=0)

    area = pd.read_excel(XLSX, "Biome area", skiprows=1, index_col=0)["Area [m^2]"]
    tot_g = hg_m2.mul(area, axis=0).dropna()
    tot_m = hm_m2.mul(area, axis=0).dropna()

    # Per-group carbon content (cc data + Finlay & Fenchel cell-volume estimate).
    cc = pd.read_excel(XLSX, "Carbon content")
    ff = pd.read_excel(XLSX, "Finlay & Fenchel", skiprows=1)
    lengths = ff.groupby("Protist type").apply(
        lambda d: np.average(d["Length [µm]"], weights=d["Abundance [# g^-1]"]))
    ff_cc = 0.6 * lengths ** 2.36 * 150e-15
    cc.loc[cc.index[-1] + 1] = pd.Series({
        "DOI": "Finlay & Fenchel",
        CC_COLS[0]: ff_cc.loc["Ciliate"], CC_COLS[1]: ff_cc.loc["Naked amoebae"],
        CC_COLS[2]: ff_cc.loc["Testate amoebae"], CC_COLS[3]: ff_cc.loc["Flagellate"],
    })
    study_cc = cc.groupby("DOI").apply(lambda d: _gmean_row(d, CC_COLS))
    mean_cc = _gmean_row(study_cc.reset_index(), CC_COLS).iloc[0]
    cc_by_group = mean_cc.values  # aligned to NUM_COLS order (ciliate, naked, testate, flag)

    # Validation: absolute total = total number per group x carbon content.
    tot_num_protist = np.array([
        gmean([tot_m[c].sum(), tot_g[c].sum()]) for c in NUM_COLS])
    best = float((tot_num_protist * cc_by_group).sum())
    rel = best / 1e15 / PUBLISHED_GTC
    assert 0.9 < rel < 1.1, f"protist reconstruction off: {best/1e15:.4f} vs {PUBLISHED_GTC}"

    # Per-biome biomass: per cell geomean(mean,gmean) number x carbon content.
    rows = []
    for biome in tot_g.index:
        per_group = [gmean([tot_m.loc[biome, c], tot_g.loc[biome, c]]) for c in NUM_COLS]
        biomass = float(np.sum(np.array(per_group) * cc_by_group))
        count = float(np.sum(per_group))
        rows.append((biome, biomass, count))
    df = pd.DataFrame(rows, columns=["Biome", "biomass_gC", "count"])
    df["biomass_gC"] *= (best / df["biomass_gC"].sum())  # rescale to validated total

    print(f"[protists] reconstructed total {best/1e15:.4f} Gt C "
          f"(published {PUBLISHED_GTC}); per-biome vector rescaled to match")
    return df


def main() -> int:
    df = reproduce()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"[protists] wrote {len(df)} biome rows -> {OUT}")
    print(df.assign(Gt_C=lambda d: d.biomass_gC / 1e15).round(4).to_string(index=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
