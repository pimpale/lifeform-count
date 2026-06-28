import type { FeatureGrid } from "./types";

/** Low/high percentile of log10(density) over finite, positive cells. */
export function logDomain(
  densities: Float32Array,
  loPct = 0.02,
  hiPct = 0.98
): [number, number] {
  const logs: number[] = [];
  for (let i = 0; i < densities.length; i++) {
    const d = densities[i];
    if (Number.isFinite(d) && d > 0) logs.push(Math.log10(d));
  }
  if (logs.length === 0) return [-3, 1];
  logs.sort((a, b) => a - b);
  const at = (p: number) =>
    logs[Math.min(logs.length - 1, Math.max(0, Math.round(p * (logs.length - 1))))];
  let lo = at(loPct);
  let hi = at(hiPct);
  if (hi - lo < 1e-6) hi = lo + 1;
  return [lo, hi];
}

/**
 * Paint the density grid into an RGBA canvas using a colormap LUT and a
 * log10 domain. Non-land cells are transparent. The canvas is north-up
 * (row 0 = northern edge), matching the BitmapLayer bounds.
 */
export function densityCanvas(
  grid: FeatureGrid,
  densities: Float32Array,
  lut: Uint8Array,
  domain: [number, number]
): HTMLCanvasElement {
  const { width, height } = grid;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  for (let i = 0; i < densities.length; i++) {
    const d = densities[i];
    if (!Number.isFinite(d)) continue; // transparent
    let v = (Math.log10(Math.max(d, 1e-12)) - lo) / span;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    const idx = Math.round(v * 255) * 3;
    const o = i * 4;
    rgba[o] = lut[idx];
    rgba[o + 1] = lut[idx + 1];
    rgba[o + 2] = lut[idx + 2];
    rgba[o + 3] = 255;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas;
}
