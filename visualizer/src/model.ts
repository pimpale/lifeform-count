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
        farm_intensity: 0,
        urban_intensity: 0,
      };
      byKey.set(key, e);
    }
    const c = Number(row.coefficient);
    if (row.feature === "intercept") e.intercept = c;
    else (e as unknown as Record<string, number>)[row.feature] = c;
  }
  return [...byKey.values()];
}

/**
 * Predicted density (tonnes C / km^2) for one set of feature values. The model
 * is linear/additive; negative predictions (extrapolation artifacts) are
 * clamped to 0, since biomass density can't be negative.
 */
export function evalDensity(
  m: ModelEntry,
  temperature: number,
  rainfall: number,
  farmIntensity: number,
  urbanIntensity: number
): number {
  const d =
    m.intercept +
    m.temperature * temperature +
    m.rainfall * rainfall +
    m.farm_intensity * farmIntensity +
    m.urban_intensity * urbanIntensity;
  return d > 0 ? d : 0;
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
    const d =
      m.intercept +
      m.temperature * t +
      m.rainfall * grid.rainfall[i] +
      m.farm_intensity * grid.farm_intensity[i] +
      m.urban_intensity * grid.urban_intensity[i];
    out[i] = d > 0 ? d : 0;
  }
  return out;
}
