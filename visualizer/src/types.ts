export const FEATURES = [
  "temperature",
  "rainfall",
  "farm_intensity",
  "urban_intensity",
] as const;

export type Feature = (typeof FEATURES)[number];

/**
 * The four fitted coefficients plus intercept for one (taxon, sub_taxon).
 * The model is linear: density [t C/km^2] = intercept + Σ coef·feature.
 */
export interface ModelEntry {
  taxon: string;
  sub_taxon: string;
  r2: number;
  intercept: number;
  temperature: number;
  rainfall: number;
  farm_intensity: number;
  urban_intensity: number;
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
}
