import type { ModelEntry } from "../types";
import { COLORMAPS, type ColormapName } from "../colormap";

interface Props {
  models: ModelEntry[];
  taxon: string;
  subTaxon: string;
  colormap: ColormapName;
  active: ModelEntry | undefined;
  onTaxon: (t: string) => void;
  onSubTaxon: (s: string) => void;
  onColormap: (c: ColormapName) => void;
}

const fmt = (x: number) =>
  x === 0
    ? "0"
    : Math.abs(x) < 1e-4 || Math.abs(x) >= 1e5
    ? x.toExponential(2)
    : x.toFixed(Math.abs(x) < 1 ? 4 : 2);

export default function Controls({
  models,
  taxon,
  subTaxon,
  colormap,
  active,
  onTaxon,
  onSubTaxon,
  onColormap,
}: Props) {
  const taxa = [...new Set(models.map((m) => m.taxon))];
  const subs = models.filter((m) => m.taxon === taxon).map((m) => m.sub_taxon);

  return (
    <div className="panel">
      <h1>Biomass density models</h1>
      <p className="sub">
        Predicted areal density (tonnes C / km²) from a log-linear model in
        temperature, rainfall, farmland and urban cover. Pick a taxon to map it
        globally.
      </p>

      <div className="field">
        <label>Taxon</label>
        <select value={taxon} onChange={(e) => onTaxon(e.target.value)}>
          {taxa.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Sub-taxon</label>
        <select value={subTaxon} onChange={(e) => onSubTaxon(e.target.value)}>
          {subs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Colormap</label>
        <select
          value={colormap}
          onChange={(e) => onColormap(e.target.value as ColormapName)}
        >
          {Object.keys(COLORMAPS).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {active && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">model R²</div>
              <div className="v">{active.r2.toFixed(3)}</div>
            </div>
            <div className="stat">
              <div className="k">intercept</div>
              <div className="v">{fmt(active.intercept)}</div>
            </div>
          </div>

          <div className="section-title">
            Coefficients (log₁₀ density per unit)
          </div>
          <table className="coef-table">
            <tbody>
              <tr>
                <td>temperature (°C)</td>
                <td>{fmt(active.temperature)}</td>
              </tr>
              <tr>
                <td>rainfall (mm/yr)</td>
                <td>{fmt(active.rainfall)}</td>
              </tr>
              <tr>
                <td>farm development</td>
                <td>{fmt(active.farm_development)}</td>
              </tr>
              <tr>
                <td>urban development</td>
                <td>{fmt(active.urban_development)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
