const mongoose = require("mongoose");

const emailAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String },

    location: { type: String },
    industry: { type: String },
    size: { type: String },
    funding: { type: String },
    email: { type: String, unique: true, required: true },
    phone: { type: String },
    personalcontactno: { type: String },
    companyname: { type: String },
    position: { type: String },
    website: { type: String },
    linkedin: { type: String },
    isverified: { type: Boolean, default: true },
    emaildata: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailAccount", emailAccountSchema);
