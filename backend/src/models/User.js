import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // hidden from queries by default
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    // Set when the password is changed. Login tokens issued before this moment stop working.
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
