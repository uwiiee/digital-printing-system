import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.js";

const SIZES = ["XS", "S", "M", "L", "XL", "2XL"];

// PLACEHOLDER prices and questions: replace with the shop's real ones
const products = [
  {
    name: "Jersey",
    description: "Custom printed jersey.",
    examplePrice: 350,
    priceUnit: "per piece",
    pricingType: "per_piece",
    sortOrder: 1,
    formFields: [
      {
        key: "size",
        label: "Size",
        inputType: "select",
        options: SIZES,
        required: true,
      },
      { key: "color", label: "Main color", inputType: "text", required: true },
      {
        key: "nameNumber",
        label: "Name / number to print (optional)",
        inputType: "text",
      },
    ],
  },
  {
    name: "Tarpaulin",
    description: "Large-format tarpaulin printing.",
    examplePrice: 15,
    priceUnit: "per sq ft",
    pricingType: "per_sq_ft",
    sortOrder: 2,
    formFields: [
      {
        key: "width",
        label: "Width (ft)",
        inputType: "number",
        required: true,
      },
      {
        key: "height",
        label: "Height (ft)",
        inputType: "number",
        required: true,
      },
    ],
  },
  {
    name: "Warmer with Hoodie",
    description: "Custom printed warmer with hoodie.",
    examplePrice: 600,
    priceUnit: "per piece",
    pricingType: "per_piece",
    sortOrder: 3,
    formFields: [
      {
        key: "size",
        label: "Size",
        inputType: "select",
        options: SIZES,
        required: true,
      },
      { key: "color", label: "Main color", inputType: "text", required: true },
    ],
  },
  {
    name: "Decals",
    description: "Custom printed decals and stickers.",
    examplePrice: 50,
    priceUnit: "per piece",
    pricingType: "per_piece",
    sortOrder: 4,
    formFields: [
      {
        key: "width",
        label: "Width (in)",
        inputType: "number",
        required: true,
      },
      {
        key: "height",
        label: "Height (in)",
        inputType: "number",
        required: true,
      },
    ],
  },
];

await mongoose.connect(process.env.MONGODB_URI);
for (const p of products) {
  await Product.updateOne({ name: p.name }, { $set: p }, { upsert: true });
}
console.log(`Seeded ${products.length} products`);
await mongoose.disconnect();
