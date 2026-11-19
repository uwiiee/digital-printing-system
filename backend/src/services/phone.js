const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

// Compares the last 10 digits, so 0917 123 4567 and +63 917 123 4567 are the same number
export function samePhone(a, b) {
  const x = digitsOnly(a);
  const y = digitsOnly(b);
  return x.length >= 7 && y.length >= 7 && x.slice(-10) === y.slice(-10);
}
