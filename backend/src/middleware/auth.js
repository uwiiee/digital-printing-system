import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { isTokenStale } from "../services/tokenService.js";

// Checks the token and loads the user
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    // Tokens from before a password change no longer work (this logs out other devices)
    if (isTokenStale(payload.iat, user.passwordChangedAt))
      return res.status(401).json({ message: "Your password was changed. Please log in again." });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// For routes that work with or without a login (guest ordering).
// No Authorization header = guest. A header that is present must be valid.
export function optionalAuthenticate(req, res, next) {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
}

// Allows only the listed roles, e.g. authorize("admin")
export const authorize =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ message: "Forbidden" });
