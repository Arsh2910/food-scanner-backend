const protect = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Scan = require("../models/Scan");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are a food safety analysis system.

User Profile:
Age: ${user.age}
Gender: ${user.gender}
Diet: ${user.diet}
Allergies: ${user.allergies.join(", ")}
Avoid: ${user.avoid.join(", ")}
Health Issues: ${user.healthIssues.join(", ")}

Ingredients:
${ingredients.join(", ")}

Analyze these ingredients for this user.

If the product is unsafe, suggest 3 SAFER REAL-WORLD BRANDED ALTERNATIVES of the same product type.

IMPORTANT:
- Do NOT wrap the JSON in markdown.
- Do NOT include explanations outside JSON.
- Return RAW JSON only.

Return ONLY valid JSON in this format:

{
  "safe": true or false,
  "riskLevel": "low" | "medium" | "high",
  "confidence": number between 0 and 100,
  "issues": [],
  "alternatives": [
    {
      "productName": "",
      "reason": ""
    }
  ],
  "summary": ""
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("RAW AI RESPONSE:");
    console.log(text);

    // 🔥 Extract JSON safely (handles markdown + extra text)
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i);

    let jsonString;

    if (match) {
      jsonString = match[1];
    } else {
      const fallback = text.match(/\{[\s\S]*\}/);
      if (!fallback) {
        return res.status(500).json({
          success: false,
          message: "AI did not return valid JSON structure",
        });
      }
      jsonString = fallback[0];
    }

    let parsed;

    try {
      parsed = JSON.parse(jsonString);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Invalid AI response format",
      });
    }

    // 🔥 Normalize AI output (never trust AI structure blindly)
    parsed.safe = typeof parsed.safe === "boolean" ? parsed.safe : false;

    parsed.confidence =
      typeof parsed.confidence === "number" ? parsed.confidence : 50;

    parsed.issues = Array.isArray(parsed.issues) ? parsed.issues : [];

    parsed.alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives
      : [];

    parsed.riskLevel = ["low", "medium", "high"].includes(parsed.riskLevel)
      ? parsed.riskLevel
      : "low";

    // 🔥 Backend Risk Override Logic
    let finalRisk = parsed.riskLevel;

    const issuesText = parsed.issues.join(" ").toLowerCase();

    const allergyMatch = user.allergies.some((allergy) =>
      issuesText.includes(allergy.toLowerCase()),
    );

    if (allergyMatch) {
      finalRisk = "high";
    } else if (!parsed.safe) {
      finalRisk = "medium";
    }

    parsed.riskLevel = finalRisk;

    console.log("FINAL PARSED RESULT:", parsed);

    // 🔥 Save scan history
    await Scan.create({
      user: user._id,
      ingredients,
      result: parsed,
    });

    res.json(parsed);
  } catch (error) {
    console.error("SCAN ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Gemini analysis failed",
    });
  }
});

// 🔥 History Endpoint
router.get("/history", protect, async (req, res) => {
  try {
    const scans = await Scan.find({ user: req.user }).sort({ createdAt: -1 });

    res.json({
      success: true,
      history: scans,
    });
  } catch (error) {
    console.error("HISTORY ERROR:", error);
    res.status(500).json({
      message: "Failed to fetch history",
    });
  }
});

module.exports = router;
