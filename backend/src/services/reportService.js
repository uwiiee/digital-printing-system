// Sales reports: built from COMPLETED orders only, grouped by the month they were completed
// (Philippine time). The forecast uses a different date (the order date): see salesData.js.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const round2 = (n) => Math.round(n * 100) / 100;

const monthKey = (date) => new Date(new Date(date).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 7);

function nextMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// orders: [{ finalPrice, completedAt, createdAt, items: [{ productName, quantity }] }]
export function summarizeSales(orders) {
  const months = new Map();
  const products = new Map();
  let revenue = 0;
  let units = 0;

  for (const o of orders) {
    const price = o.finalPrice ?? 0;
    const qty = o.items.reduce((sum, i) => sum + i.quantity, 0);
    revenue += price;
    units += qty;

    const key = monthKey(o.completedAt || o.createdAt);
    const m = months.get(key) || { month: key, orders: 0, revenue: 0, units: 0 };
    m.orders += 1;
    m.revenue += price;
    m.units += qty;
    months.set(key, m);

    for (const i of o.items) products.set(i.productName, (products.get(i.productName) || 0) + i.quantity);
  }

  // Include months with no sales, so the table has no gaps
  const keys = [...months.keys()].sort();
  const monthly = [];
  if (keys.length) {
    for (let k = keys[0]; k <= keys[keys.length - 1]; k = nextMonth(k)) {
      const m = months.get(k) || { month: k, orders: 0, revenue: 0, units: 0 };
      monthly.push({ ...m, revenue: round2(m.revenue) });
    }
  }

  const byProduct = [...products]
    .map(([name, u]) => ({ name, units: u, share: units ? Math.round((u / units) * 1000) / 10 : 0 }))
    .sort((a, b) => b.units - a.units);

  return {
    summary: {
      orders: orders.length,
      revenue: round2(revenue),
      units,
      averageOrderValue: orders.length ? round2(revenue / orders.length) : 0,
    },
    monthly,
    byProduct,
  };
}

// Average example price of ONE unit of each product, from the orders given.
// Used for "estimated sales" in the forecast: units expected x this price.
export function averageUnitPrices(orders) {
  const totals = new Map();
  for (const o of orders) {
    for (const i of o.items) {
      const key = String(i.product);
      const t = totals.get(key) || { amount: 0, qty: 0 };
      t.amount += (i.estimatedUnitPrice ?? 0) * i.quantity;
      t.qty += i.quantity;
      totals.set(key, t);
    }
  }
  return new Map([...totals].map(([key, t]) => [key, t.qty ? t.amount / t.qty : 0]));
}
