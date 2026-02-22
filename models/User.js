const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    diet: { type: String, default: "" },
    allergies: { type: [String], default: [] },
    avoid: { type: [String], default: [] },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
