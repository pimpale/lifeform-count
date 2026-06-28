import Papa from "papaparse";
import type { ModelEntry, FeatureGrid } from "./types";

interface RawRow {
  taxon: string;
  sub_taxon: string;
  feature: string;
  coefficient: string;
  r2: string;
}

/** Parse the exported weights CSV into one ModelEntry per (taxon, sub_taxon). */
export async function loadModels(url: string): Promise<ModelEntry[]> {
  const text = await (await fetch(url)).text();
  const { data } = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const byKey = new Map<string, ModelEntry>();
  for (const row of data) {
    if (!row.taxon) continue;
    const key = `${row.taxon}||${row.sub_taxon}`;
    let e = byKey.get(key);
    if (!e) {
      e = {
        taxon: row.taxon,
        sub_taxon: row.sub_taxon,
        r2: Number(row.r2),
        intercept: 0,
        temperature: 0,
        rainfall: 0,
        farm_development: 0,
        urban_development: 0,
      };
      byKey.set(key, e);
    }
    const c = Number(row.coefficient);
    if (row.feature === "intercept") e.intercept = c;
    else (e as unknown as Record<string, number>)[row.feature] = c;
  }
  return [...byKey.values()];
}

/** Predicted density (tonnes C / km^2) for one set of feature values. */
export function evalDensity(
  m: ModelEntry,
  temperature: number,
  rainfall: number,
  farm: number,
  urban: number
): number {
  const log10d =
    m.intercept +
    m.temperature * temperature +
    m.rainfall * rainfall +
    m.farm_development * farm +
    m.urban_development * urban;
  return Math.pow(10, log10d);
}

/** Per-cell predicted density across the whole grid; NaN over non-land. */
export function computeDensities(
  grid: FeatureGrid,
  m: ModelEntry
): Float32Array {
  const n = grid.width * grid.height;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = grid.temperature[i];
    if (!Number.isFinite(t)) {
      out[i] = NaN;
      continue;
    }
    const log10d =
      m.intercept +
      m.temperature * t +
      m.rainfall * grid.rainfall[i] +
      m.farm_development * grid.farm[i] +
      m.urban_development * grid.urban[i];
    out[i] = Math.pow(10, log10d);
  }
  return out;
}
