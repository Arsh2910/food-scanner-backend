const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      email: normalizedEmail,
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      success: true,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      profile: {
        email: user.email,
        age: user.age,
        name: user.name,
        gender: user.gender,
        diet: user.diet,
        allergies: user.allergies,
        avoid: user.avoid,
        healthIssues: user.healthIssues,
        likes: user.likes,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/profile", protect, async (req, res) => {
  try {
    const { name, age, gender, diet, allergies, avoid, healthIssues, likes } =
      req.body;

    const user = await User.findById(req.user);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name !== undefined) user.name = name;
    if (age !== undefined) user.age = age;
    if (gender !== undefined) user.gender = gender;
    if (diet !== undefined) user.diet = diet;

    if (allergies !== undefined) {
      if (!Array.isArray(allergies)) {
        return res.status(400).json({ message: "Allergies must be an array" });
      }
      user.allergies = allergies.map((a) => a.toLowerCase());
    }

    if (avoid !== undefined) {
      if (!Array.isArray(avoid)) {
        return res.status(400).json({ message: "Avoid must be an array" });
      }
      user.avoid = avoid.map((a) => a.toLowerCase());
    }

    if (healthIssues !== undefined) {
      if (!Array.isArray(healthIssues)) {
        return res
          .status(400)
          .json({ message: "Health issues must be an array" });
      }
      user.healthIssues = healthIssues.map((h) => h.toLowerCase());
    }

    if (likes !== undefined) {
      if (!Array.isArray(likes)) {
        return res.status(400).json({ message: "Likes must be an array" });
      }
      user.likes = likes.map((l) => l.toLowerCase());
    }

    user.preferencesCompleted = true;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
