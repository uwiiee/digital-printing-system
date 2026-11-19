import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

await mongoose.connect(process.env.MONGODB_URI);

const email = process.env.ADMIN_EMAIL.toLowerCase();
const exists = await User.findOne({ email });

if (exists) {
  console.log("Admin already exists");
} else {
  const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await User.create({ email, password: hashed, role: "admin" });
  console.log("Admin created:", email);
}

await mongoose.disconnect();