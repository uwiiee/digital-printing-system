// Creates (or removes) DEMO orders so the reports and forecast screens have something to show.
//   npm run seed:sample     -> replaces any old sample orders with a fresh set (104 weeks)
//   npm run clear:sample    -> removes all sample orders and the sample customer
// Sample orders are flagged isSample, so they never mix with real orders.
import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { generateSampleOrders } from "../services/sampleGenerator.js";

const SAMPLE_EMAIL = "sample.customer@sample.local";

await mongoose.connect(process.env.MONGODB_URI);

try {
  const removed = await Order.deleteMany({ isSample: true });
  console.log(`Removed ${removed.deletedCount} old sample orders`);

  if (process.argv.includes("--clear")) {
    await User.deleteOne({ email: SAMPLE_EMAIL });
    console.log("Sample data cleared.");
  } else {
    const products = await Product.find({ isActive: true }).sort("sortOrder").lean();
    if (products.length === 0) throw new Error("No products found. Run `npm run seed:products` first.");

    // A customer account nobody can log in to (its password is random and thrown away)
    let user = await User.findOne({ email: SAMPLE_EMAIL });
    if (!user) {
      const password = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
      user = await User.create({ email: SAMPLE_EMAIL, password, role: "customer" });
    }

    const docs = generateSampleOrders({ products, customerId: user._id });
    await Order.collection.insertMany(docs); // direct insert, so the past dates are kept as given
    console.log(`Created ${docs.length} SAMPLE orders covering 104 weeks.`);
    console.log("These are invented demo data. Never present them as the shop's real sales.");
  }
} finally {
  await mongoose.disconnect();
}
