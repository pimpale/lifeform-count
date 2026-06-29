import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { BitmapLayer, GeoJsonLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import type { FeatureGrid } from "../types";
import { MERCATOR_BOUNDS, MERC_LAT } from "../image";

const INITIAL_VIEW_STATE = {
  longitude: 10,
  latitude: 15,
  zoom: 0.6,
  minZoom: 0,
  maxZoom: 8,
  pitch: 0,
  bearing: 0,
};

// Country polygons for geographic context (converted from topojson once).
const COUNTRIES = feature(
  worldTopo as any,
  (worldTopo as any).objects.countries
) as any;

interface Props {
  grid: FeatureGrid;
  densities: Float32Array;
  image: HTMLCanvasElement;
  title: string;
}

// BitmapLayer reliably accepts an image URL across deck/luma versions; encode
// the density canvas as a PNG data URL.

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "—");
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : "—");

function densityStr(d: number): string {
  if (!Number.isFinite(d)) return "—";
  if (d === 0) return "0";
  if (d >= 1000 || d < 0.001) return d.toExponential(2);
  if (d >= 1) return d.toFixed(1);
  return d.toFixed(3);
}

export default function MapView({ grid, densities, image, title }: Props) {
  const imageUrl = useMemo(() => image.toDataURL("image/png"), [image]);
  const layers = useMemo(() => {
    return [
      // Faint land fill so coastlines read (and Antarctica, which has no density
      // data, stays visible). wrapLongitude splits polygons at the antimeridian
      // so Russia/Antarctica don't smear into stripes across the map.
      new GeoJsonLayer({
        id: "land",
        data: COUNTRIES,
        stroked: false,
        filled: true,
        wrapLongitude: true,
        getFillColor: [120, 132, 168, 28],
      }),
      // The density image is pre-warped to Mercator Y in densityCanvas, so its
      // bounds use the Mercator clip latitude (not ±90).
      new BitmapLayer({
        id: "density",
        image: imageUrl,
        bounds: MERCATOR_BOUNDS,
        pickable: true,
        opacity: 1,
      }),
      new GeoJsonLayer({
        id: "countries",
        data: COUNTRIES,
        stroked: true,
        filled: false,
        wrapLongitude: true,
        getLineColor: [255, 255, 255, 70],
        lineWidthMinPixels: 0.5,
      }),
    ];
  }, [imageUrl]);

  const getTooltip = (info: PickingInfo) => {
    // info.coordinate is [lon, lat] under the cursor; map straight to a grid
    // cell (independent of the Mercator warp baked into the image).
    const coord = info.coordinate as [number, number] | undefined;
    if (!coord || info.layer?.id !== "density") return null;
    const [lon, lat] = coord;
    if (Math.abs(lat) > MERC_LAT) return null;
    const col = Math.floor(((lon + 180) / 360) * grid.width);
    const row = Math.floor(((90 - lat) / 180) * grid.height);
    if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return null;
    const idx = row * grid.width + col;
    const t = grid.temperature[idx];
    const onLand = Number.isFinite(t);
    const isOcean = grid.ocean[idx] === 1;
    if (!onLand && !isOcean) return null; // ice sheet / no data
    const d = densities[idx];
    if (!Number.isFinite(d)) return null; // no entry for this cell's domain

    const label = title;
    const detail = onLand
      ? `${f1(t)} °C · ${f1(grid.rainfall[idx])} mm<br/>farm ${pct(
          grid.farm_intensity[idx]
        )} · built-up ${pct(grid.urban_intensity[idx])}`
      : `ocean / lake`;

    return {
      html: `<div class="tooltip">
        <b>${label}</b><br/>
        ${densityStr(d)} t C/km²<br/>
        ${lat.toFixed(1)}°, ${lon.toFixed(1)}°<br/>
        ${detail}
      </div>`,
      style: {
        background: "rgba(21,27,48,0.95)",
        border: "1px solid #2c3760",
        borderRadius: "8px",
        color: "#e7ecf5",
        fontSize: "12px",
      },
    };
  };

  return (
    <div className="map-wrap">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        getTooltip={getTooltip}
        style={{ background: "#070b16" }}
      />
    </div>
  );
}
