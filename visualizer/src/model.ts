import Papa from "papaparse";
import type { Domain, FeatureGrid, ModelEntry, Unit } from "./types";

interface RawRow {
  taxon: string;
  sub_taxon: string;
  feature: string;
  coefficient: string;
  r2: string;
  domain: string;
}

/** Parse the exported weights CSV into one ModelEntry per (taxon, sub_taxon, domain). */
export async function loadModels(url: string): Promise<ModelEntry[]> {
  const text = await (await fetch(url)).text();
  const { data } = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const byKey = new Map<string, ModelEntry>();
  for (const row of data) {
    if (!row.taxon) continue;
    const domain = (row.domain as Domain) || "terrestrial";
    const key = `${row.taxon}||${row.sub_taxon}||${domain}`;
    let e = byKey.get(key);
    if (!e) {
      e = {
        taxon: row.taxon,
        sub_taxon: row.sub_taxon,
        domain,
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

/** Stable identity for a unit. */
export const unitKey = (u: Unit) => `${u.taxon}||${u.sub_taxon}`;

/** Human label: "Taxon" for the (all) aggregate, else "Taxon · Sub". */
export const unitLabel = (u: Unit) =>
  u.sub_taxon === "(all)" ? u.taxon : `${u.taxon} · ${u.sub_taxon}`;

/**
 * The checkable leaves: for a taxon with real sub-taxa, those sub-taxa (so they
 * can be mixed and matched); for a taxon with only an aggregate, that aggregate.
 * "Total" is dropped — checking every leaf already reproduces it.
 */
export function leafUnits(units: Unit[]): Unit[] {
  const byTaxon = new Map<string, Unit[]>();
  const order: string[] = [];
  for (const u of units) {
    if (u.taxon === "Total") continue;
    if (!byTaxon.has(u.taxon)) {
      byTaxon.set(u.taxon, []);
      order.push(u.taxon);
    }
    byTaxon.get(u.taxon)!.push(u);
  }
  const out: Unit[] = [];
  for (const t of order) {
    const us = byTaxon.get(t)!;
    const subs = us.filter((u) => u.sub_taxon !== "(all)");
    out.push(...(subs.length ? subs : us));
  }
  return out;
}

/** Group entries into selectable units, merging the domains of each (taxon, sub_taxon). */
export function buildUnits(models: ModelEntry[]): Unit[] {
  const byKey = new Map<string, Unit>();
  const order: string[] = [];
  for (const m of models) {
    const key = `${m.taxon}||${m.sub_taxon}`;
    let u = byKey.get(key);
    if (!u) {
      u = { taxon: m.taxon, sub_taxon: m.sub_taxon };
      byKey.set(key, u);
      order.push(key);
    }
    if (m.domain === "aquatic") u.aquatic = m;
    else u.terrestrial = m;
  }
  return order.map((k) => byKey.get(k)!);
}

/** Linear terrestrial density (tonnes C/km^2), clamped to >= 0. */
function terrestrialDensity(
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

/**
 * Per-cell summed density across the whole grid for a set of selected units.
 * Land cells sum the units' terrestrial models; ocean/lake cells sum their
 * (constant) aquatic densities. A cell whose domain has no selected unit (incl.
 * ice sheets) is NaN, so it stays transparent.
 */
export function computeDensities(grid: FeatureGrid, units: Unit[]): Float32Array {
  const n = grid.width * grid.height;
  const out = new Float32Array(n);
  const terr = units.map((u) => u.terrestrial).filter((e): e is ModelEntry => !!e);
  const aqSum = units.reduce(
    (s, u) => s + (u.aquatic && u.aquatic.intercept > 0 ? u.aquatic.intercept : 0),
    0
  );
  const hasAq = units.some((u) => u.aquatic);
  for (let i = 0; i < n; i++) {
    const t = grid.temperature[i];
    if (Number.isFinite(t)) {
      if (!terr.length) {
        out[i] = NaN;
        continue;
      }
      let s = 0;
      for (const e of terr) {
        s += terrestrialDensity(
          e,
          t,
          grid.rainfall[i],
          grid.farm_intensity[i],
          grid.urban_intensity[i]
        );
      }
      out[i] = s;
    } else if (grid.ocean[i] === 1) {
      out[i] = hasAq ? aqSum : NaN;
    } else {
      out[i] = NaN; // ice sheet / no data
    }
  }
  return out;
}
