import { useEffect, useMemo, useRef, useState } from "react";
import type { Unit } from "../types";
import { unitKey } from "../model";
import { COLORMAPS, type ColormapName } from "../colormap";

interface Props {
  leaves: Unit[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  detail: Unit | undefined;
  colormap: ColormapName;
  onColormap: (c: ColormapName) => void;
}

interface Group {
  taxon: string;
  /** leaf checkboxes; single==true means the taxon itself is the only leaf */
  leaves: { key: string; label: string }[];
  single: boolean;
}

function buildGroups(leaves: Unit[]): Group[] {
  const byTaxon = new Map<string, Unit[]>();
  const order: string[] = [];
  for (const u of leaves) {
    if (!byTaxon.has(u.taxon)) {
      byTaxon.set(u.taxon, []);
      order.push(u.taxon);
    }
    byTaxon.get(u.taxon)!.push(u);
  }
  return order.map((taxon) => {
    const us = byTaxon.get(taxon)!;
    const single = us.length === 1 && us[0].sub_taxon === "(all)";
    return {
      taxon,
      single,
      leaves: us.map((u) => ({
        key: unitKey(u),
        label: single ? u.taxon : u.sub_taxon,
      })),
    };
  });
}

/** Checkbox that supports the indeterminate (partial) state. */
function TriCheck({
  checked,
  indeterminate,
  onChange,
  label,
  strong,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  strong?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <label className={"check" + (strong ? " strong" : "")}>
      <input ref={ref} type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

const fmt = (x: number) =>
  x === 0
    ? "0"
    : Math.abs(x) < 1e-4 || Math.abs(x) >= 1e5
    ? x.toExponential(2)
    : x.toFixed(Math.abs(x) < 1 ? 4 : 2);

export default function Controls({
  leaves,
  selected,
  onChange,
  detail,
  colormap,
  onColormap,
}: Props) {
  const groups = useMemo(() => buildGroups(leaves), [leaves]);
  // Collapsed by default; multi-leaf groups can expand.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };
  const toggleKeys = (keys: string[], allOn: boolean) => {
    const next = new Set(selected);
    for (const k of keys) (allOn ? next.delete(k) : next.add(k));
    onChange(next);
  };
  const toggleExpand = (taxon: string) => {
    const next = new Set(expanded);
    next.has(taxon) ? next.delete(taxon) : next.add(taxon);
    setExpanded(next);
  };

  const allKeys = leaves.map(unitKey);
  const terr = detail?.terrestrial;
  const aq = detail?.aquatic;

  return (
    <div className="panel">
      <h1>Biomass density models</h1>
      <p className="sub">
        Predicted areal density (tonnes C / km²): a linear model in temperature,
        rainfall, farm intensity and built-up fraction on land, plus marine
        animals spread evenly over the ocean. Check any mix of taxa to sum them.
      </p>

      <div className="tree-actions">
        <button onClick={() => onChange(new Set(allKeys))}>All</button>
        <button onClick={() => onChange(new Set())}>None</button>
        <span className="count">
          {selected.size}/{allKeys.length}
        </span>
      </div>

      <div className="tree">
        {groups.map((g) => {
          const keys = g.leaves.map((l) => l.key);
          const nSel = keys.filter((k) => selected.has(k)).length;
          const allSel = nSel === keys.length;
          const someSel = nSel > 0;
          if (g.single) {
            return (
              <div className="tree-row" key={g.taxon}>
                <span className="caret spacer" />
                <TriCheck
                  strong
                  checked={allSel}
                  onChange={() => toggleKey(keys[0])}
                  label={g.taxon}
                />
              </div>
            );
          }
          const open = expanded.has(g.taxon);
          return (
            <div key={g.taxon}>
              <div className="tree-row">
                <button
                  className="caret"
                  onClick={() => toggleExpand(g.taxon)}
                  aria-label={open ? "collapse" : "expand"}
                >
                  {open ? "▾" : "▸"}
                </button>
                <TriCheck
                  strong
                  checked={allSel}
                  indeterminate={someSel}
                  onChange={() => toggleKeys(keys, allSel)}
                  label={`${g.taxon}`}
                />
                <span className="badge-count">
                  {nSel}/{keys.length}
                </span>
              </div>
              {open &&
                g.leaves.map((l) => (
                  <div className="tree-row child" key={l.key}>
                    <TriCheck
                      checked={selected.has(l.key)}
                      onChange={() => toggleKey(l.key)}
                      label={l.label}
                    />
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <div className="field" style={{ marginTop: 16 }}>
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

      {detail && (
        <>
          <div className="section-title">{detail.taxon}
            {detail.sub_taxon !== "(all)" ? " · " + detail.sub_taxon : ""}</div>
          {terr && (
            <table className="coef-table">
              <tbody>
                <tr>
                  <td>land R²</td>
                  <td>{terr.r2.toFixed(3)}</td>
                </tr>
                <tr>
                  <td>intercept (t C/km²)</td>
                  <td>{fmt(terr.intercept)}</td>
                </tr>
                <tr>
                  <td>temperature (per °C)</td>
                  <td>{fmt(terr.temperature)}</td>
                </tr>
                <tr>
                  <td>rainfall (per mm/yr)</td>
                  <td>{fmt(terr.rainfall)}</td>
                </tr>
                <tr>
                  <td>farm intensity (0→1)</td>
                  <td>{fmt(terr.farm_intensity)}</td>
                </tr>
                <tr>
                  <td>built-up frac (0→1)</td>
                  <td>{fmt(terr.urban_intensity)}</td>
                </tr>
              </tbody>
            </table>
          )}
          {aq && (
            <div className="stat" style={{ marginTop: 6 }}>
              <div className="k">ocean density (even)</div>
              <div className="v">{fmt(aq.intercept)} t C/km²</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
