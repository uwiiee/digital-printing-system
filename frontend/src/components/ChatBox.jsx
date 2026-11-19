import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../chat.css";

const POLL_MS = 5000; // new messages show up within a few seconds
const MAX_LENGTH = 1000;

const timeLabel = (iso) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// role = which side is looking: "customer" or "admin"
export default function ChatBox({ orderId, role }) {
  const { token } = useAuth();
  const path = role === "admin" ? `/admin/orders/${orderId}/messages` : `/orders/${orderId}/messages`;
  const other = role === "admin" ? "Customer" : "Shop";

  const [messages, setMessages] = useState(null); // null = still loading
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const stickToBottom = useRef(true); // stay on the newest message, unless the reader scrolled up

  const load = useCallback(async () => {
    try {
      const data = await api(path, { token });
      setMessages(data.messages);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [path, token]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(); // no polling in a hidden tab
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const el = listRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await api(path, { method: "POST", token, body: { text: value } });
      setMessages((prev) => [...(prev || []), message]);
      setText("");
      stickToBottom.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) handleSend(e); // Enter sends, Shift+Enter makes a new line
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} onScroll={handleScroll} aria-live="polite">
        {messages === null && !error && <p className="chat-empty">Loading messages...</p>}
        {messages?.length === 0 && (
          <p className="chat-empty">
            {role === "admin" ? "No messages yet." : "No messages yet. Ask the shop anything about this order."}
          </p>
        )}
        {messages?.map((m) => {
          const mine = m.sender === role;
          return (
            <div key={m._id} className={`bubble-row ${mine ? "mine" : "theirs"}`}>
              <div className={`bubble ${mine ? "bubble-mine" : "bubble-theirs"}`}>
                {!mine && <strong className="bubble-who">{other}</strong>}
                <span className="bubble-text">{m.text}</span>
                <small>{timeLabel(m.createdAt)}</small>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}

      <form className="chat-form" onSubmit={handleSend}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_LENGTH}
          rows={2}
          placeholder="Write a message..."
          aria-label="Write a message"
        />
        <button disabled={sending || !text.trim()} aria-label="Send message">
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
