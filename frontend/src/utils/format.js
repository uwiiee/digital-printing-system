export const peso = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

// Example price for ONE unit (display only; the server recomputes it, and the admin sets the final price)
export function estimateUnit({ pricingType, examplePrice }, specs = {}) {
  if (pricingType === "per_sq_ft") {
    const w = Number(specs.width);
    const h = Number(specs.height);
    if (!(w > 0 && h > 0)) return 0;
    return Math.round(examplePrice * w * h * 100) / 100;
  }
  return examplePrice;
}

export const labelFromKey = (key) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export const STATUS_LABEL = {
  Pending: "Pending",
  "On Process": "On Process",
  Completed: "Transaction Complete",
};
