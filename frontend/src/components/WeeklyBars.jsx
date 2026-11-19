import { weekLabel } from "../utils/dates";

const W = 780;
const H = 280;
const L = 44;
const R = 12;
const T = 12;
const B = 32;

// Column chart: one bar per week (units sold), with the forecast weeks in green.
// Hover (or long-press) a bar to see the week and the number.
export default function WeeklyBars({ history, forecast = [] }) {
  const bars = [
    ...history.map((h) => ({ week: h.week, units: h.units, kind: "actual" })),
    ...forecast.map((f) => ({ week: f.week, units: f.units, kind: "forecast" })),
  ];
  const n = bars.length;
  if (n === 0) return null;

  // Round the axis to a tidy step so the tick labels are clean numbers
  const highest = Math.max(1, ...bars.map((b) => b.units));
  const rawStep = (highest * 1.05) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= rawStep));
  const top = step * 4;

  const slot = (W - L - R) / n;
  const barWidth = Math.max(1, slot * 0.72);
  const x = (i) => L + i * slot + (slot - barWidth) / 2;
  const y = (v) => T + (1 - v / top) * (H - T - B);
  const baseline = y(0);

  const ticks = [0, 1, 2, 3, 4].map((k) => step * k);
  const labelAt = [...new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * (n - 1)) / 4)))];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Units sold per week">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="chart-text">{v}</text>
          </g>
        ))}

        {bars.map((b, i) => (
          <rect
            key={`${b.kind}-${b.week}`}
            x={x(i)}
            y={y(b.units)}
            width={barWidth}
            height={Math.max(0, baseline - y(b.units))}
            className={b.kind === "forecast" ? "wbar wbar-forecast" : "wbar"}
          >
            <title>{`Week of ${weekLabel(b.week)}: ${Math.round(b.units)} units${b.kind === "forecast" ? " (forecast)" : ""}`}</title>
          </rect>
        ))}

        {labelAt.map((i, k) => (
          <text
            key={i}
            x={x(i) + barWidth / 2}
            y={H - 10}
            textAnchor={k === 0 ? "start" : k === labelAt.length - 1 ? "end" : "middle"}
            className="chart-text"
          >
            {weekLabel(bars[i].week)}
          </text>
        ))}
      </svg>

      <div className="legend">
        <span><i className="swatch swatch-box swatch-bar" /> Units sold per week</span>
        {forecast.length > 0 && <span><i className="swatch swatch-box swatch-forecast" /> Forecast</span>}
      </div>
    </div>
  );
}
