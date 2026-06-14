# This repository contains the code used for the analyses in the paper "Soil nematode abundance and functional group composition at a global scale"

Paper reference: Van den Hoogen and Geisen et al., 2019, Soil nematode abundance and functional group composition at a global scale, Nature, doi: 10.1038/s41586-019-1418-6.

The data can be downloaded [here](https://doi.org/10.3929/ethz-b-000354035) and [here](https://doi.org/10.3929/ethz-b-000354394).

### The code is organized as follows:
- The folder titled "Nematode_Geospatial" contains code for:
    - Aggregating the raw data by composite pixels (scripts titled Nematode_Sample_Composite_for_Aggregation.js and ETH_Nematode_Aggregate_By_Location.ipynb)
    - Sampling the aggregating pixel locations to retrieve the covariate values and create a "regression matrix" for modelling (script titled Nematode_Sample_Points_for_ClustOfVar.js)
    - Formatting the output data for grid searching and modeling (script titled ChangeCSVColumnNamesBeforeShapefile.ipynb)
    - Grid searching / modeling and model assessment (scripts titled Nematode_Grid_Search_Full.js, Nematode_Grid_Search_Results_Full_Model_Run.ipynb, Nematode_CrossValidate_Ensemble.js, and Nematode_Ensembled_CV_Results.ipynb)
	- Creating the final ensembled maps (scripts titled Nematode_Final_Map_Creation_1.js and Nematode_Final_Map_Creation_2.js)
	- Computing the global abundance values (script titled Nematode_Global_Abundance_Calculations.js)
	- Performing assessment of pixel value variation via bootstrapping (script title Nematode_Biome_BootStrap_StdDev.js)
	- Creating predicted versus observed plots for the final maps (script titled Nematode_Predicted_Vs_Observed_Plots.ipynb)
    
- The folder titled "Nematode_Observations" contains code and data for creating most of the figures of the paper. All maps are output from GEE scripts (see "Nematode_Geospatial")
    - All raw data
    - RMarkdown notebooks for figures and carbon calculations
    - Supplementary Tables 1-8

---

## Reproducing the non-geospatial analyses (Track B)

The R analyses in `Nematode_Observations/` (biomass/carbon calculations and the
non-map figures) can be reproduced locally from the data already in this
repository. The geospatial mapping pipeline in `Nematode_Geospatial/` is **not**
covered here — those scripts run on Google Earth Engine and, as noted in
`Nematode_Geospatial/README.md`, error on current GEE.

The `Track_B_reproduction/` folder contains path-corrected, runnable versions of
the two RMarkdown notebooks (`RMD_biomass_carbon_20190621.Rmd` and
`nematode_notebook_20190621.Rmd`). The originals contain hardcoded
`setwd("~/Work/ETH/...")` paths, a filename mismatch
(`Family Ecophysiology qParameters.csv` vs. the repo's
`Family_Ecophysiology_qParameters.csv`), and deprecated dplyr `funs()` syntax;
these are fixed in the scripts here.

### Installation

Requires **R** (tested with 4.6.0) and a Fortran compiler (needed only to build
the `vegan` package for the NMDS).

```sh
# System prerequisites (Arch Linux example; adjust for your distro)
sudo pacman -S r gcc-fortran pandoc

# Install the R packages into a personal library
mkdir -p ~/R/libs
R_LIBS_USER=~/R/libs Rscript -e '
  .libPaths("~/R/libs")
  options(repos = c(CRAN = "https://cloud.r-project.org"))
  install.packages(c(
    "tidyverse", "reshape2", "corrplot", "cowplot", "RColorBrewer",
    "cluster", "scales", "lemon", "plotrix", "maps", "vegan"
  ))'
```

### Quickstart

Run both scripts from the repository root:

```sh
# Biomass & carbon budget -> prints Table 1 / S5 / S7, writes CSVs to output/
R_LIBS_USER=~/R/libs Rscript Track_B_reproduction/biomass_carbon.R

# Figures -> writes PDFs + summary CSVs to Track_B_reproduction/output/
R_LIBS_USER=~/R/libs Rscript Track_B_reproduction/figures.R
```

Outputs are written to `Track_B_reproduction/output/`:

| Output | Paper item |
| --- | --- |
| `Table1_carbon_budget.csv` | Table 1 (carbon budget; total ≈ 0.3 Gt fresh biomass) |
| `TableS7_biomass.csv` | Supplementary Table S7 (biomass per biome; total 31.439 Mt C) |
| `Fig1a_nematode_pointmap.pdf` | Figure 1a (sampling locations) |
| `Fig1b_data_biome_sum.csv` | Figure 1b / Table S2 (abundance summary per biome) |
| `Fig2a_stderr_observations.pdf` | Figure 2a (standard error vs. sample size) |
| `EDFig6a_correlation.pdf` | Extended Data Fig. 6a (trophic-group correlation) |
| `EDFig6b_community_plots.pdf` | Extended Data Fig. 6b (community-type clustering) |
| `EDFig6c_NMDS.pdf` | Extended Data Fig. 6c (NMDS; stress ≈ 0.07) |

The reproduced abundance/biomass values match the published Supplementary Tables
S5 and S7 to the printed precision.

### Not reproducible from this repo

A few figure panels depend on intermediate files that are **outputs of the
geospatial models (Track A)** and are not included here, so those chunks are
skipped:

- **Figure 2b** — needs `20180731_Nematode_BootStrap_StdError_1000Seeds.csv`
- **Figures 2c–h** (predicted vs. observed) — need six `*_PredVsObs.csv` files

The NMDS (Extended Data Fig. 6c) is **recomputed** with `vegan::metaMDS` because
the saved `NemaNMDS_31012019.rda` is also absent; results may differ negligibly
from the published run due to the stochastic ordination.