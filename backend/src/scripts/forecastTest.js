// Tests the forecasting logic WITHOUT a database: bucketing, leakage, metrics, and data limits.
import { generateSampleOrders } from "../services/sampleGenerator.js";
import { addWeeks, buildWeeklyDemand, weekStartKey } from "../services/salesData.js";
import { MIN_WEEKS, errorMetrics, forecastProduct, summarizeOutlook, summarizeTotals } from "../services/forecastService.js";
import { averageUnitPrices, summarizeSales } from "../services/reportService.js";
import { resolveSource } from "../services/dataSource.js";
import { manilaDayStart, manilaMonthStart } from "../services/dateRanges.js";

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

const products = [
  { _id: "p1", name: "Jersey", examplePrice: 350, priceUnit: "per piece", pricingType: "per_piece" },
  { _id: "p2", name: "Tarpaulin", examplePrice: 15, priceUnit: "per sq ft", pricingType: "per_sq_ft" },
];
const now = new Date("2026-10-27T10:00:00+08:00"); // a Tuesday

// --- Weeks run Monday to Sunday in Philippine time ---
check("Sunday 11:30 PM (Manila) belongs to the week starting Monday Oct 19", weekStartKey("2026-10-25T23:30:00+08:00") === "2026-10-19");
check("Monday 12:00 AM (Manila) starts a new week (Oct 26)", weekStartKey("2026-10-26T00:00:00+08:00") === "2026-10-26");
check("addWeeks works across a year end", addWeeks("2026-12-28", 1) === "2027-01-04");

// --- Sample data and weekly demand ---
const orders = generateSampleOrders({ products, customerId: "c1", now, weeks: 104 });
const again = generateSampleOrders({ products, customerId: "c1", now, weeks: 104 });
check("sample data is reproducible (same seed, same data)", JSON.stringify(orders) === JSON.stringify(again));
check("all sample orders are flagged as sample", orders.every((o) => o.isSample === true));

const weekly = buildWeeklyDemand(orders, products, now);
check("104 complete weeks, ending last Monday (Oct 19)", weekly.weeks.length === 104 && weekly.weeks.at(-1) === "2026-10-19", weekly.weeks.at(-1));

const jerseyUnits = orders.reduce((s, o) => s + o.items.filter((i) => i.product === "p1").reduce((a, i) => a + i.quantity, 0), 0);
const seriesUnits = weekly.series[0].values.reduce((a, b) => a + b, 0);
check("weekly series adds up to the units in the orders", jerseyUnits === seriesUnits, `${jerseyUnits} vs ${seriesUnits}`);

const withPartial = [...orders, { createdAt: new Date("2026-10-27T09:00:00+08:00"), items: [{ product: "p1", quantity: 500 }] }];
const weeklyPartial = buildWeeklyDemand(withPartial, products, now);
check("orders from the current unfinished week are left out", weeklyPartial.series[0].values.reduce((a, b) => a + b, 0) === seriesUnits);

// --- Forecast behaviour ---
const jersey = weekly.series[0];
const a = forecastProduct(jersey, weekly.weeks, 4);
const b = forecastProduct(jersey, weekly.weeks, 4);
check("a full history gives status ok with 4 forecast weeks", a.status === "ok" && a.forecast.length === 4);
check("forecasts are reproducible", JSON.stringify(a) === JSON.stringify(b));
check("forecast weeks follow the last history week", a.forecast[0].week === "2026-10-26" && a.forecast[3].week === "2026-11-16", a.forecast[0].week);
check("the test period is the newest weeks", a.test.rows.at(-1).week === weekly.weeks.at(-1) && a.test.trainingWeeks + a.test.weeks === 104);
check("forecast values are never negative", a.forecast.every((f) => f.units >= 0));

// --- No leakage: changing the test-period actuals must not change what the model predicts for the FIRST test week ---
const split = a.test.trainingWeeks;
const tampered = jersey.values.map((v, i) => (i >= split ? v * 10 + 7 : v));
const c = forecastProduct({ ...jersey, values: tampered }, weekly.weeks, 4);
check(
  "no data leakage: first test prediction ignores test-period actuals",
  c.test.rows[0].randomForest === a.test.rows[0].randomForest,
  `${c.test.rows[0].randomForest} vs ${a.test.rows[0].randomForest}`
);

// --- Metrics ---
const m = errorMetrics([10, 20], [12, 18]);
check("MAE, RMSE and MAPE are calculated correctly", m.mae === 2 && m.rmse === 2 && m.mape === 15, JSON.stringify(m));
const sparse = errorMetrics([0, 0, 0, 5, 0], [1, 1, 1, 4, 1]);
check("MAPE is hidden when most weeks have zero sales", sparse.mape === null && sparse.mae > 0);

// --- Not enough data ---
const shortValues = jersey.values.slice(0, MIN_WEEKS - 1);
const shortWeeks = weekly.weeks.slice(0, MIN_WEEKS - 1);
const s = forecastProduct({ ...jersey, values: shortValues }, shortWeeks, 4);
check(`under ${MIN_WEEKS} weeks: no Random Forest, baseline only, with a message`, s.status === "insufficient" && !s.metrics && s.forecast.length === 4 && /week/.test(s.message));
const empty = forecastProduct({ productId: "x", name: "None", values: [] }, [], 4);
check("a product with no sales gives a clear message and no forecast", empty.status === "insufficient" && empty.forecast.length === 0 && !!empty.message);
const noOrders = buildWeeklyDemand([], products, now);
check("no orders at all gives empty weeks", noOrders.weeks.length === 0);

// --- Sales report totals ---
const report = summarizeSales(orders);
const monthRevenue = report.monthly.reduce((s, m) => s + m.revenue, 0);
const monthUnits = report.monthly.reduce((s, m) => s + m.units, 0);
const allUnits = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
check("report: the monthly rows add up to the summary", Math.abs(monthRevenue - report.summary.revenue) < 0.01 && monthUnits === report.summary.units, `${monthRevenue} vs ${report.summary.revenue}`);
check("report: totals match the orders", report.summary.orders === orders.length && report.summary.units === allUnits);
check("report: product shares add up to about 100%", Math.abs(report.byProduct.reduce((s, p) => s + p.share, 0) - 100) < 0.5);
const gap = summarizeSales([
  { finalPrice: 100, completedAt: new Date("2026-01-15T10:00:00Z"), items: [{ productName: "A", quantity: 1 }] },
  { finalPrice: 200, completedAt: new Date("2026-04-15T10:00:00Z"), items: [{ productName: "A", quantity: 2 }] },
]);
check("report: months with no sales still appear (Jan to Apr = 4 rows)", gap.monthly.length === 4 && gap.monthly[1].revenue === 0, JSON.stringify(gap.monthly.map((m) => m.month)));
check("report: no orders gives empty, not an error", summarizeSales([]).monthly.length === 0 && summarizeSales([]).summary.revenue === 0);

// --- Plain-language outlook (what the dashboard shows) ---
const prices = averageUnitPrices(orders);
check("average price: jerseys are priced at the example price", prices.get("p1") === 350, String(prices.get("p1")));
const outlook = summarizeOutlook(a, prices.get("p1"));
const last4 = jersey.values.slice(-4).reduce((x, y) => x + y, 0);
const next4 = a.forecast.reduce((x, f) => x + f.units, 0);
check("outlook: last 4 weeks and next 4 weeks match the data", outlook.recentUnits === last4 && Math.abs(outlook.expectedUnits - next4) < 0.15, JSON.stringify(outlook));
check("outlook: change % is (next - last) / last", Math.abs(outlook.changePct - ((outlook.expectedUnits - last4) / last4) * 100) < 0.2, String(outlook.changePct));
check("outlook: estimated sales = expected units x average price", Math.abs(outlook.expectedSales - outlook.expectedUnits * 350) < 1, String(outlook.expectedSales));
check("outlook: typical error is the tested MAE", outlook.typicalErrorUnits === a.metrics.randomForest.mae);
const noHistory = summarizeOutlook(empty, 0);
check("outlook: no data gives zeros and no percentage, not an error", noHistory.expectedUnits === 0 && noHistory.changePct === null && noHistory.typicalErrorUnits === null);
const allResults = [a, s].map((r, i) => ({ ...r, outlook: summarizeOutlook(r, 100 + i) }));
const totals = summarizeTotals(allResults);
check("totals add up across products", Math.abs(totals.expectedUnits - allResults.reduce((x, r) => x + r.outlook.expectedUnits, 0)) < 0.2, JSON.stringify(totals));
check("totals ignore products with no forecast", summarizeTotals([{ forecast: [], outlook: summarizeOutlook(empty, 0) }]).expectedUnits === 0);

// --- Which dataset the screens use ---
check("dataset: default is real orders only", resolveSource({}, {}).name === "real");
check("dataset: INCLUDE_DEMO_DATA=true includes demo orders", resolveSource({}, { INCLUDE_DEMO_DATA: "true" }).name === "all");
check("dataset: ?source=sample overrides the setting", resolveSource({ source: "sample" }, { INCLUDE_DEMO_DATA: "true" }).name === "sample");
const badSources = ["bogus", "constructor", "toString", ["real"], ""];
check("dataset: invalid values are rejected (including 'constructor')", badSources.every((v) => { try { resolveSource({ source: v }, {}); return false; } catch (e) { return e.status === 400; } }));

// --- Today and this month, in Philippine time ---
const tue = new Date("2026-10-27T10:00:00+08:00");
check("today starts at 12:00 AM Manila time", manilaDayStart(tue).toISOString() === "2026-10-26T16:00:00.000Z", manilaDayStart(tue).toISOString());
check("this month starts on the 1st, 12:00 AM Manila time", manilaMonthStart(tue).toISOString() === "2026-09-30T16:00:00.000Z", manilaMonthStart(tue).toISOString());
check("just after midnight Manila still counts as the new day", manilaDayStart(new Date("2026-10-28T00:30:00+08:00")).toISOString() === "2026-10-27T16:00:00.000Z");
check("11:30 PM on the last day stays in that month", manilaMonthStart(new Date("2026-10-31T23:30:00+08:00")).toISOString() === "2026-09-30T16:00:00.000Z");

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
