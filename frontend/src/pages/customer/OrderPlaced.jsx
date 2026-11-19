import { Link, useLocation } from "react-router-dom";

// Shown to guests after they confirm an order
export default function OrderPlaced() {
  const code = useLocation().state?.code;

  return (
    <div className="placed">
      <h2>Order placed!</h2>
      {code ? (
        <>
          <p>Your order code is</p>
          <p className="placed-code">{code}</p>
          <p>
            <strong>Keep this code.</strong> To check on your order, open <Link to="/track">Track order</Link> and enter
            it with the contact number you gave. The shop will review your order and contact you at that number.
          </p>
        </>
      ) : (
        <p>The shop will review your order and contact you at the number you gave. You can check it any time on <Link to="/track">Track order</Link>.</p>
      )}
      <p className="muted-note">
        Want to chat with the shop and see all your orders in one place next time? <Link to="/register">Create an account</Link>.
        (Orders placed as a guest are not added to an account.)
      </p>
      <Link className="btn btn-primary-link" to="/">Back to products</Link>
    </div>
  );
}
