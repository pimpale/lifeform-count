# Integrated biomass

Re-runs Bar-On et al. (2018)'s global biomass aggregation with three leaf
estimates replaced by newer work, and assembles a **biome × taxon** matrix that
harmonizes every source onto the WWF/RESOLVE biome scheme.

| Bar-On (2018) leaf | Replaced by | Effect |
| --- | --- | --- |
| Terrestrial arthropods (0.212 Gt C) | **Rosenberg 2023** | → 0.134 Gt C (0.63×) |
| Wild mammals (0.0073 Gt C) | **Greenspoon 2023** | → 0.0091 Gt C (1.24×) |
| Nematodes (0.0196 Gt C) | **van den Hoogen 2019** | → 0.0314 Gt C (1.60×) |

The global total barely moves (≈549 Gt C — it is dominated by plants and
bacteria), but the **animal** breakdown and the spatial (biome) structure change.

## Quickstart

```sh
# 1. Fetch the two external spatial datasets (one manual, one automatic).
#    The IUCN mammal ranges need a free IUCN account; drop the zip in data/dropzone/.
uv run python -m integrated_biomass.bootstrap_data

# 2. Run everything (reproduces sources, validates, writes results/).
uv run python -m integrated_biomass.run
```

The first run lazily reproduces the heavy upstream pieces and **caches** them
(regenerated only if missing):

- **Rosenberg** biome×taxon tables — its Monte-Carlo notebook is re-run once in a
  pinned legacy (pandas 1.5) environment via `repro_rosenberg`.
- **Mammal × biome** range fractions — IUCN ranges intersected with WWF biomes
  via `repro_mammal_biomes`.

## Architecture

```
bootstrap_data.py   fetch IUCN (manual drop-in) + WWF/RESOLVE (auto) datasets
schema.py           normalized long-format rows (everything in grams of carbon)
biomes.py           canonical biomes (14 WWF + Crops + Pasture) + per-source crosswalk
conversions.py      documented unit factors (dry→C, wet→C), traced to each paper

repro_rosenberg.py        run-once cache of Rosenberg's biome×taxon Monte-Carlo
repro_mammal_biomes.py    run-once cache of IUCN×WWF range fractions

adapter_rosenberg.py      terrestrial arthropods  (biome×taxon + site coords)
adapter_vandenhoogen.py   nematodes               (biome×trophic, from Track B)
adapter_greenspoon.py     wild mammals            (land split by biome; marine global)
adapter_baron_soilfauna.py annelids + protists    (biome rows; reads ../custom_baron_soil_fauna)
adapter_baron.py          aggregator: published baseline, global-total recompute,
                          global-only rows for the remaining taxa

run.py              orchestrate: validate → swap → recompute → matrix → results/
```

## Validation

`run.py` checks that recomputing Bar-On's total **with no swaps reproduces the
published 549.3 Gt C** before applying the swaps. Each updated source is also
validated against its own paper:

- Rosenberg soil arthropods reproduce to **221.5 Mt dry** (published ~220).
- van den Hoogen reproduces to **0.0314 Gt C / 4.40×10²⁰ individuals** (Tables 1/S7).
- Greenspoon land+marine sums match its committed result CSVs.

## Canonical biomes & resolution

Everything is harmonized onto the **14 WWF/RESOLVE biomes + Croplands + Pasture**
(per the project decision, Crops/Pasture are kept as separate rows; only
Rosenberg populates them). Sources sit at their native grain:

- **fine** (14-biome): van den Hoogen nematodes, Greenspoon mammals, Bar-On
  annelids + terrestrial protists (`custom_baron_soil_fauna` reconstructions)
- **group** (aggregated): Rosenberg arthropods
- **global** (no biome): marine taxa and all other Bar-On taxa

## Biomass-density models (`model_biomass.py`)

Interpretable, exportable **per-taxon** models of **mass per km²** from four
world properties:

```sh
uv run python -m integrated_biomass.model_biomass --points 4000
```

For each taxon:
`log10(density [tonnes C/km²]) ~ temperature + rainfall + farm_development + urban_development`

- **Max detail — one model per (taxon, sub_taxon)** (~62 models): the five wild
  taxa *and their sub-taxa* (6 arthropod groups, 5 nematode trophic groups, 26
  mammal orders), the anthropogenic taxa *and their individual animals*
  (Humans; Livestock → Cattle/Sheep/Swine/…; Urban commensals →
  Dog/Cat/Mouse/Rats), each taxon-level aggregate, and a **Total**. So farm/urban
  weights are grounded in real biomass — e.g. Cattle `farm` ≈ ×2257, Dog `urban`
  ≈ ×3070 (land-use-defined animals are deterministic, R²≈1).
- **Features** sampled from real rasters: CHELSA temperature & rainfall, the
  Ramankutty cropland/pasture rasters (farm), Natural Earth urban areas (urban).
- **Weights** → `results/biomass_density_model_weights.csv` (long format:
  `taxon, sub_taxon, feature, coefficient, multiplicative_effect, r2`; sub_taxon
  `(all)` is the taxon aggregate). `10**coef` is the multiplicative effect — for
  a binary, the effect of switching the flag on.

**CHELSA sampling is cached.** The sampled feature table is written to
`data/cache/model/points_n{N}_s{seed}.csv`, so CHELSA is read once per
(points, seed) config and every per-taxon fit / re-run reuses it — zero repeat
hits. `--download-chelsa` instead pulls the two rasters local (~3 GB) for
fully-offline arbitrary sampling.

Caveat: wild-taxon response is *per-biome-constant*, so `temperature`/`rainfall`
capture cross-biome gradients rather than within-biome variation, and land-use
effects on *wild* fauna are ignored (only the anthropogenic addition is modeled).

## Known limitations / follow-ups

- **Annelids / terrestrial protists** are biome-resolved via
  `custom_baron_soil_fauna/` (validated to Bar-On's published 0.1985 / 1.6055 Gt C,
  then rescaled per-biome to conserve mass). Their per-biome *shape* is faithful
  but the absolute level is pinned to the published total, since each paper's
  global number is a non-additive geomean of mean/median (and savanna/pasture)
  scenarios.
- ~6% of Greenspoon land-mammal biomass is in species without an IUCN range
  match (taxonomic synonyms); that biomass is reported as an unmatched
  global-only land row rather than being attributed to biomes.

## Outputs (`results/`)

| File | Contents |
| --- | --- |
| `summary.csv` | published vs recomputed vs integrated global totals |
| `validation.csv` | each updated leaf vs the Bar-On value it replaces |
| `global_total_recomputed.csv` | the full kingdom×taxon table after swaps |
| `biome_taxon_matrix.csv` | the long-format biome×taxon rows (all sources) |
| `biome_group_by_taxon_gtc.csv` | biome-resolved pivot (group × taxon, Gt C) |
| `biomass_density_model_weights.csv` | exportable model weights (temp/rainfall/farm/urban → mass/km²) |
| `biomass_density_training_sample.csv` | the sampled training points (features + response) |
