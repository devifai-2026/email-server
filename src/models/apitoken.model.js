const mongoose = require("mongoose");

const apiTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApiToken", apiTokenSchema);
