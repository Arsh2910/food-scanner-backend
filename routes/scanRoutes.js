const protect = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Scan = require("../models/Scan");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require("crypto");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🔥 CREATE SCAN
router.post("/", protect, async (req, res) => {
  try {
    const { ingredients } = req.body;

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

    // 🔥 Normalize ingredients
    const normalizedIngredients = ingredients
      .map((i) => i.trim().toLowerCase())
      .sort();

    const ingredientString = normalizedIngredients.join(",");
    const ingredientHash = crypto
      .createHash("sha256")
      .update(ingredientString)
      .digest("hex");

    // 🔥 1️⃣ Global Cache Check (any user)
    const cachedScan = await Scan.findOne({ ingredientHash });
    if (cachedScan) {
      return res.json({
        ...cachedScan.result,
        scanId: cachedScan._id,
        isSaved: false,
        cached: true,
      });
    }

    // 🔥 2️⃣ Duplicate Check (same user)
    const existingScan = await Scan.findOne({
      user: user._id,
      ingredients: normalizedIngredients,
    });

    if (existingScan) {
      return res.json({
        ...existingScan.result,
        scanId: existingScan._id,
        isSaved: existingScan.isSaved,
        duplicate: true,
      });
    }

    const evaluationConditions = [];

    if (user.diet) {
      evaluationConditions.push({ category: "diet", name: user.diet });
    }

    if (user.allergies?.length) {
      user.allergies.forEach((a) =>
        evaluationConditions.push({ category: "allergy", name: a }),
      );
    }

    if (user.healthIssues?.length) {
      user.healthIssues.forEach((h) =>
        evaluationConditions.push({ category: "health", name: h }),
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
Evaluate ONLY against:
${JSON.stringify(evaluationConditions, null, 2)}

Ingredients:
${normalizedIngredients.join(", ")}

Return concise structured JSON only.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let jsonString;
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);

    if (markdownMatch) {
      jsonString = markdownMatch[1];
    } else {
      const fallback = text.match(/\{[\s\S]*\}/);
      if (!fallback) {
        return res.status(500).json({
          success: false,
          message: "AI did not return valid JSON",
        });
      }
      jsonString = fallback[0];
    }

    let parsed = JSON.parse(jsonString);

    // 🔥 Normalize
    parsed.safe = typeof parsed.safe === "boolean" ? parsed.safe : false;
    parsed.riskScore =
      typeof parsed.riskScore === "number" ? parsed.riskScore : 50;

    parsed.severity = ["low", "medium", "high", "critical"].includes(
      parsed.severity,
    )
      ? parsed.severity
      : "low";

    parsed.verdicts = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];

    parsed.summary = parsed.summary || "";
    parsed.detailedExplanation = parsed.detailedExplanation || "";

    // 🔥 Save Scan
    const savedScan = await Scan.create({
      user: user._id,
      ingredients: normalizedIngredients,
      ingredientHash,
      result: parsed,
      isSaved: false,
    });

    res.json({
      ...parsed,
      scanId: savedScan._id,
      isSaved: false,
    });
  } catch (error) {
    console.error("SCAN ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Gemini analysis failed",
    });
  }
});

// 🔥 HISTORY WITH PAGINATION
router.get("/history", protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const scans = await Scan.find({ user: req.user })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Scan.countDocuments({ user: req.user });

    res.json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      history: scans,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch history",
    });
  }
});

// 🔥 DELETE SCAN
router.delete("/:id", protect, async (req, res) => {
  try {
    const deleted = await Scan.findOneAndDelete({
      _id: req.params.id,
      user: req.user,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Scan not found",
      });
    }

    res.json({
      success: true,
      message: "Scan deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete scan",
    });
  }
});

// 🔥 TOGGLE SAVE
router.put("/save/:id", protect, async (req, res) => {
  try {
    const scan = await Scan.findOne({
      _id: req.params.id,
      user: req.user,
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: "Scan not found",
      });
    }

    scan.isSaved = !scan.isSaved;
    await scan.save();

    res.json({
      success: true,
      isSaved: scan.isSaved,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle save",
    });
  }
});

// 🔥 GET SAVED
router.get("/saved", protect, async (req, res) => {
  try {
    const savedScans = await Scan.find({
      user: req.user,
      isSaved: true,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      saved: savedScans,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch saved scans",
    });
  }
});

module.exports = router;
