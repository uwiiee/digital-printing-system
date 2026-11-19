import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, FILE_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { estimateUnit, peso } from "../../utils/format";

const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

export default function Cart() {
  const { user, token } = useAuth();
  const { items, total, changeQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  const guest = !user;
  const isAdmin = user?.role === "admin";

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
    // Guests leave a name and number. A logged-in customer doesn't: the shop chats with them.
    if (guest) {
      if (contactName.trim().length < 2) return setError("Enter your name");
      if (!PHONE_REGEX.test(contactNumber.trim())) return setError("Enter a valid contact number");
    }

    setSubmitting(true);
    try {
      const order = await api("/orders", {
        method: "POST",
        token, // undefined for a guest
        body: {
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            specs: i.specs,
            designFile: i.designFile,
          })),
          notes,
          ...(guest ? { contactName, contactNumber } : {}),
        },
      });
      clearCart();
      if (guest) navigate("/order-placed", { state: { code: order.code } });
      else navigate("/orders", { state: { placed: true } });
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
                  <small key={d.label} style={{ display: "block" }}>{d.label}: {d.value}</small>
                ))}
              </div>
              {i.designFile && <img className="thumb" src={FILE_URL + i.designFile} alt="Design" />}
            </div>
            <div className="qty">
              <button onClick={() => changeQuantity(i.lineId, -1)}>-</button>
              <span>{i.quantity}</span>
              <button onClick={() => changeQuantity(i.lineId, 1)}>+</button>
            </div>
            <div className="line-total">{peso(estimateUnit(i, i.specs) * i.quantity)}</div>
            <button onClick={() => removeItem(i.lineId)}>Remove</button>
          </div>
        ))}
      </div>

      <p className="estimate">
        Estimated total: <strong>{peso(total)}</strong>{" "}
        <small>(example prices; the shop confirms the final price after reviewing your order)</small>
      </p>

      {isAdmin ? (
        <p className="notice-warn">You are logged in as the admin. Log out to place an order as a customer.</p>
      ) : (
        <div className="form" style={{ margin: "1rem 0" }}>
          {guest ? (
            <>
              <p className="muted-note">
                Ordering without an account? Leave your name and number so the shop can reach you.
                You can also <Link to="/register">create an account</Link> or <Link to="/login">log in</Link> to
                skip this and chat with the shop instead.
              </p>
              <input placeholder="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              <input placeholder="Contact number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            </>
          ) : (
            <p className="muted-note">
              Ordering as <strong>{user.email}</strong>. The shop will message you about the price and details.
              You can chat with them from <Link to="/orders">My Orders</Link> after you confirm.
            </p>
          )}
          <textarea placeholder="Notes for the shop (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button disabled={submitting} onClick={handleConfirm}>
            {submitting ? "Placing order..." : "Confirm order"}
          </button>
        </div>
      )}
    </>
  );
}
