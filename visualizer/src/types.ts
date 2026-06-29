export const FEATURES = [
  "temperature",
  "rainfall",
  "farm_intensity",
  "urban_intensity",
] as const;

export type Feature = (typeof FEATURES)[number];

export type Domain = "terrestrial" | "aquatic";

/**
 * The four fitted coefficients plus intercept for one (taxon, sub_taxon, domain).
 * The model is linear: density [t C/km^2] = intercept + Σ coef·feature.
 * Aquatic entries are constant over the ocean (all feature coefficients 0, so
 * intercept = density).
 */
export interface ModelEntry {
  taxon: string;
  sub_taxon: string;
  domain: Domain;
  r2: number;
  intercept: number;
  temperature: number;
  rainfall: number;
  farm_intensity: number;
  urban_intensity: number;
}

/**
 * A selectable unit: the (taxon, sub_taxon) with whichever domain entries exist.
 * "Total" has both; wild taxa only terrestrial; marine taxa only aquatic.
 */
export interface Unit {
  taxon: string;
  sub_taxon: string;
  terrestrial?: ModelEntry;
  aquatic?: ModelEntry;
}

export interface GridMeta {
  width: number;
  height: number;
  degrees: number;
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  weights_csv: string;
  vars: Record<string, { file: string; dtype: string; units: string }>;
}

/** The baked global feature grid, north-up, row 0 = northern edge. */
export interface FeatureGrid {
  width: number;
  height: number;
  bounds: [number, number, number, number];
  temperature: Float32Array; // NaN over ocean / non-land
  rainfall: Float32Array;
  farm_intensity: Float32Array; // 0..1 cropland+pasture fraction
  urban_intensity: Float32Array; // 0..1 built-up fraction
  ocean: Uint8Array; // 1 = ocean/lake (aquatic domain)
}
