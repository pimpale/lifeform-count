import {
  interpolateViridis,
  interpolateInferno,
  interpolateMagma,
  interpolateTurbo,
  interpolatePlasma,
} from "d3-scale-chromatic";

export const COLORMAPS: Record<string, (t: number) => string> = {
  viridis: interpolateViridis,
  plasma: interpolatePlasma,
  inferno: interpolateInferno,
  magma: interpolateMagma,
  turbo: interpolateTurbo,
};

export type ColormapName = keyof typeof COLORMAPS;

/** 256-entry RGB lookup table for a named d3 sequential colormap. */
export function buildLUT(name: ColormapName): Uint8Array {
  const interp = COLORMAPS[name] ?? interpolateViridis;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(interp(i / 255));
    if (m) {
      lut[i * 3] = +m[1];
      lut[i * 3 + 1] = +m[2];
      lut[i * 3 + 2] = +m[3];
    }
  }
  return lut;
}

/** CSS gradient string for a legend bar. */
export function gradientCss(name: ColormapName, stops = 12): string {
  const interp = COLORMAPS[name] ?? interpolateViridis;
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    parts.push(`${interp(i / stops)} ${(100 * i) / stops}%`);
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}
