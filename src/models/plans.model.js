const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, required: false },
    duration: { type: Number, required: true }, // Duration in days
    features: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);
