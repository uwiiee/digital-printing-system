import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { STATUS_LABEL, peso } from "../../utils/format";
import { orderLabel } from "../../utils/orders";

const TABS = [
  ["", "All"],
  ["Pending", "Pending"],
  ["On Process", "On Process"],
  ["Completed", "Transaction Complete"],
];

export default function AdminOrders() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    api(`/admin/orders${query}`, { token })
      .then((d) => !ignore && setOrders(d))
      .catch((err) => !ignore && setError(err.message))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [status, token]);

  return (
    <>
      <h1>Orders</h1>

      <div className="tabs">
        {TABS.map(([value, label]) => (
          <button
            type="button"
            key={label}
            className={status === value ? "tab active" : "tab"}
            onClick={() => setParams(value ? { status: value } : {})}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && orders.length === 0 && <p>No orders here.</p>}

      {orders.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Estimated</th>
                <th>Final</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td>#{orderLabel(o)}</td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td>
                    {o.customer ? (
                      <>
                        {o.customer.email}
                        {o.unreadForAdmin > 0 && <> <span className="unread-badge" title="Unread messages">{o.unreadForAdmin}</span></>}
                      </>
                    ) : (
                      <>
                        {o.contactName}
                        <span className="guest-tag">Guest</span>
                        <small style={{ display: "block" }}>{o.contactNumber}</small>
                      </>
                    )}
                  </td>
                  <td>{o.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
                  <td>{peso(o.estimatedTotal)}</td>
                  <td>{o.finalPrice != null ? peso(o.finalPrice) : "-"}</td>
                  <td>
                    <span className={`badge badge-${o.status.replace(" ", "-")}`}>{STATUS_LABEL[o.status]}</span>
                  </td>
                  <td><Link to={`/admin/orders/${o._id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
