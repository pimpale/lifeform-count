import { useEffect, useMemo, useState } from "react";
import type { FeatureGrid, ModelEntry } from "./types";
import {
  loadModels,
  buildUnits,
  leafUnits,
  computeDensities,
  unitKey,
  unitLabel,
} from "./model";
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

  const [selected, setSelected] = useState<Set<string> | null>(null);
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

  const units = useMemo(() => (models ? buildUnits(models) : []), [models]);
  const leaves = useMemo(() => leafUnits(units), [units]);

  // Start with everything selected (== the Total view).
  useEffect(() => {
    if (leaves.length && selected === null) {
      setSelected(new Set(leaves.map(unitKey)));
    }
  }, [leaves, selected]);

  const selectedUnits = useMemo(
    () => (selected ? leaves.filter((u) => selected.has(unitKey(u))) : []),
    [leaves, selected]
  );

  const densities = useMemo(
    () => (grid ? computeDensities(grid, selectedUnits) : null),
    [grid, selectedUnits]
  );

  const domain = useMemo(
    () => (densities ? logDomain(densities) : ([-3, 1] as [number, number])),
    [densities]
  );

  const image = useMemo(() => {
    if (!grid || !densities) return null;
    return densityCanvas(grid, densities, buildLUT(colormap), domain);
  }, [grid, densities, colormap, domain]);

  const title = useMemo(() => {
    if (!selected) return "";
    if (selectedUnits.length === 0) return "Nothing selected";
    if (selected.size === leaves.length) return "All taxa";
    if (selectedUnits.length === 1) return unitLabel(selectedUnits[0]);
    return `${selectedUnits.length} taxa`;
  }, [selected, selectedUnits, leaves]);

  if (error)
    return (
      <div className="loading">
        Failed to load data: {error}
        <br />
        Did you run <code>npm run build-grid</code>?
      </div>
    );
  if (!models || !grid || !selected)
    return <div className="loading">Loading model + grid…</div>;

  return (
    <div className="app">
      {image && densities && (
        <MapView grid={grid} densities={densities} image={image} title={title} />
      )}
      <Controls
        leaves={leaves}
        selected={selected}
        onChange={setSelected}
        detail={selectedUnits.length === 1 ? selectedUnits[0] : undefined}
        colormap={colormap}
        onColormap={setColormap}
      />
      <Legend colormap={colormap} domain={domain} />
    </div>
  );
}
