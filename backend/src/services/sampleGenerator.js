import { estimateUnitPrice } from "./orderService.js";
import { addWeeks, weekStartKey } from "./salesData.js";

// SAMPLE DATA ONLY. Every pattern below (levels, seasons, spikes) is INVENTED by this file.
// It exists to demonstrate the screens and the forecasting pipeline, never to measure real demand.

const DAY = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Small seeded random generator, so the same seed always gives the same sample data
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PATTERNS = {
  Jersey: { base: 24, trend: 0.004, amp: 0.3, peakWeek: 36, noise: 0.18, maxChunk: 6 },
  Tarpaulin: { base: 12, trend: 0.002, amp: 0.2, peakWeek: 20, noise: 0.25, maxChunk: 3 },
  "Warmer with Hoodie": { base: 9, trend: 0.003, amp: 0.55, peakWeek: 46, noise: 0.25, maxChunk: 4 },
  Decals: { base: 16, trend: 0.005, amp: 0.12, peakWeek: 10, noise: 0.2, maxChunk: 10 },
};
const DEFAULT_PATTERN = { base: 10, trend: 0.003, amp: 0.2, peakWeek: 26, noise: 0.2, maxChunk: 4 };

const SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
const SIZE_WEIGHTS = [0.05, 0.15, 0.3, 0.28, 0.15, 0.07];
const COLORS = ["Blue", "Red", "Black", "White", "Green", "Yellow"];

function weekOfYear(key) {
  const d = new Date(`${key}T00:00:00Z`);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / (7 * DAY));
}

export function generateSampleOrders({ products, customerId, now = new Date(), weeks = 104, seed = 2026 }) {
  const rng = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const weighted = (arr, w) => {
    let r = rng();
    for (let i = 0; i < arr.length; i++) if ((r -= w[i]) <= 0) return arr[i];
    return arr[arr.length - 1];
  };

  const specsFor = (name) => {
    if (name === "Tarpaulin") return { width: pick([2, 3, 4, 5, 6, 8]), height: pick([3, 4, 6, 8]) };
    if (name === "Decals") return { width: pick([2, 3, 4, 6, 8]), height: pick([2, 3, 4, 6, 8]) };
    return { size: weighted(SIZES, SIZE_WEIGHTS), color: pick(COLORS) };
  };

  const lastWeek = addWeeks(weekStartKey(now), -1);
  const firstWeek = addWeeks(lastWeek, -(weeks - 1));
  const orders = [];

  for (let w = 0; w < weeks; w++) {
    const weekKey = addWeeks(firstWeek, w);
    const weekStartMs = Date.parse(`${weekKey}T00:00:00Z`) - MANILA_OFFSET_MS; // Monday 00:00 Manila time

    for (const product of products) {
      const p = PATTERNS[product.name] || DEFAULT_PATTERN;
      const season = 1 + p.amp * Math.cos((2 * Math.PI * (weekOfYear(weekKey) - p.peakWeek)) / 52);
      const spike = rng() < 0.04 ? 1.8 : 1; // an occasional bulk order
      const units = Math.max(0, Math.round(p.base * (1 + p.trend * w) * season * (1 + p.noise * gauss()) * spike));

      let remaining = units;
      while (remaining > 0) {
        const quantity = Math.min(remaining, 1 + Math.floor(rng() * p.maxChunk));
        remaining -= quantity;

        const createdAt = new Date(weekStartMs + rng() * 7 * DAY - 1); // inside this week
        const confirmedAt = new Date(Math.min(createdAt.getTime() + DAY, now.getTime()));
        const completedAt = new Date(Math.min(createdAt.getTime() + (3 + Math.floor(rng() * 5)) * DAY, now.getTime()));

        const specs = specsFor(product.name);
        const estimatedUnitPrice = estimateUnitPrice(product, specs);
        const estimatedTotal = Math.round(estimatedUnitPrice * quantity * 100) / 100;

        orders.push({
          customer: customerId,
          items: [
            {
              product: product._id,
              productName: product.name,
              examplePrice: product.examplePrice,
              priceUnit: product.priceUnit,
              estimatedUnitPrice,
              specs,
              quantity,
              designFile: "",
            },
          ],
          notes: "",
          contactName: "Sample Customer",
          contactNumber: "0000000000",
          status: "Completed",
          estimatedTotal,
          finalPrice: Math.round(estimatedTotal / 10) * 10,
          downPayment: { requested: false, amount: 0, received: false },
          confirmedAt,
          completedAt,
          isSample: true,
          createdAt,
          updatedAt: completedAt,
        });
      }
    }
  }
  return orders;
}
