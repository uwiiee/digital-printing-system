import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, FILE_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { STATUS_LABEL, labelFromKey, peso } from "../../utils/format";

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [price, setPrice] = useState("");
  const [dpRequested, setDpRequested] = useState(false);
  const [dpAmount, setDpAmount] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Puts a fresh copy of the order on screen and resets the form to match it
  const applyOrder = useCallback((o) => {
    setOrder(o);
    setPrice(String(o.finalPrice ?? o.estimatedTotal));
    setDpRequested(o.downPayment.requested);
    setDpAmount(o.downPayment.requested ? String(o.downPayment.amount) : "");
  }, []);

  useEffect(() => {
    api(`/admin/orders/${id}`, { token })
      .then(applyOrder)
      .catch((err) => setError(err.message));
  }, [id, token, applyOrder]);

  const run = async (action, success) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      applyOrder(await action());
      setMessage(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePricing = () =>
    api(`/admin/orders/${id}/pricing`, {
      method: "PATCH",
      token,
      body: {
        finalPrice: price,
        downPayment: { requested: dpRequested, amount: dpAmount },
      },
    });

  const handleSave = () => run(savePricing, "Price saved.");

  const handleConfirm = () =>
    run(async () => {
      await savePricing(); // saves what's on screen first, so the confirmed price is the visible one
      return api(`/admin/orders/${id}/confirm`, { method: "POST", token });
    }, "Order confirmed. It is now On Process.");

  const handleReceived = () =>
    run(
      () =>
        api(`/admin/orders/${id}/down-payment-received`, {
          method: "PATCH",
          token,
          body: { received: !order.downPayment.received },
        }),
      "Down payment updated.",
    );

  const handleComplete = () => {
    if (
      !window.confirm(
        "Mark this order as completed? Do this once the customer has picked it up.",
      )
    )
      return;
    run(
      () => api(`/admin/orders/${id}/complete`, { method: "POST", token }),
      "Order marked as completed.",
    );
  };

  if (!order) {
    return error ? (
      <>
        <p className="error">{error}</p>
        <Link to="/admin/orders">Back to orders</Link>
      </>
    ) : (
      <p>Loading...</p>
    );
  }

  const locked = order.status === "Completed";
  const dpReceived = order.downPayment.received;

  return (
    <>
      <p>
        <Link to="/admin/orders">&larr; Back to orders</Link>
      </p>
      <div className="row">
        <h1 style={{ margin: 0 }}>
          Order #{order._id.slice(-6).toUpperCase()}
        </h1>
        <span className={`badge badge-${order.status.replace(" ", "-")}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </div>
      <small>Placed {new Date(order.createdAt).toLocaleString()}</small>

      <div className="panel">
        <h3>Customer</h3>
        <p>
          {order.contactName} · {order.contactNumber}
          <small style={{ display: "block" }}>
            Account: {order.customer?.email}
          </small>
        </p>
        {order.notes && (
          <p>
            <strong>Notes:</strong> {order.notes}
          </p>
        )}
      </div>

      <div className="panel">
        <h3>Items</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Details</th>
                <th>Design</th>
                <th>Qty</th>
                <th>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i, idx) => (
                <tr key={idx}>
                  <td>{i.productName}</td>
                  <td>
                    {Object.entries(i.specs).map(([k, v]) => (
                      <small key={k} style={{ display: "block" }}>
                        {labelFromKey(k)}: {v}
                      </small>
                    ))}
                  </td>
                  <td>
                    {i.designFile ? (
                      <a
                        href={FILE_URL + i.designFile}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          className="thumb"
                          src={FILE_URL + i.designFile}
                          alt="Customer design"
                        />
                      </a>
                    ) : (
                      <small>None (sample design)</small>
                    )}
                  </td>
                  <td>{i.quantity}</td>
                  <td>{peso(i.estimatedUnitPrice * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Estimated total: {peso(order.estimatedTotal)}</strong>
        </p>
      </div>

      <div className="panel">
        <h3>Price and down payment</h3>
        <div className="admin-form">
          <label>
            Final price (₱)
            <input
              type="number"
              min="0"
              step="any"
              value={price}
              disabled={locked}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>

          {dpReceived ? (
            <p className="notice">
              Down payment of {peso(order.downPayment.amount)} received.
            </p>
          ) : (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={dpRequested}
                  disabled={locked}
                  onChange={(e) => setDpRequested(e.target.checked)}
                />
                Request a down payment (GCash)
              </label>
              {dpRequested && (
                <label>
                  Down payment amount (₱)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={dpAmount}
                    disabled={locked}
                    onChange={(e) => setDpAmount(e.target.value)}
                  />
                </label>
              )}
            </>
          )}

          {error && <p className="error">{error}</p>}
          {message && <p className="notice">{message}</p>}

          <div className="actions">
            {!locked && (
              <button type="button" disabled={busy} onClick={handleSave}>
                Save price
              </button>
            )}
            {order.status === "Pending" && (
              <button disabled={busy} onClick={handleConfirm}>
                Confirm order
              </button>
            )}
            {order.downPayment.requested && !locked && (
              <button type="button" disabled={busy} onClick={handleReceived}>
                {dpReceived
                  ? "Undo: down payment received"
                  : "Mark down payment received"}
              </button>
            )}
            {order.status === "On Process" && (
              <button disabled={busy} onClick={handleComplete}>
                Mark as completed (picked up)
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
