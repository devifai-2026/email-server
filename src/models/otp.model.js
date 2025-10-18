// models/otp.model.js
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  fullname: { type: String, required: true },
  company: { type: String, required: true },
  role: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  hashedPassword: { type: String },
});

module.exports = mongoose.model("Otp", otpSchema);
