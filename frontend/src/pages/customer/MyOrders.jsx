import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, FILE_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { STATUS_LABEL, labelFromKey, peso } from "../../utils/format";

export default function MyOrders() {
  const { token } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/orders/mine", { token })
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <>
      <h2>My Orders</h2>
      {location.state?.placed && (
        <p className="notice">
          Order placed! The shop will review it and confirm.
        </p>
      )}
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && orders.length === 0 && <p>You have no orders yet.</p>}

      {orders.map((o) => (
        <div className="card order" key={o._id}>
          <div className="row">
            <strong>Order #{o._id.slice(-6).toUpperCase()}</strong>
            <span className={`badge badge-${o.status.replace(" ", "-")}`}>
              {STATUS_LABEL[o.status]}
            </span>
          </div>
          <small>{new Date(o.createdAt).toLocaleString()}</small>

          <ul>
            {o.items.map((i, idx) => (
              <li key={idx}>
                {i.quantity} × {i.productName}
                <small style={{ display: "block" }}>
                  {Object.entries(i.specs)
                    .map(([k, v]) => `${labelFromKey(k)}: ${v}`)
                    .join(", ")}
                </small>
                {i.designFile && (
                  <a
                    href={FILE_URL + i.designFile}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View design
                  </a>
                )}
              </li>
            ))}
          </ul>

          <p>
            Estimated total: {peso(o.estimatedTotal)}
            {o.finalPrice != null && (
              <>
                {" "}
                · <strong>Final price: {peso(o.finalPrice)}</strong>
              </>
            )}
          </p>
          {o.downPayment?.requested && (
            <p>
              Down payment requested: {peso(o.downPayment.amount)} (
              {o.downPayment.received ? "received" : "not yet received"})
            </p>
          )}
        </div>
      ))}
    </>
  );
}
