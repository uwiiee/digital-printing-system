import jwt from "jsonwebtoken";

export function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
}

// A login token is stale if it was issued before the user's last password change.
// (JWT times are in whole seconds, so the comparison is in seconds too.)
export function isTokenStale(issuedAtSeconds, passwordChangedAt) {
  if (!passwordChangedAt) return false;
  return issuedAtSeconds < Math.floor(new Date(passwordChangedAt).getTime() / 1000);
}
