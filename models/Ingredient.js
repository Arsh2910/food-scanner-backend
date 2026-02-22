const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      lowercase: true,
    },
    vegan: {
      type: Boolean,
      default: true,
    },
    allergens: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

const Ingredient = mongoose.model("Ingredient", ingredientSchema);

module.exports = Ingredient;
