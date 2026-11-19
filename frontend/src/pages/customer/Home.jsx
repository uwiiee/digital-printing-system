import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import AddToCartModal from "../../components/AddToCartModal";
import { peso } from "../../utils/format";

export default function Home() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api("/products")
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = (product) => {
    // Ordering needs a customer login (design uploads and orders are tied to the account)
    if (!user || user.role !== "customer") {
      navigate("/login", { state: { from: location } });
      return;
    }
    setSelected(product);
  };

  const handleConfirmAdd = (entry) => {
    addItem(entry);
    setSelected(null);
    setToast(`${entry.product.name} added to cart`);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <>
      <h1>Digital Printing Services</h1>
      <p>
        Pick your items, review your cart, and pick up your order at the shop.
      </p>

      {loading && <p>Loading products...</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p._id}>
            {p.imageUrl && (
              <img className="card-img" src={p.imageUrl} alt={p.name} />
            )}
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <p>
              <strong>{peso(p.examplePrice)}</strong>{" "}
              <small>{p.priceUnit} (example price)</small>
            </p>
            <button onClick={() => handleAdd(p)}>Add</button>
          </div>
        ))}
      </div>

      {selected && (
        <AddToCartModal
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={handleConfirmAdd}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
