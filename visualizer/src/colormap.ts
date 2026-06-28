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

/** Parse a d3 color string ("#rrggbb", "#rgb" or "rgb(...)") to [r,g,b]. */
function parseColor(s: string): [number, number, number] {
  if (s[0] === "#") {
    if (s.length === 7)
      return [
        parseInt(s.slice(1, 3), 16),
        parseInt(s.slice(3, 5), 16),
        parseInt(s.slice(5, 7), 16),
      ];
    if (s.length === 4)
      return [
        17 * parseInt(s[1], 16),
        17 * parseInt(s[2], 16),
        17 * parseInt(s[3], 16),
      ];
  }
  const m = /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(s);
  if (m) return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
  return [0, 0, 0];
}

/** 256-entry RGB lookup table for a named d3 sequential colormap. */
export function buildLUT(name: ColormapName): Uint8Array {
  const interp = COLORMAPS[name] ?? interpolateViridis;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = parseColor(interp(i / 255));
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
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
