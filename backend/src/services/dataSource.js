// Which orders the reports, forecast and dashboard numbers are built from.
//   real   = orders customers placed
//   sample = generated demo orders (npm run seed:sample)
//   all    = both together
export const SOURCES = { real: { isSample: { $ne: true } }, sample: { isSample: true }, all: {} };

// With no ?source= in the request, INCLUDE_DEMO_DATA=true in backend/.env means "all", otherwise "real".
export function resolveSource(query = {}, env = process.env) {
  const fallback = env.INCLUDE_DEMO_DATA === "true" ? "all" : "real";
  const name = query.source === undefined ? fallback : query.source;
  if (typeof name !== "string" || !Object.hasOwn(SOURCES, name)) {
    throw Object.assign(new Error("source must be 'real', 'sample' or 'all'"), { status: 400 });
  }
  return { name, filter: SOURCES[name] };
}
