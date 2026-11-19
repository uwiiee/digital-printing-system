import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import OrderSummary from "../../components/OrderSummary";
import { STATUS_LABEL } from "../../utils/format";

// For guests: look up an order with its code and the contact number given when ordering
export default function TrackOrder() {
  const [form, setForm] = useState({ code: "", contactNumber: "" });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      setOrder(await api("/orders/track", { method: "POST", body: form }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form className="form" onSubmit={handleSubmit}>
        <h2>Track your order</h2>
        <small>For orders placed without an account. Enter the order code you were given and the contact number you used.</small>
        <input name="code" placeholder="Order code (e.g. K7P3XQ)" value={form.code} onChange={handleChange} autoCapitalize="characters" required />
        <input name="contactNumber" placeholder="Contact number" value={form.contactNumber} onChange={handleChange} required />
        {error && <p className="error">{error}</p>}
        <button disabled={loading}>{loading ? "Looking..." : "Track order"}</button>
        <small>Have an account? <Link to="/login">Log in</Link> to see your orders and chat with the shop.</small>
      </form>

      {order && (
        <div className="card order">
          <div className="row">
            <strong>Order #{order.code}</strong>
            <span className={`badge badge-${order.status.replace(" ", "-")}`}>{STATUS_LABEL[order.status]}</span>
          </div>
          <small>Placed {new Date(order.createdAt).toLocaleString()}</small>
          <OrderSummary order={order} />
          {order.status === "Pending" && <p className="muted-note">The shop is reviewing your order and will contact you at your number.</p>}
          {order.status === "On Process" && <p className="muted-note">Your order is being made. The shop will contact you when it is ready for pickup.</p>}
          {order.status === "Completed" && <p className="muted-note">This order is complete. Thank you!</p>}
        </div>
      )}
    </>
  );
}
