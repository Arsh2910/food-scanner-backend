const protect = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Ingredient = require("../models/Ingredient");

router.post("/", protect, async (req, res) => {
  try {
    const { ingredients } = req.body;

    // ✅ Validate input
    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({
        success: false,
        message: "Ingredients must be an array",
      });
    }

    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let issues = [];

    for (let rawItem of ingredients) {
      const item = rawItem.toLowerCase().trim();

      const ingredient = await Ingredient.findOne({
        name: item,
      });

      if (!ingredient) {
        issues.push(`Unknown ingredient: ${item}`);
        continue;
      }

      // 🔎 Check allergens
      ingredient.allergens.forEach((allergen) => {
        if (user.allergies.includes(allergen)) {
          issues.push(`Contains allergen: ${allergen}`);
        }
      });

      // 🌱 Vegan check
      if (user.diet === "vegan" && ingredient.vegan === false) {
        issues.push(`Not vegan: ${ingredient.name}`);
      }

      // 🚫 Avoid list check
      if (user.avoid.includes(ingredient.name)) {
        issues.push(`Avoid ingredient: ${ingredient.name}`);
      }
    }

    res.json({
      success: true,
      safe: issues.length === 0,
      issues,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
