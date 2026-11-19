import { createContext, useContext, useEffect, useState } from "react";
import { estimateUnit } from "../utils/format";

const CartContext = createContext(null);
const KEY = "cart";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable: the cart still works until the page reloads */
    }
  }, [items]);

  // Same product + same answers + same design = same line, so tapping again adds +1
  const addItem = ({ product, specs, details, designFile }) => {
    const lineId = `${product._id}|${JSON.stringify(specs)}|${designFile || ""}`;
    setItems((prev) => {
      if (prev.some((i) => i.lineId === lineId)) {
        return prev.map((i) =>
          i.lineId === lineId
            ? { ...i, quantity: Math.min(i.quantity + 1, 1000) }
            : i,
        );
      }
      return [
        ...prev,
        {
          lineId,
          productId: product._id,
          productName: product.name,
          examplePrice: product.examplePrice,
          pricingType: product.pricingType,
          priceUnit: product.priceUnit,
          specs,
          details,
          designFile: designFile || "",
          quantity: 1,
        },
      ];
    });
  };

  const changeQuantity = (lineId, delta) =>
    setItems((prev) =>
      prev.map((i) =>
        i.lineId === lineId
          ? { ...i, quantity: Math.max(1, Math.min(1000, i.quantity + delta)) }
          : i,
      ),
    );

  const removeItem = (lineId) =>
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  const clearCart = () => setItems([]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce(
    (sum, i) => sum + estimateUnit(i, i.specs) * i.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        total,
        addItem,
        changeQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
