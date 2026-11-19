import { monthLabel, monthShort } from "../utils/dates";
import { peso } from "../utils/format";

const compact = (n) =>
  `₱${new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;

// Column chart of revenue per month
export default function MonthlyBars({ months }) {
  const max = Math.max(1, ...months.map((m) => m.revenue));
  return (
    <div className="bars">
      {months.map((m) => (
        <div className="bars-col" key={m.month} title={`${monthLabel(m.month)}: ${peso(m.revenue)} from ${m.orders} orders`}>
          <span className="bars-value">{compact(m.revenue)}</span>
          <div className="bars-track">
            <div className="bars-bar" style={{ height: `${(m.revenue / max) * 100}%` }} />
          </div>
          <span className="bars-label">{monthShort(m.month)}</span>
        </div>
      ))}
    </div>
  );
}
