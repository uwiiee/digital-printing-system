import mongoose from "mongoose";

// One question asked each time a customer taps this product
const formFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    inputType: {
      type: String,
      enum: ["text", "number", "select", "textarea"],
      required: true,
    },
    options: [String], // for select
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    examplePrice: { type: Number, required: true, min: 0 },
    priceUnit: { type: String, default: "per piece" }, // shown to customers
    pricingType: {
      type: String,
      enum: ["per_piece", "per_sq_ft"],
      default: "per_piece",
    },
    imageUrl: { type: String, default: "" },
    formFields: [formFieldSchema],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("Product", productSchema);
