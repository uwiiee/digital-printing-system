import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { buildWeeklyDemand } from "../services/salesData.js";
import { MIN_WEEKS, forecastAll, summarizeOutlook, summarizeTotals } from "../services/forecastService.js";
import { averageUnitPrices, summarizeSales } from "../services/reportService.js";
import { resolveSource } from "../services/dataSource.js";
import { includesDemo } from "../services/demoData.js";

export async function salesReport(req, res, next) {
  try {
    const { name, filter } = resolveSource(req.query);
    const orders = await Order.find({ ...filter, status: "Completed" })
      .select("finalPrice completedAt createdAt items.productName items.quantity")
      .lean();
    res.json({ source: name, includesDemoData: await includesDemo(name), ...summarizeSales(orders) });
  } catch (err) {
    next(err);
  }
}

export async function forecast(req, res, next) {
  try {
    const { name, filter } = resolveSource(req.query);

    const horizon = req.query.horizon === undefined ? 4 : Number(req.query.horizon);
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > 8)
      return res.status(400).json({ message: "horizon must be a whole number from 1 to 8" });

    const [products, orders] = await Promise.all([
      Product.find({ isActive: true }).sort("sortOrder").select("name").lean(),
      // Demand counts every order placed (any status); there is no cancel or reject
      Order.find(filter).select("createdAt items.product items.quantity items.estimatedUnitPrice").lean(),
    ]);

    const weekly = buildWeeklyDemand(orders, products);
    const prices = averageUnitPrices(orders);
    const results = forecastAll(weekly, horizon).map((r) => ({
      ...r,
      outlook: summarizeOutlook(r, prices.get(r.productId) ?? 0),
    }));

    res.json({
      source: name,
      includesDemoData: await includesDemo(name),
      generatedAt: new Date(),
      horizon,
      minWeeks: MIN_WEEKS,
      weeksOfData: weekly.weeks.length,
      firstWeek: weekly.weeks[0] ?? null,
      lastWeek: weekly.weeks[weekly.weeks.length - 1] ?? null,
      totals: summarizeTotals(results),
      products: results,
    });
  } catch (err) {
    next(err);
  }
}
