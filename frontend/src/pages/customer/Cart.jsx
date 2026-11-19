import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, FILE_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { estimateUnit, peso } from "../../utils/format";

const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

export default function Cart() {
  const { token } = useAuth();
  const { items, total, changeQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <>
        <h2>Your cart is empty</h2>
        <Link to="/">Browse products</Link>
      </>
    );
  }

  const handleConfirm = async () => {
    setError("");
    if (contactName.trim().length < 2) return setError("Enter your name");
    if (!PHONE_REGEX.test(contactNumber.trim()))
      return setError("Enter a valid contact number");

    setSubmitting(true);
    try {
      await api("/orders", {
        method: "POST",
        token,
        body: {
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            specs: i.specs,
            designFile: i.designFile,
          })),
          notes,
          contactName,
          contactNumber,
        },
      });
      clearCart();
      navigate("/orders", { state: { placed: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h2>Review your cart</h2>

      <div className="cart">
        {items.map((i) => (
          <div className="cart-line" key={i.lineId}>
            <div>
              <strong>{i.productName}</strong>
              <div>
                {i.details.map((d) => (
                  <small key={d.label} style={{ display: "block" }}>
                    {d.label}: {d.value}
                  </small>
                ))}
              </div>
              {i.designFile && (
                <img
                  className="thumb"
                  src={FILE_URL + i.designFile}
                  alt="Design"
                />
              )}
            </div>
            <div className="qty">
              <button onClick={() => changeQuantity(i.lineId, -1)}>-</button>
              <span>{i.quantity}</span>
              <button onClick={() => changeQuantity(i.lineId, 1)}>+</button>
            </div>
            <div className="line-total">
              {peso(estimateUnit(i, i.specs) * i.quantity)}
            </div>
            <button onClick={() => removeItem(i.lineId)}>Remove</button>
          </div>
        ))}
      </div>

      <p className="estimate">
        Estimated total: <strong>{peso(total)}</strong>{" "}
        <small>
          (example prices; the shop confirms the final price after reviewing
          your order)
        </small>
      </p>

      <div className="form" style={{ margin: "1rem 0" }}>
        <input
          placeholder="Your name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <input
          placeholder="Contact number"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
        />
        <textarea
          placeholder="Notes for the shop (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button disabled={submitting} onClick={handleConfirm}>
          {submitting ? "Placing order..." : "Confirm order"}
        </button>
      </div>
    </>
  );
}
