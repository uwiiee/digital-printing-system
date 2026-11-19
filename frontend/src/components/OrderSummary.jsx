import { FILE_URL } from "../services/api";
import { labelFromKey, peso } from "../utils/format";

// The items and prices of an order. Used for a customer's orders and for guest tracking.
export default function OrderSummary({ order }) {
  return (
    <>
      <ul>
        {order.items.map((i, idx) => (
          <li key={idx}>
            {i.quantity} × {i.productName}
            <small style={{ display: "block" }}>
              {Object.entries(i.specs).map(([k, v]) => `${labelFromKey(k)}: ${v}`).join(", ")}
            </small>
            {i.designFile && (
              <a href={FILE_URL + i.designFile} target="_blank" rel="noreferrer">View design</a>
            )}
          </li>
        ))}
      </ul>

      <p>
        Estimated total: {peso(order.estimatedTotal)}
        {order.finalPrice != null && <> · <strong>Final price: {peso(order.finalPrice)}</strong></>}
      </p>
      {order.downPayment?.requested && (
        <p>
          Down payment requested: {peso(order.downPayment.amount)} (
          {order.downPayment.received ? "received" : "not yet received"})
        </p>
      )}
    </>
  );
}
