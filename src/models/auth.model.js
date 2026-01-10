const mongoose = require("mongoose");

const authAccountSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokens: [
      {
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
        deviceInfo: {
          userAgent: String,
          ipAddress: String,
          lastActive: { type: Date, default: Date.now }
        }
      }
    ],
    isSignedIn: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }, // Add this field
    lastSignedIn: { type: Date },
    lastSignedOut: { type: Date }
  },
  { timestamps: true }
);