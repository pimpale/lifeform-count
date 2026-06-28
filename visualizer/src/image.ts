import type { FeatureGrid } from "./types";

// Web-Mercator clip latitude. The density image is pre-warped into Mercator Y
// (below) so it lines up with deck.gl's Mercator map and the country outlines;
// a raw equirectangular bitmap would have the wrong vertical scale.
export const MERC_LAT = 85.0511287798066;
export const MERCATOR_BOUNDS: [number, number, number, number] = [
  -180, -MERC_LAT, 180, MERC_LAT,
];

const mercY = (latDeg: number) =>
  Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));

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
 * Paint the density grid into an RGBA canvas using a colormap LUT and a log10
 * domain, **warped to Web Mercator Y** so it aligns with the map. Non-land
 * cells are transparent. Output rows run north (row 0) to south.
 */
export function densityCanvas(
  grid: FeatureGrid,
  densities: Float32Array,
  lut: Uint8Array,
  domain: [number, number]
): HTMLCanvasElement {
  const { width, height } = grid;
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  // Lift the colormap floor a little so the darkest values stay visible against
  // the dark basemap (0.10..1.0 of the LUT instead of 0..1).
  const FLOOR = 0.1;

  // 1) Color each equirectangular cell into a source RGBA buffer.
  const src = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < densities.length; i++) {
    const d = densities[i];
    if (!Number.isFinite(d)) continue; // transparent
    let v = (Math.log10(Math.max(d, 1e-12)) - lo) / span;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    const idx = Math.round((FLOOR + v * (1 - FLOOR)) * 255) * 3;
    const o = i * 4;
    src[o] = lut[idx];
    src[o + 1] = lut[idx + 1];
    src[o + 2] = lut[idx + 2];
    src[o + 3] = 255;
  }

  // 2) Warp rows from equirectangular latitude to Mercator Y (longitude/columns
  //    are unchanged, so this is a per-row vertical resample).
  const dst = new Uint8ClampedArray(width * height * 4);
  const [, south, , north] = grid.bounds; // -90, 90
  const yTop = mercY(MERC_LAT);
  const yBot = mercY(-MERC_LAT);
  for (let y = 0; y < height; y++) {
    const yMerc = yTop + ((y + 0.5) / height) * (yBot - yTop);
    const lat = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * (180 / Math.PI);
    let srcRow = Math.floor(((north - lat) / (north - south)) * height);
    if (srcRow < 0) srcRow = 0;
    else if (srcRow >= height) srcRow = height - 1;
    const sOff = srcRow * width * 4;
    dst.set(src.subarray(sOff, sOff + width * 4), y * width * 4);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(dst, width, height), 0, 0);
  return canvas;
}
