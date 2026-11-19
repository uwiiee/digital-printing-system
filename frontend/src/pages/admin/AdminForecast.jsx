import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { monthLabel, weekLabel } from "../../utils/dates";
import { peso } from "../../utils/format";
import DemoTag from "../../components/DemoTag";
import ForecastChart from "../../components/ForecastChart";
import MonthlyBars from "../../components/MonthlyBars";
import WeeklyBars from "../../components/WeeklyBars";

const RECENT_WEEKS_SHOWN = 26;

const changeText = (pct, weeks) =>
  pct == null ? "no earlier weeks to compare" : `${pct > 0 ? "+" : ""}${pct}% vs the last ${weeks} weeks`;
const changeClass = (pct) => (pct == null ? "" : pct >= 0 ? "up" : "down");

function ForecastTable({ forecast }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Week starting</th><th>Expected units</th></tr>
        </thead>
        <tbody>
          {forecast.map((f) => (
            <tr key={f.week}><td>{weekLabel(f.week)}</td><td>{Math.round(f.units)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


const RANGES = [
  ["12", "12 weeks", 12],
  ["26", "26 weeks", 26],
  ["52", "1 year", 52],
  ["all", "All", Infinity],
];

// Numbers shown above the weekly graph, for the weeks currently on screen
function periodStats(history, visible) {
  const total = visible.reduce((sum, h) => sum + h.units, 0);
  const best = visible.reduce((b, h) => (h.units > b.units ? h : b), visible[0]);
  const last4 = history.slice(-4).reduce((sum, h) => sum + h.units, 0);
  const before4 = history.slice(-8, -4).reduce((sum, h) => sum + h.units, 0);
  return {
    total,
    average: Math.round((total / visible.length) * 10) / 10,
    best,
    last4,
    last4Change: history.length >= 8 && before4 > 0 ? Math.round(((last4 - before4) / before4) * 1000) / 10 : null,
  };
}

// ---- Technical details (collapsed by default): method, accuracy and limitations ----

function verdictFor({ beatsNaive, beatsMovingAverage }) {
  if (beatsNaive && beatsMovingAverage)
    return { tone: "good", text: "On the test weeks, the Random Forest had a lower average error (MAE) than both simple baselines." };
  if (beatsNaive)
    return { tone: "warn", text: "The Random Forest beat the “same as last week” baseline but not the 4-week average. On this data, a simple average was as good or better." };
  if (beatsMovingAverage)
    return { tone: "warn", text: "The Random Forest beat the 4-week average but not the “same as last week” baseline. On this data, a very simple method was as good or better." };
  return { tone: "bad", text: "The Random Forest did not beat the simple baselines on the test weeks." };
}

function MetricsTable({ metrics }) {
  const rows = [
    ["Random Forest", metrics.randomForest],
    ["Same as last week (baseline)", metrics.naive],
    ["4-week average (baseline)", metrics.movingAverage],
  ];
  const best = Math.min(...rows.map(([, m]) => m.mae));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Method</th><th>MAE (units)</th><th>RMSE (units)</th><th>MAPE</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, m]) => (
            <tr key={label} className={m.mae === best ? "best" : ""}>
              <td>{label}{m.mae === best && <span className="best-tag">Lowest error</span>}</td>
              <td>{m.mae}</td>
              <td>{m.rmse}</td>
              <td>{m.mape == null ? "n/a" : `${m.mape}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TechnicalDetails({ forecast, product }) {
  return (
    <details className="panel tech">
      <summary>Technical details: method and accuracy</summary>

      <p>
        <strong>Demand</strong> is the number of units ordered per product per week (Monday to Sunday), counted by the date
        the order was placed. The data covers {forecast.weeksOfData} weeks. The current unfinished week is left out.
      </p>
      <p>
        <strong>Method:</strong> Random Forest regression. For each week it looks at the previous 4 weeks, the 4-week and
        8-week averages, and the week of the year. The model needs at least {forecast.minWeeks} weeks of history for a
        product, otherwise only a simple average is shown.
      </p>

      {product.status === "ok" ? (
        <>
          <p>
            <strong>{product.name} accuracy.</strong> The model learned from the older {product.test.trainingWeeks} weeks, then
            predicted each of the newest {product.test.weeks} weeks (from {weekLabel(product.test.startWeek)}) one week
            ahead, without having seen them. Lower errors are better.
          </p>
          <MetricsTable metrics={product.metrics} />
          <p className={`verdict verdict-${verdictFor(product.verdict).tone}`}>{verdictFor(product.verdict).text}</p>
          <ForecastChart history={product.history} testRows={product.test.rows} forecast={product.forecast} />
        </>
      ) : (
        <p>{product.name}: {product.message}</p>
      )}

      <h4>Limitations</h4>
      <ul>
        <li>Only orders placed through this website are counted, not walk-in or offline sales.</li>
        <li>The model learns from past sales only. It does not know about holidays, promotions, or events.</li>
        <li>Accuracy is measured on the most recent weeks only and does not guarantee future accuracy.</li>
        <li>Weeks 2 to 4 of a forecast build on the earlier predictions, so they are less certain than week 1.</li>
        <li>With less than two years of history, yearly seasonality cannot be confirmed.</li>
      </ul>
    </details>
  );
}

// ---- The dashboard itself (no fetching, so it can be tested with plain data) ----

export function ForecastView({ forecast, sales }) {
  const [selected, setSelected] = useState(0);
  const [range, setRange] = useState("26");
  const panelRef = useRef(null);
  const hasSales = sales.summary.orders > 0;
  const hasForecast = forecast.weeksOfData > 0;

  if (!hasSales && !hasForecast) {
    return (
      <div className="panel">
        <p>There is no sales data yet. This page fills in as customers place and pick up orders, and forecasts appear once the shop has several weeks of orders.</p>
      </div>
    );
  }

  const months = sales.monthly.slice(-12);
  const latest = sales.monthly[sales.monthly.length - 1];
  const best = sales.byProduct[0];
  const totals = forecast.totals;
  const product = forecast.products[Math.min(selected, forecast.products.length - 1)];
  const weeks = product?.outlook.weeks ?? forecast.horizon;

  // Tapping a product in the best-sellers table opens its weekly graph
  const openProduct = (name) => {
    const index = forecast.products.findIndex((p) => p.name === name);
    if (index === -1) return;
    setSelected(index);
    panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const rangeWeeks = RANGES.find(([key]) => key === range)[2];
  const visible = product && product.history.length ? product.history.slice(-rangeWeeks) : [];
  const stats = visible.length ? periodStats(product.history, visible) : null;

  return (
    <>
      <div className="stats">
        {hasForecast && (
          <>
            <div className="stat">
              <span className="stat-number">{Math.round(totals.expectedUnits).toLocaleString()}</span>
              <strong>Expected units, next {forecast.horizon} weeks</strong>
              <small className={changeClass(totals.changePct)}>{changeText(totals.changePct, forecast.horizon)}</small>
            </div>
            <div className="stat">
              <span className="stat-number">{peso(totals.expectedSales)}</span>
              <strong>Estimated sales, next {forecast.horizon} weeks</strong>
              <small>From expected units and average prices</small>
            </div>
          </>
        )}
        {hasSales && best && (
          <div className="stat">
            <span className="stat-number stat-text">{best.name}</span>
            <strong>Best seller</strong>
            <small>{best.share}% of all units sold</small>
          </div>
        )}
        {hasSales && latest && (
          <div className="stat">
            <span className="stat-number">{peso(latest.revenue)}</span>
            <strong>Sales in {monthLabel(latest.month)}</strong>
            <small>{latest.orders} completed orders</small>
          </div>
        )}
      </div>

      {hasSales && (
        <>
          <div className="panel">
            <h3>Monthly sales</h3>
            <MonthlyBars months={months} />
            <small>Revenue from completed orders, by month.</small>
          </div>

          <div className="panel">
            <h3>Best-selling products</h3>
            {hasForecast && <small>Tap a product to see its weekly sales graph.</small>}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Units sold</th><th>Share</th><th></th></tr>
                </thead>
                <tbody>
                  {sales.byProduct.map((p, i) => (
                    <tr
                      key={p.name}
                      className={hasForecast ? "clickable" : ""}
                      {...(hasForecast ? { role: "button", tabIndex: 0, onClick: () => openProduct(p.name), onKeyDown: (e) => e.key === "Enter" && openProduct(p.name) } : {})}
                    >
                      <td>{i + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.units.toLocaleString()}</td>
                      <td>{p.share}%</td>
                      <td className="bar-cell"><div className="bar"><span style={{ width: `${p.share}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {hasForecast ? (
        <>
          <div className="panel" ref={panelRef}>
            <h3>Weekly sales by product</h3>
            <div className="tabs">
              {forecast.products.map((p, i) => (
                <button type="button" key={p.productId} className={i === selected ? "tab active" : "tab"} onClick={() => setSelected(i)}>
                  {p.name}
                </button>
              ))}
            </div>

            {!stats ? (
              <p className="notice-warn">{product.message || "No sales for this product yet."}</p>
            ) : (
              <>
                <div className="tabs small">
                  {RANGES.map(([key, label]) => (
                    <button type="button" key={key} className={key === range ? "tab active" : "tab"} onClick={() => setRange(key)}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mini-stats">
                  <div className="mini"><strong>{stats.total.toLocaleString()}</strong><small>Units sold in this period</small></div>
                  <div className="mini"><strong>{stats.average}</strong><small>Average per week</small></div>
                  <div className="mini"><strong>{stats.best.units}</strong><small>Best week ({weekLabel(stats.best.week)})</small></div>
                  <div className="mini">
                    <strong>{stats.last4}</strong>
                    <small className={changeClass(stats.last4Change)}>
                      Last 4 weeks{stats.last4Change == null ? "" : ` (${stats.last4Change > 0 ? "+" : ""}${stats.last4Change}% vs the 4 before)`}
                    </small>
                  </div>
                </div>

                {product.forecast.length > 0 && (
                  <p className="outlook">
                    Expected over the next {weeks} weeks: <strong>{Math.round(product.outlook.expectedUnits)} units</strong>{" "}
                    <span className={changeClass(product.outlook.changePct)}>({changeText(product.outlook.changePct, weeks)})</span>
                    {product.outlook.expectedSales > 0 && <> · estimated sales <strong>{peso(product.outlook.expectedSales)}</strong></>}
                  </p>
                )}
                {product.status === "ok" ? (
                  <small>
                    In recent weeks, this forecast was off by about {product.outlook.typicalErrorUnits} units per week on average.
                  </small>
                ) : (
                  <p className="notice-warn">{product.message}</p>
                )}

                <WeeklyBars history={visible} forecast={product.forecast} />
                {product.forecast.length > 0 && <ForecastTable forecast={product.forecast} />}
              </>
            )}
          </div>

          <TechnicalDetails forecast={forecast} product={product} />
        </>
      ) : (
        <p className="notice-warn">Forecasts appear once the shop has several weeks of orders.</p>
      )}
    </>
  );
}

export default function AdminForecast() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    Promise.all([api("/admin/forecast?horizon=4", { token }), api("/admin/reports/sales", { token })])
      .then(([forecast, sales]) => !ignore && setData({ forecast, sales }))
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [token]);

  return (
    <>
      <h1>
        Sales Forecast <DemoTag show={data?.forecast.includesDemoData || data?.sales.includesDemoData} />
      </h1>
      <p className="subtitle">What has been selling, and what to expect in the coming weeks.</p>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p>Loading...</p>}
      {data && <ForecastView forecast={data.forecast} sales={data.sales} />}
    </>
  );
}
