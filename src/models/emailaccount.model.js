// In your EmailAccount model file (models/EmailAccount.js or similar)
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
    bulkUploadId: { type: mongoose.Schema.Types.ObjectId, ref: "BulkUpload" }
  },
  { timestamps: true }
);

// Create indexes in schema definition too
emailAccountSchema.index({ email: 1 }, { unique: true });
emailAccountSchema.index({ companyname: 1 });
emailAccountSchema.index({ name: 1 });
emailAccountSchema.index({ createdAt: 1 });
emailAccountSchema.index({ bulkUploadId: 1 });
emailAccountSchema.index({ isverified: 1 });
emailAccountSchema.index({ bulkUploadId: 1, createdAt: -1 });

module.exports = mongoose.model("EmailAccount", emailAccountSchema);