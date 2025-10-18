const mongoose = require("mongoose");

const bulkUploadSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthAccount",
      required: true,
    },

    filename: { type: String },      // optional: store uploaded filename
    filePath: { type: String },      // optional: S3 path

    total: { type: Number, required: true }, // total rows in file
    processed: { type: Number, default: 0 }, // rows attempted (unique + duplicates)
    inserted: { type: Number, default: 0 },  // unique inserted rows
    skipped: { type: Number, default: 0 },   // duplicate rows skipped
    chunksCompleted: { type: Number, default: 0 }, // how many chunks done

    // For idempotency (track which chunks were already processed)
    processedChunks: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["pending", "queued", "processing", "completed", "failed"],
      default: "pending",
    },

    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BulkUpload", bulkUploadSchema);
