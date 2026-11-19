// Weekly demand = units ordered per product per week (Monday to Sunday, Philippine time),
// counted by the date the order was placed. The current, unfinished week is left out.

const DAY = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, no daylight saving

// Monday of the week the date falls in (Manila time), as "YYYY-MM-DD"
export function weekStartKey(date) {
  const t = new Date(new Date(date).getTime() + MANILA_OFFSET_MS);
  const dayFromMonday = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayFromMonday);
  return t.toISOString().slice(0, 10);
}

export function addWeeks(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

// orders: [{ createdAt, items: [{ product, quantity }] }]  products: [{ _id, name }]
export function buildWeeklyDemand(orders, products, now = new Date()) {
  const lastWeek = addWeeks(weekStartKey(now), -1); // the last complete week
  const byProduct = new Map(products.map((p) => [String(p._id), p]));

  let first = null;
  for (const o of orders) {
    const key = weekStartKey(o.createdAt);
    if (key <= lastWeek && (first === null || key < first)) first = key;
  }
  if (first === null) {
    return { weeks: [], series: products.map((p) => ({ productId: String(p._id), name: p.name, values: [] })) };
  }

  const count = Math.round((Date.parse(lastWeek) - Date.parse(first)) / (7 * DAY)) + 1;
  const weeks = Array.from({ length: count }, (_, i) => addWeeks(first, i));
  const values = new Map(products.map((p) => [String(p._id), new Array(count).fill(0)]));

  for (const o of orders) {
    const key = weekStartKey(o.createdAt);
    if (key > lastWeek) continue;
    const idx = Math.round((Date.parse(key) - Date.parse(first)) / (7 * DAY));
    for (const item of o.items) {
      const arr = values.get(String(item.product));
      if (arr) arr[idx] += item.quantity;
    }
  }

  return {
    weeks,
    series: products.map((p) => ({ productId: String(p._id), name: p.name, values: values.get(String(p._id)) })),
  };
}
