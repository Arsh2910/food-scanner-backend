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

    // 🔥 Build evaluation conditions dynamically
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
You are a structured food safety analysis engine.

Evaluate ONLY against:
${JSON.stringify(evaluationConditions, null, 2)}

Ingredients:
${ingredients.join(", ")}

STRICT RULES:
- Do NOT introduce new evaluation categories.
- Only evaluate the listed user conditions.
- If no issue exists, mark that condition as "safe".
- Keep summary to maximum 2 short sentences.
- Keep detailedExplanation to maximum 4 short sentences.
- Do NOT reference regulatory bodies.
- Avoid academic tone.
- Total explanation must not exceed 100 words.

ALTERNATIVES RULES:
- Only suggest REAL existing branded products.
- Must be established brands.
- Must be commonly available (India or international).
- Do NOT invent products.
- If unsure → return empty array.
- Only include if confidence >= 80%.

Return ONLY valid JSON:

{
  "safe": true or false,
  "riskScore": 0-100,
  "severity": "low | medium | high | critical",
  "verdicts": [
    {
      "category": "diet | allergy | health",
      "name": "",
      "status": "safe | warning | danger",
      "reason": ""
    }
  ],
  "alternatives": [
    {
      "name": "",
      "brand": "",
      "reason": "",
      "searchQuery": "",
      "confidence": 0-100
    }
  ],
  "summary": "",
  "detailedExplanation": ""
}

If safe = true → alternatives must be [].
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 🔥 Extract JSON safely
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

    let parsed;

    try {
      parsed = JSON.parse(jsonString);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Invalid AI JSON format",
      });
    }

    // 🔥 Normalize fields
    parsed.safe = typeof parsed.safe === "boolean" ? parsed.safe : false;
    parsed.riskScore =
      typeof parsed.riskScore === "number" ? parsed.riskScore : 50;

    parsed.severity = ["low", "medium", "high", "critical"].includes(
      parsed.severity,
    )
      ? parsed.severity
      : "low";

    parsed.verdicts = Array.isArray(parsed.verdicts)
      ? parsed.verdicts.map((v) => ({
          category: ["diet", "allergy", "health"].includes(v.category)
            ? v.category
            : "diet",
          name: typeof v.name === "string" ? v.name : "",
          status: ["safe", "warning", "danger"].includes(v.status)
            ? v.status
            : "warning",
          reason: typeof v.reason === "string" ? v.reason : "",
        }))
      : [];

    // 🔥 Strict alternative filtering
    parsed.alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives
          .filter(
            (alt) =>
              alt.name &&
              alt.brand &&
              alt.searchQuery &&
              typeof alt.confidence === "number" &&
              alt.confidence >= 80,
          )
          .map((alt) => ({
            name: alt.name,
            brand: alt.brand,
            reason: alt.reason || "",
            searchLink: `https://www.google.com/search?q=${encodeURIComponent(
              alt.searchQuery,
            )}`,
          }))
      : [];

    parsed.summary = typeof parsed.summary === "string" ? parsed.summary : "";

    parsed.detailedExplanation =
      typeof parsed.detailedExplanation === "string"
        ? parsed.detailedExplanation
        : "";

    // 🔥 Allergy override safety net
    const ingredientText = ingredients.join(" ").toLowerCase();

    user.allergies?.forEach((allergy) => {
      if (ingredientText.includes(allergy.toLowerCase())) {
        parsed.safe = false;
        parsed.severity = "critical";

        parsed.verdicts.push({
          category: "allergy",
          name: allergy,
          status: "danger",
          reason: `Contains ${allergy}`,
        });
      }
    });

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

router.get("/history", protect, async (req, res) => {
  try {
    const scans = await Scan.find({ user: req.user }).sort({ createdAt: -1 });

    res.json({
      success: true,
      history: scans,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch history",
    });
  }
});

module.exports = router;
