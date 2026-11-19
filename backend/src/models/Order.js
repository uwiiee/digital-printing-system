import mongoose from "mongoose";

export const ORDER_STATUSES = ["Pending", "On Process", "Completed"];

// One cart line: a product, one set of answers, and how many of it
const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Snapshot at order time, so later price edits don't change old orders
    productName: { type: String, required: true },
    examplePrice: { type: Number, required: true },
    priceUnit: { type: String, default: "" },
    estimatedUnitPrice: { type: Number, required: true },
    specs: { type: mongoose.Schema.Types.Mixed, default: {} },
    quantity: { type: Number, required: true, min: 1 },
    designFile: { type: String, default: "" },
  },
  { _id: false }
);

// Guest orders (no account) must leave a name and number. Orders from a logged-in customer don't:
// the shop talks to them through the order chat.
const guestOnly = function () {
  return !this.customer;
};

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true }, // null = guest
    code: { type: String, unique: true, sparse: true }, // short code shown to the customer, e.g. K7P3XQ
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    notes: { type: String, default: "", maxlength: 1000 },
    contactName: { type: String, default: "", trim: true, required: guestOnly },
    contactNumber: { type: String, default: "", trim: true, required: guestOnly },

    status: { type: String, enum: ORDER_STATUSES, default: "Pending", index: true },
    estimatedTotal: { type: Number, required: true }, // computed by the server, for reference only
    finalPrice: { type: Number, min: 0, default: null }, // set by the admin on review
    downPayment: {
      requested: { type: Boolean, default: false },
      amount: { type: Number, min: 0, default: 0 },
      received: { type: Boolean, default: false },
    },
    confirmedAt: Date,
    completedAt: Date,

    // Order chat (logged-in customers only): how many messages the other side hasn't read yet
    unreadForAdmin: { type: Number, default: 0, min: 0 },
    unreadForCustomer: { type: Number, default: 0, min: 0 },
    lastMessageAt: Date,

    // true only for demo orders made by `npm run seed:sample`. Customers can never set this.
    isSample: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
