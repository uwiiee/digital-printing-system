import Order from "../models/Order.js";

// True when the chosen dataset includes generated demo orders (so the screens can show a small tag)
export async function includesDemo(sourceName) {
  return sourceName !== "real" && (await Order.exists({ isSample: true })) !== null;
}
