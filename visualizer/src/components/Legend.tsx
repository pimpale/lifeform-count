import { gradientCss, type ColormapName } from "../colormap";

interface Props {
  colormap: ColormapName;
  /** log10 density domain [lo, hi]. */
  domain: [number, number];
}

function fmtDensity(log10d: number): string {
  const d = Math.pow(10, log10d);
  if (d >= 1000 || d < 0.01) return d.toExponential(1);
  if (d >= 1) return d.toFixed(0);
  return d.toFixed(2);
}

export default function Legend({ colormap, domain }: Props) {
  const [lo, hi] = domain;
  const mid = (lo + hi) / 2;
  return (
    <div className="legend">
      <div className="title">Predicted density</div>
      <div className="bar" style={{ background: gradientCss(colormap) }} />
      <div className="ticks">
        <span>{fmtDensity(lo)}</span>
        <span>{fmtDensity(mid)}</span>
        <span>{fmtDensity(hi)}</span>
      </div>
      <div className="units">tonnes C / km² · log scale</div>
    </div>
  );
}
