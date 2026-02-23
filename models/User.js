const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: [String], default: [] },
    age: { type: Number, min: 1, max: 120, default: null },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },

    diet: { type: String, default: "" },
    allergies: { type: [String], default: [] },

    healthIssues: { type: [String], default: [] },
    likes: { type: [String], default: [] },
    avoid: { type: [String], default: [] },
    preferencesCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
