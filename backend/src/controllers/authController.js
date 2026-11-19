import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../services/tokenService.js";
import { passwordProblem } from "../services/passwordRules.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({ id: u._id, email: u.email, role: u.role });
const bad = (res, message) => res.status(400).json({ message });

export async function register(req, res, next) {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) return bad(res, "Enter a valid email address");
    const problem = passwordProblem(password);
    if (problem) return bad(res, problem);
    if (password !== confirmPassword) return bad(res, "Passwords do not match");

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email is already registered" });

    const hashed = await bcrypt.hash(password, 10);
    // role is never taken from the request body: public signup is always a customer
    const user = await User.create({ email, password: hashed, role: "customer" });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// Shared login logic: each endpoint decides which role is allowed
const loginAs = (role) => async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return bad(res, "Email and password are required");

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    const ok = user && user.role === role && (await bcrypt.compare(password, user.password));
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

export const loginCustomer = loginAs("customer");
export const loginAdmin = loginAs("admin");

// For any logged-in user (customer or admin)
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (typeof currentPassword !== "string" || currentPassword === "") return bad(res, "Enter your current password");
    const problem = passwordProblem(newPassword);
    if (problem) return bad(res, problem.replace("Password", "New password"));
    if (newPassword !== confirmPassword) return bad(res, "New passwords do not match");
    if (newPassword === currentPassword) return bad(res, "The new password must be different from the current one");

    const user = await User.findById(req.user._id).select("+password");
    const correct = user && (await bcrypt.compare(currentPassword, user.password));
    if (!correct) return bad(res, "Current password is incorrect");

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();

    // Other devices are logged out (their tokens are now stale). This device gets a fresh token.
    res.json({ token: signToken(user), user: publicUser(user), message: "Password changed" });
  } catch (err) {
    next(err);
  }
}
