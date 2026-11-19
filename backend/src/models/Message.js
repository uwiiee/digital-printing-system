import mongoose from "mongoose";

// One chat message on an order, between a logged-in customer and the shop owner
const messageSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    sender: { type: String, enum: ["customer", "admin"], required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Message", messageSchema);
