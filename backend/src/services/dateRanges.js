// Start of today / this month in Philippine time (UTC+8), as real Date values.
const OFFSET_MS = 8 * 60 * 60 * 1000;

export function manilaDayStart(now = new Date()) {
  const t = new Date(now.getTime() + OFFSET_MS);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - OFFSET_MS);
}

export function manilaMonthStart(now = new Date()) {
  const t = new Date(now.getTime() + OFFSET_MS);
  t.setUTCDate(1);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - OFFSET_MS);
}
