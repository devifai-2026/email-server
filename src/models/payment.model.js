const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    useremail: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", ],
      default: "pending",
    },
    method: { type: String }, // e.g. PayPal, Stripe, etc.
    transactionId: { type: String },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    details: { type: Object }, // for storing gateway response or extra info
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
