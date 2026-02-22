const express = require("express");
const router = express.Router();
const Ingredient = require("../models/Ingredient");
const protect = require("../middleware/authMiddleware");
router.post("/add", protect, async (req, res) => {
  try {
    const ingredient = await Ingredient.create(req.body);
    res.status(201).json(ingredient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
