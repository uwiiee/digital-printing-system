import { RandomForestRegression } from "ml-random-forest";
import { addWeeks } from "./salesData.js";

const DAY = 24 * 60 * 60 * 1000;

export const MIN_WEEKS = 52; // below this, no Random Forest is trained
const WARMUP = 8; // a row needs 8 earlier weeks for its features
const MIN_TRAIN_ROWS = 20;
const RF_OPTIONS = { nEstimators: 100, maxFeatures: 0.7, replacement: false, seed: 42, useSampleBagging: true };

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

function weekOfYear(key) {
  const d = new Date(`${key}T00:00:00Z`);
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - jan1) / (7 * DAY));
}

// Features for ONE target week, built only from the weeks BEFORE it (history)
export function featureRow(history, weekKey) {
  const n = history.length;
  const mean = (k) => {
    let sum = 0;
    for (let i = 1; i <= k; i++) sum += history[n - i];
    return sum / k;
  };
  const angle = (2 * Math.PI * weekOfYear(weekKey)) / 52;
  return [history[n - 1], history[n - 2], history[n - 3], history[n - 4], mean(4), mean(8), Math.sin(angle), Math.cos(angle)];
}

function trainModel(values, weeks, endExclusive) {
  const X = [];
  const y = [];
  for (let t = WARMUP; t < endExclusive; t++) {
    X.push(featureRow(values.slice(0, t), weeks[t]));
    y.push(values[t]);
  }
  const rf = new RandomForestRegression(RF_OPTIONS);
  rf.train(X, y);
  return rf;
}

export function errorMetrics(actual, predicted) {
  const n = actual.length;
  let abs = 0;
  let sq = 0;
  let pct = 0;
  let pctCount = 0;
  for (let i = 0; i < n; i++) {
    const e = predicted[i] - actual[i];
    abs += Math.abs(e);
    sq += e * e;
    if (actual[i] > 0) {
      pct += Math.abs(e) / actual[i];
      pctCount++;
    }
  }
  return {
    mae: round2(abs / n),
    rmse: round2(Math.sqrt(sq / n)),
    // MAPE is unstable when many weeks have zero sales, so it is hidden in that case
    mape: pctCount >= 0.8 * n ? round2((100 * pct) / pctCount) : null,
  };
}

const movingAverage = (history, k) => history.slice(-k).reduce((a, b) => a + b, 0) / k;

export function forecastProduct({ productId, name, values }, weeks, horizon = 4) {
  const n = values.length;
  const base = { productId, name, weeksOfHistory: n, history: weeks.map((w, i) => ({ week: w, units: values[i] })) };
  const zeroWeekShare = n ? round2(values.filter((v) => v === 0).length / n) : 0;
  const lastWeek = weeks[n - 1];

  // Not enough data: no Random Forest, only a flat moving-average baseline
  if (n < MIN_WEEKS) {
    const flat = n >= 4 ? movingAverage(values, 4) : null;
    return {
      ...base,
      status: "insufficient",
      zeroWeekShare,
      message:
        n === 0
          ? "There are no sales for this product yet, so no forecast can be made."
          : `Only ${n} week${n === 1 ? "" : "s"} of sales history so far. A reliable forecast needs at least ${MIN_WEEKS} weeks, so this is only a rough estimate based on the latest weeks.`,
      method: flat === null ? null : "4-week moving average (baseline)",
      forecast: flat === null ? [] : Array.from({ length: horizon }, (_, h) => ({ week: addWeeks(lastWeek, h + 1), units: round1(flat) })),
    };
  }

  // Time-based split: the model is trained on the older weeks and tested on the newest ones
  const testSize = Math.max(8, Math.round(n * 0.2));
  const split = n - testSize;
  if (split - WARMUP < MIN_TRAIN_ROWS) {
    return { ...base, status: "insufficient", zeroWeekShare, message: "Not enough training rows after reserving weeks for testing.", method: null, forecast: [] };
  }

  const rf = trainModel(values, weeks, split); // sees weeks 0..split-1 only
  const rows = [];
  for (let t = split; t < n; t++) {
    const past = values.slice(0, t); // only weeks before t
    rows.push({
      week: weeks[t],
      actual: values[t],
      randomForest: Math.max(0, rf.predict([featureRow(past, weeks[t])])[0]),
      naive: past[t - 1],
      movingAverage: movingAverage(past, 4),
    });
  }

  const actual = rows.map((r) => r.actual);
  const metrics = {
    randomForest: errorMetrics(actual, rows.map((r) => r.randomForest)),
    naive: errorMetrics(actual, rows.map((r) => r.naive)),
    movingAverage: errorMetrics(actual, rows.map((r) => r.movingAverage)),
  };

  // For the real forecast, retrain on ALL history, then predict week by week
  const finalModel = trainModel(values, weeks, n);
  const history = values.slice();
  const forecast = [];
  for (let h = 1; h <= horizon; h++) {
    const week = addWeeks(lastWeek, h);
    const pred = Math.max(0, finalModel.predict([featureRow(history, week)])[0]);
    history.push(pred); // later weeks build on earlier predictions
    forecast.push({ week, units: round1(pred) });
  }

  return {
    ...base,
    status: "ok",
    zeroWeekShare,
    method: "Random Forest",
    test: {
      startWeek: weeks[split],
      weeks: testSize,
      trainingWeeks: split,
      rows: rows.map((r) => ({ ...r, randomForest: round1(r.randomForest), movingAverage: round1(r.movingAverage) })),
    },
    metrics,
    verdict: {
      beatsNaive: metrics.randomForest.mae < metrics.naive.mae,
      beatsMovingAverage: metrics.randomForest.mae < metrics.movingAverage.mae,
    },
    forecast,
  };
}

export function forecastAll(weekly, horizon = 4) {
  return weekly.series.map((s) => forecastProduct(s, weekly.weeks, horizon));
}

// Plain-language summary for the dashboard: the last few weeks versus the weeks ahead
export function summarizeOutlook(result, avgUnitPrice = 0) {
  const weeks = result.forecast.length || 4;
  const recent = result.history.slice(-weeks).reduce((sum, h) => sum + h.units, 0);
  const expected = result.forecast.reduce((sum, f) => sum + f.units, 0);
  return {
    weeks,
    recentUnits: recent,
    expectedUnits: round1(expected),
    changePct: recent > 0 && result.forecast.length ? round1(((expected - recent) / recent) * 100) : null,
    avgUnitPrice: round2(avgUnitPrice),
    expectedSales: round2(expected * avgUnitPrice),
    typicalErrorUnits: result.status === "ok" ? result.metrics.randomForest.mae : null,
  };
}

// All products together (only products that have a forecast are counted)
export function summarizeTotals(results) {
  const usable = results.filter((r) => r.forecast.length > 0 && r.outlook);
  const sum = (key) => usable.reduce((total, r) => total + r.outlook[key], 0);
  const recent = sum("recentUnits");
  const expected = sum("expectedUnits");
  return {
    recentUnits: round1(recent),
    expectedUnits: round1(expected),
    changePct: recent > 0 && usable.length ? round1(((expected - recent) / recent) * 100) : null,
    expectedSales: round2(sum("expectedSales")),
  };
}
