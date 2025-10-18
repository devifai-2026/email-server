const mongoose = require("mongoose");

const planSnapshotSchema = new mongoose.Schema(
  {
    _id: false,
    id: String,
    name: String,
    price: Number,
    description: String,
    duration: Number,
    features: [String],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    fullname: { type: String },
    phone: { type: String },
    jobrole: { type: String },
    company: { type: String },

    role: { type: String, enum: ["admin", "user"], default: "user" },
    isActive: { type: Boolean, default: true },

    // ✅ Store current active plan snapshot
    currentPlan: { type: planSnapshotSchema },

    // ✅ Store subscription history with snapshot
    subscription: [
      {
        plan: { type: planSnapshotSchema },
        subscribedAt: { type: Date },
        expiresAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
