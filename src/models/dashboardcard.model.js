// models/Card.js
const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    header: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Card", cardSchema);
