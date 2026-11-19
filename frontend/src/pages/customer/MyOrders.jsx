import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import ChatBox from "../../components/ChatBox";
import OrderSummary from "../../components/OrderSummary";
import { STATUS_LABEL } from "../../utils/format";
import { orderLabel } from "../../utils/orders";

const REFRESH_MS = 30_000; // status changes and new-message badges refresh by themselves

export default function MyOrders() {
  const { token } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openChat, setOpenChat] = useState(null); // id of the order whose chat is open

  useEffect(() => {
    let ignore = false;
    const load = () =>
      api("/orders/mine", { token })
        .then((d) => !ignore && (setOrders(d), setError("")))
        .catch((err) => !ignore && setError(err.message))
        .finally(() => !ignore && setLoading(false));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [token]);

  // Opening a chat reads the messages, so its badge goes away
  const toggleChat = (id) => {
    const closing = openChat === id;
    setOpenChat(closing ? null : id);
    if (!closing) setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, unreadForCustomer: 0 } : o)));
  };

  return (
    <>
      <h2>My Orders</h2>
      {location.state?.placed && (
        <p className="notice">Order placed! The shop will review it and message you here. Open the chat on your order to talk to them.</p>
      )}
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && orders.length === 0 && <p>You have no orders yet.</p>}

      {orders.map((o) => (
        <div className="card order" key={o._id}>
          <div className="row">
            <strong>Order #{orderLabel(o)}</strong>
            <span className={`badge badge-${o.status.replace(" ", "-")}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <small>{new Date(o.createdAt).toLocaleString()}</small>

          <OrderSummary order={o} />

          <button type="button" className="chat-toggle" onClick={() => toggleChat(o._id)}>
            <MessageCircle size={16} aria-hidden="true" />
            {openChat === o._id ? "Hide chat" : "Chat with the shop"}
            {o.unreadForCustomer > 0 && openChat !== o._id && <span className="unread-badge">{o.unreadForCustomer}</span>}
          </button>
          {openChat === o._id && <ChatBox orderId={o._id} role="customer" />}
        </div>
      ))}
    </>
  );
}
