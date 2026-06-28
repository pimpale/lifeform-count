import type { FeatureGrid, GridMeta } from "./types";

/** Fetch the grid metadata and its four binary feature arrays. */
export async function loadGrid(
  base = "data/"
): Promise<{ meta: GridMeta; grid: FeatureGrid }> {
  const meta = (await (await fetch(base + "meta.json")).json()) as GridMeta;
  const buf = (name: string) =>
    fetch(base + name).then((r) => r.arrayBuffer());
  const [t, r, fa, ur] = await Promise.all([
    buf(meta.vars.temperature.file),
    buf(meta.vars.rainfall.file),
    buf(meta.vars.farm_development.file),
    buf(meta.vars.urban_development.file),
  ]);
  return {
    meta,
    grid: {
      width: meta.width,
      height: meta.height,
      bounds: meta.bounds,
      temperature: new Float32Array(t),
      rainfall: new Float32Array(r),
      farm: new Uint8Array(fa),
      urban: new Uint8Array(ur),
    },
  };
}
