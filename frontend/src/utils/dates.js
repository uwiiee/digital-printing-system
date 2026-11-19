// Week, month and "time ago" labels. Keys look like "2026-10-19" (a Monday) and "2026-10".
export const weekLabel = (key) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const monthLabel = (key) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "UTC" });

export const monthShort = (key) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" });

export const longDate = (d = new Date()) =>
  d.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export function greeting(d = new Date()) {
  const hour = d.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// "just now", "5 min ago", "3 hours ago", "2 days ago"
export function timeAgo(value, now = new Date()) {
  const seconds = Math.max(0, Math.round((now - new Date(value)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
