import { useEffect, useMemo, useState } from "react";
import type { FeatureGrid, ModelEntry } from "./types";
import { loadModels, computeDensities } from "./model";
import { loadGrid } from "./grid";
import { buildLUT, type ColormapName } from "./colormap";
import { densityCanvas, logDomain } from "./image";
import MapView from "./components/MapView";
import Controls from "./components/Controls";
import Legend from "./components/Legend";

export default function App() {
  const [models, setModels] = useState<ModelEntry[] | null>(null);
  const [grid, setGrid] = useState<FeatureGrid | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [taxon, setTaxon] = useState("Total");
  const [subTaxon, setSubTaxon] = useState("(all)");
  const [colormap, setColormap] = useState<ColormapName>("viridis");

  // Load weights + feature grid once.
  useEffect(() => {
    (async () => {
      try {
        const [m, g] = await Promise.all([
          loadModels("data/biomass_density_model_weights.csv"),
          loadGrid("data/"),
        ]);
        setModels(m);
        setGrid(g.grid);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // Keep sub-taxon valid when taxon changes.
  useEffect(() => {
    if (!models) return;
    const subs = models.filter((m) => m.taxon === taxon).map((m) => m.sub_taxon);
    if (subs.length && !subs.includes(subTaxon)) {
      setSubTaxon(subs.includes("(all)") ? "(all)" : subs[0]);
    }
  }, [taxon, models, subTaxon]);

  const active = useMemo(
    () =>
      models?.find((m) => m.taxon === taxon && m.sub_taxon === subTaxon),
    [models, taxon, subTaxon]
  );

  const densities = useMemo(
    () => (grid && active ? computeDensities(grid, active) : null),
    [grid, active]
  );

  const domain = useMemo(
    () => (densities ? logDomain(densities) : ([-3, 1] as [number, number])),
    [densities]
  );

  const image = useMemo(() => {
    if (!grid || !densities) return null;
    return densityCanvas(grid, densities, buildLUT(colormap), domain);
  }, [grid, densities, colormap, domain]);

  if (error)
    return (
      <div className="loading">
        Failed to load data: {error}
        <br />
        Did you run <code>npm run build-grid</code>?
      </div>
    );
  if (!models || !grid) return <div className="loading">Loading model + grid…</div>;

  return (
    <div className="app">
      {image && densities && active && (
        <MapView
          grid={grid}
          densities={densities}
          image={image}
          model={active}
        />
      )}
      <Controls
        models={models}
        taxon={taxon}
        subTaxon={subTaxon}
        colormap={colormap}
        active={active}
        onTaxon={setTaxon}
        onSubTaxon={setSubTaxon}
        onColormap={setColormap}
      />
      <Legend colormap={colormap} domain={domain} />
    </div>
  );
}
