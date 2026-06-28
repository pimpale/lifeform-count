# custom_baron_soil_fauna

Per-biome reconstructions of two Bar-On (2018) terrestrial soil-fauna taxa,
**annelids** and **terrestrial protists**, for the `integrated_biomass`
biome × taxon matrix. These read Bar-On's *data* only — they do **not** modify
the `baron2018_biomass_distribution` repo.

Bar-On publishes only a single global number for each taxon; the biome-level
detail it computes internally is not exported (and, for annelids, the committed
code is broken). These scripts reconstruct the per-biome breakdown and validate
the total against the published value before exporting.

| Script | Output | Validated against |
| --- | --- | --- |
| `reproduce_annelids.py` | `output/annelid_biome_biomass.csv` | 0.1985 Gt C (Bar-On Animals/Annelids) |
| `reproduce_protists.py` | `output/protist_biome_biomass.csv` | 1.6055 Gt C (Bar-On Protists/Terrestrial) |

```sh
uv --project ../integrated_biomass run python reproduce_annelids.py
uv --project ../integrated_biomass run python reproduce_protists.py
```

(The `integrated_biomass` soil-fauna adapter runs these automatically if the
outputs are missing.)

## Why "custom"

- **Annelids.** Bar-On's `annelids.ipynb`/`.py` computes
  `best_estimate = gmean([all_savanna_mean, all_savanna_median, all_pastures_mean,
  all_pastures_median])`, but those four scenario totals are **never defined** in
  the committed code — it would raise `NameError`. We reconstruct the obvious
  intended computation (the "consider only savanna / only pastures" land-use
  scenarios) and confirm it reproduces the published 0.1985 Gt C exactly.

- **Protists.** Reproduced faithfully from the full pipeline (number per gram →
  per m² via soil bulk density + sampling-depth correction → per biome → ×
  per-group carbon content). The only change is reading `bulk_density_data.tif`
  with `rasterio` instead of `gdal`. Validated to 1.6055 Gt C.

## Per-biome vs. published total

Both papers' methods produce the global number via a **geometric mean** of
mean-/median-based (and, for annelids, savanna-/pasture-scenario) totals — which
is non-additive, so per-biome contributions don't sum to it exactly. Each script
therefore builds a per-biome *shape* (geomean of the mean/median densities per
biome, with savanna/pasture taking their base areas so land isn't double-counted)
and **rescales the vector to the validated published total**. The downstream
adapter re-pins it to the exact Bar-On leaf value so the integrated matrix
conserves mass.
