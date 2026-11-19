import { weekLabel } from "../utils/dates";

const W = 780;
const H = 300;
const L = 46;
const R = 14;
const T = 14;
const B = 34;

// Line chart in plain SVG: actual weekly units, the Random Forest's predictions on the test weeks, and the forecast
export default function ForecastChart({ history, testRows = [], forecast = [] }) {
  const weeks = [...history.map((h) => h.week), ...forecast.map((f) => f.week)];
  const total = weeks.length;
  const indexOf = new Map(weeks.map((w, i) => [w, i]));
  const highest = Math.max(1, ...history.map((h) => h.units), ...testRows.map((r) => r.randomForest), ...forecast.map((f) => f.units));
  // Round the axis to a tidy step (1, 2, 5, 10, 20, 50...) so the tick labels are clean numbers
  const rawStep = (highest * 1.05) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= rawStep);
  const maxY = step * 4;

  const x = (i) => L + (i / Math.max(1, total - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / maxY) * (H - T - B);
  const line = (pts) => pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const lastIdx = history.length - 1;
  const actual = history.map((h, i) => [i, h.units]);
  const predicted = testRows.map((r) => [indexOf.get(r.week), r.randomForest]);
  const future = forecast.length ? [[lastIdx, history[lastIdx].units], ...forecast.map((f, k) => [lastIdx + 1 + k, f.units])] : [];

  const ticks = [0, 1, 2, 3, 4].map((k) => step * k);
  const labelAt = [0, 1, 2, 3, 4].map((k) => Math.round((k * (total - 1)) / 4));
  const testStart = testRows.length ? indexOf.get(testRows[0].week) : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Weekly units: actual, tested predictions and forecast">
        {testStart !== null && (
          <rect x={x(testStart)} y={T} width={x(lastIdx) - x(testStart)} height={H - T - B} className="chart-test" />
        )}
        {forecast.length > 0 && (
          <rect x={x(lastIdx)} y={T} width={x(total - 1) - x(lastIdx)} height={H - T - B} className="chart-future" />
        )}

        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="chart-text">{Math.round(v)}</text>
          </g>
        ))}

        {labelAt.map((i, k) => (
          <text key={i} x={x(i)} y={H - 10} textAnchor={k === 0 ? "start" : k === labelAt.length - 1 ? "end" : "middle"} className="chart-text">
            {weekLabel(weeks[i])}
          </text>
        ))}

        <path d={line(actual)} className="chart-actual" />
        {predicted.length > 1 && <path d={line(predicted)} className="chart-predicted" />}
        {future.length > 1 && <path d={line(future)} className="chart-forecast" />}
      </svg>

      <div className="legend">
        <span><i className="swatch swatch-actual" /> Actual units per week</span>
        {predicted.length > 1 && <span><i className="swatch swatch-predicted" /> Model predictions on the test weeks (shaded)</span>}
        {future.length > 1 && <span><i className="swatch swatch-forecast" /> Forecast (green area)</span>}
      </div>
    </div>
  );
}
