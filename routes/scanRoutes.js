const protect = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Ingredient = require("../models/Ingredient");

router.post("/", protect, async (req, res) => {
  try {
    const { ingredients } = req.body;
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let issues = [];

    for (let item of ingredients) {
      const ingredient = await Ingredient.findOne({
        name: item.toLowerCase(),
      });

      if (!ingredient) continue;

      ingredient.allergens.forEach((allergen) => {
        if (user.allergies.includes(allergen)) {
          issues.push(`Contains allergen: ${allergen}`);
        }
      });

      if (user.diet === "vegan" && ingredient.vegan === false) {
        issues.push(`Not vegan: ${ingredient.name}`);
      }

      if (user.avoid.includes(ingredient.name)) {
        issues.push(`Avoid ingredient: ${ingredient.name}`);
      }
    }

    res.json({
      safe: issues.length === 0,
      issues,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
