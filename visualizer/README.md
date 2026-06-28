# Biomass density visualizer

An interactive global map of the per-taxon biomass-density models exported by
`integrated_biomass`
(`integrated_biomass/results/biomass_density_model_weights.csv`).

Each model is **linear** (additive) in four continuous features:

```
density [t C / km²] = intercept
    + c_temperature     · temperature      [°C]
    + c_rainfall        · rainfall         [mm/yr]
    + c_farm_intensity  · farm_intensity   [0..1 cropland+pasture fraction]
    + c_urban_intensity · urban_intensity  [0..1 built-up fraction]
```

Because every taxon is just five numbers over the **same four feature rasters**,
the app bakes those features into one compact global grid and evaluates whichever
taxon you select in the browser — so all ~60 models (wild taxa & sub-taxa,
humans, each livestock & commensal animal, and the Total) are instantly mappable.
Negative predictions (linear extrapolation) are clamped to 0.

## Data pipeline

`scripts/build_grid.py` regrids the model's input rasters onto a common
0.25° lon/lat grid and writes them to `public/data/`:

| feature | source |
| --- | --- |
| temperature | CHELSA v2.1 bio1 (downloaded to `integrated_biomass`'s cache) |
| rainfall | CHELSA v2.1 bio12 |
| farm_intensity | Ramankutty `cropland.tif` + `pasture.tif` areal fraction (`rosenberg…/data`) |
| urban_intensity | GHS-BUILT-S 2020 built-up surface fraction (1 km, Mollweide) |

The terrestrial land mask comes from the cropland raster's footprint. It also
copies `biomass_density_model_weights.csv` into `public/data/` for the app.

Regenerate (e.g. at a different resolution) with the `integrated_biomass`
virtualenv, which has rasterio/geopandas:

```bash
../integrated_biomass/.venv/bin/python scripts/build_grid.py --deg 0.25
```

The four `.f32` binaries plus `meta.json` are committed, so the app runs without
re-downloading the multi-GB CHELSA / GHS-BUILT-S source rasters.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

## Notes / caveats

- Density is rendered on a **log color scale** (2nd–98th percentile of the
  selected taxon), so taxa spanning orders of magnitude stay readable.
- The map is the model's *prediction surface*, not observed biomass: it shows
  what each taxon's fitted climate/land-use response implies everywhere on land.
  Models with low R² (shown in the panel) are correspondingly weak.
- Hover any land cell for its predicted density and the underlying feature
  values. Built with React + Vite + deck.gl.
