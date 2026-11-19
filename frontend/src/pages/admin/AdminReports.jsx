import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { peso } from "../../utils/format";
import { monthLabel } from "../../utils/dates";
import DemoTag from "../../components/DemoTag";

export default function AdminReports() {
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    api("/admin/reports/sales", { token })
      .then((d) => !ignore && setReport(d))
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [token]);

  const maxRevenue = report ? Math.max(1, ...report.monthly.map((m) => m.revenue)) : 1;
  const empty = report && report.summary.orders === 0;

  return (
    <>
      <h1>
        Sales Reports <DemoTag show={report?.includesDemoData} />
      </h1>
      {error && <p className="error">{error}</p>}
      {!report && !error && <p>Loading...</p>}

      {empty && (
        <div className="panel">
          <p>No completed orders yet. Reports are built from orders marked as completed (picked up).</p>
        </div>
      )}

      {report && !empty && (
        <>
          <div className="stats">
            <div className="stat"><span className="stat-number">{peso(report.summary.revenue)}</span><strong>Revenue</strong><small>Final prices of completed orders</small></div>
            <div className="stat"><span className="stat-number">{report.summary.orders.toLocaleString()}</span><strong>Completed orders</strong></div>
            <div className="stat"><span className="stat-number">{report.summary.units.toLocaleString()}</span><strong>Units sold</strong></div>
            <div className="stat"><span className="stat-number">{peso(report.summary.averageOrderValue)}</span><strong>Average order</strong></div>
          </div>

          <div className="panel">
            <h3>Sales by month</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Month</th><th>Orders</th><th>Units</th><th>Revenue</th><th></th></tr>
                </thead>
                <tbody>
                  {[...report.monthly].reverse().map((m) => (
                    <tr key={m.month}>
                      <td>{monthLabel(m.month)}</td>
                      <td>{m.orders}</td>
                      <td>{m.units}</td>
                      <td>{peso(m.revenue)}</td>
                      <td className="bar-cell"><div className="bar"><span style={{ width: `${(m.revenue / maxRevenue) * 100}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small>Grouped by the month the order was completed.</small>
          </div>

          <div className="panel">
            <h3>Units sold by product</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Product</th><th>Units</th><th>Share</th><th></th></tr>
                </thead>
                <tbody>
                  {report.byProduct.map((p) => (
                    <tr key={p.name}>
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
    </>
  );
}
