import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChartColumn, CircleCheck, Hourglass, Package, PhilippinePeso, TrendingUp, Wrench } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { STATUS_LABEL, peso } from "../../utils/format";
import { greeting, longDate, timeAgo } from "../../utils/dates";
import DemoTag from "../../components/DemoTag";
import MonthlyBars from "../../components/MonthlyBars";
import "../../dashboard.css";

const REFRESH_MS = 30_000; // the order queue refreshes by itself

const shortId = (id) => id.slice(-6).toUpperCase();
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const orderTotal = (o) => (o.finalPrice != null ? peso(o.finalPrice) : `${peso(o.estimatedTotal)} est.`);

function Kpi({ to, icon: Icon, tone, value, label, hint }) {
  return (
    <Link to={to} className={`kpi kpi-${tone}`}>
      <span className="kpi-icon" aria-hidden="true"><Icon size={22} strokeWidth={2.2} /></span>
      <div>
        <span className="kpi-value">{value}</span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </Link>
  );
}

function ForecastCard({ forecast, error }) {
  if (error) return <p className="muted">The forecast could not be loaded.</p>;
  if (!forecast) return <div className="skeleton" aria-label="Loading forecast" />;

  const t = forecast.totals;
  if (!forecast.weeksOfData || t.expectedUnits <= 0) {
    return <p className="muted">Forecasts appear once the shop has several weeks of orders.</p>;
  }
  return (
    <>
      <span className="kpi-value">{Math.round(t.expectedUnits).toLocaleString()} units</span>
      <p className="muted snapshot-line">
        expected in the next {forecast.horizon} weeks
        {t.changePct != null && (
          <> · <span className={t.changePct >= 0 ? "trend-up" : "trend-down"}>{t.changePct > 0 ? "+" : ""}{t.changePct}% vs the last {forecast.horizon} weeks</span></>
        )}
      </p>
      {t.expectedSales > 0 && <p className="snapshot-line">Estimated sales: <strong>{peso(t.expectedSales)}</strong></p>}
      <Link className="link-arrow" to="/admin/forecast">See the full forecast <ArrowRight size={16} aria-hidden="true" /></Link>
    </>
  );
}

// ---- The dashboard itself (no fetching, so it can be tested with plain data) ----
// sales / forecast: null while loading. salesError / forecastError: true if that request failed.

export function DashboardView({ summary, sales, salesError = false, forecast, forecastError = false, now = new Date() }) {
  const { counts, month } = summary;
  const waiting = counts.Pending;
  const months = sales ? sales.monthly.slice(-6) : [];
  const best = sales ? sales.byProduct.slice(0, 4) : [];
  const oldest = summary.needsAttention[0];

  return (
    <>
      <section className="hero">
        <div>
          <p className="hero-date">{longDate(now)} <DemoTag show={summary.includesDemoData} /></p>
          <h1>{greeting(now)}!</h1>
          <p>
            {waiting > 0
              ? `${plural(waiting, "order")} ${waiting === 1 ? "is" : "are"} waiting for your review.`
              : "No orders are waiting for review. Nice work."}
          </p>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-light" to="/admin/orders?status=Pending">Review orders</Link>
          <Link className="btn btn-ghost" to="/admin/forecast">See forecast</Link>
        </div>
      </section>

      <div className="kpis">
        <Kpi to="/admin/orders?status=Pending" icon={Hourglass} tone="amber" value={counts.Pending} label="Waiting for review"
          hint={oldest ? `Oldest: ${timeAgo(oldest.createdAt, now)}` : "All caught up"} />
        <Kpi to="/admin/orders?status=On%20Process" icon={Wrench} tone="blue" value={counts["On Process"]} label="In production"
          hint="Confirmed, being made" />
        <Kpi to="/admin/orders?status=Completed" icon={CircleCheck} tone="green" value={month.orders} label="Completed this month"
          hint="Picked up by customers" />
        <Kpi to="/admin/reports" icon={PhilippinePeso} tone="cyan" value={peso(month.revenue)} label="Revenue this month"
          hint={month.orders > 0 ? `${peso(month.revenue / month.orders)} per order` : "No completed orders yet"} />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <div className="panel">
            <div className="panel-head">
              <h3>Needs your attention</h3>
              <Link to="/admin/orders?status=Pending">View all</Link>
            </div>
            {summary.needsAttention.length === 0 ? (
              <p className="empty"><CircleCheck size={20} className="empty-icon" aria-hidden="true" /> All caught up. No orders are waiting for review.</p>
            ) : (
              <ul className="queue">
                {summary.needsAttention.map((o) => (
                  <li key={o._id}>
                    <div>
                      <strong>{o.contactName}</strong>
                      <small>#{shortId(o._id)} · {plural(o.itemCount, "item")} · {orderTotal(o)}</small>
                    </div>
                    <span className="queue-age">{timeAgo(o.createdAt, now)}</span>
                    <Link className="btn btn-small" to={`/admin/orders/${o._id}`}>Review</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {summary.awaitingDownPayment.length > 0 && (
            <div className="panel">
              <h3>Waiting for a down payment</h3>
              <ul className="queue">
                {summary.awaitingDownPayment.map((o) => (
                  <li key={o._id}>
                    <div>
                      <strong>{o.contactName}</strong>
                      <small>#{shortId(o._id)} · {STATUS_LABEL[o.status]}</small>
                    </div>
                    <span className="queue-age">{peso(o.downPaymentAmount)} requested</span>
                    <Link className="btn btn-small" to={`/admin/orders/${o._id}`}>Open</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h3>Sales by month</h3>
              <Link to="/admin/reports">Reports</Link>
            </div>
            {salesError ? (
              <p className="muted">Sales could not be loaded.</p>
            ) : !sales ? (
              <div className="skeleton" aria-label="Loading sales" />
            ) : months.length === 0 ? (
              <p className="muted">Sales charts appear once orders are completed.</p>
            ) : (
              <MonthlyBars months={months} />
            )}
          </div>

          <div className="panel">
            <h3>Recent orders</h3>
            {summary.recent.length === 0 ? (
              <p className="muted">No orders yet. New orders will show up here.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {summary.recent.map((o) => (
                      <tr key={o._id}>
                        <td>#{shortId(o._id)}<small style={{ display: "block" }}>{timeAgo(o.createdAt, now)}</small></td>
                        <td>{o.contactName}</td>
                        <td>{orderTotal(o)}</td>
                        <td><span className={`badge badge-${o.status.replace(" ", "-")}`}>{STATUS_LABEL[o.status]}</span></td>
                        <td><Link to={`/admin/orders/${o._id}`}>View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="dash-col">
          <div className="panel">
            <h3>What to expect</h3>
            <ForecastCard forecast={forecast} error={forecastError} />
          </div>

          <div className="panel">
            <h3>Best sellers</h3>
            {salesError ? (
              <p className="muted">Sales could not be loaded.</p>
            ) : !sales ? (
              <div className="skeleton" aria-label="Loading best sellers" />
            ) : best.length === 0 ? (
              <p className="muted">Best sellers appear once orders are completed.</p>
            ) : (
              <ol className="rank">
                {best.map((p) => (
                  <li key={p.name}>
                    <div className="rank-top"><strong>{p.name}</strong><small>{p.units.toLocaleString()} units · {p.share}%</small></div>
                    <div className="bar"><span style={{ width: `${p.share}%` }} /></div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="panel">
            <h3>Shortcuts</h3>
            <div className="links">
              <Link to="/admin/orders"><Package size={18} aria-hidden="true" /> All orders</Link>
              <Link to="/admin/reports"><ChartColumn size={18} aria-hidden="true" /> Sales reports</Link>
              <Link to="/admin/forecast"><TrendingUp size={18} aria-hidden="true" /> Sales forecast</Link>
         </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [sales, setSales] = useState(null);
  const [salesError, setSalesError] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [forecastError, setForecastError] = useState(false);

  useEffect(() => {
    let ignore = false;
    const loadSummary = () =>
      api("/admin/dashboard", { token })
        .then((d) => !ignore && (setSummary(d), setError("")))
        .catch((err) => !ignore && setError(`Backend refused: ${err.message}`));

    // The order queue loads first and refreshes by itself. The charts load in the background.
    loadSummary();
    api("/admin/reports/sales", { token }).then((d) => !ignore && setSales(d)).catch(() => !ignore && setSalesError(true));
    api("/admin/forecast?horizon=4", { token }).then((d) => !ignore && setForecast(d)).catch(() => !ignore && setForecastError(true));

    const timer = setInterval(loadSummary, REFRESH_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [token]);

  if (error && !summary) {
    return (
      <>
        <h1>Dashboard</h1>
        <p className="error">{error}</p>
      </>
    );
  }
  if (!summary) return <p>Loading...</p>;

  return <DashboardView summary={summary} sales={sales} salesError={salesError} forecast={forecast} forecastError={forecastError} />;
}
