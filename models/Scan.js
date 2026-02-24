const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ingredients: [String],

    result: {
      safe: Boolean,
      issues: [
        {
          type: { type: String },
          item: String,
          reason: String,
        },
      ],
      summary: String,
      confidence: {
        type: Number,
        min: 0,
        max: 100,
      },
      riskLevel: {
        type: String,
        enum: ["low", "medium", "high"],
      },
      alternatives: [
        {
          productName: String,
          reason: String,
        },
      ],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Scan", scanSchema);
