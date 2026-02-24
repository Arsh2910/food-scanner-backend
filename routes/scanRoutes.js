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
Allergies: ${user.allergies.join(", ") || "None"}
Avoid: ${user.avoid.join(", ") || "None"}
Health Issues: ${user.healthIssues.join(", ") || "None"}

Ingredients:
${ingredients.join(", ")}

Analyze these ingredients for this user.

If the product is unsafe, suggest 3 SAFER REAL-WORLD BRANDED ALTERNATIVES commonly available in India or internationally.

IMPORTANT:
- Return ONLY raw JSON.
- Do NOT wrap in markdown.
- Do NOT include explanations outside JSON.
- Response must be directly parseable by JSON.parse().

If product is SAFE, alternatives array must be empty.

Return JSON in this format:

{
  "safe": true or false,
  "riskScore": 0-100,
  "severity": "low | medium | high | critical",
  "issues": [],
  "healthImpact": "",
  "alternatives": [
    {
      "name": "",
      "reason": "",
      "searchLink": ""
    }
  ],
  "summary": ""
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("RAW AI RESPONSE:", text);

    // Extract JSON safely
    let jsonString;

    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);

    if (markdownMatch) {
      jsonString = markdownMatch[1];
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

    // 🔥 Normalize output safely
    parsed.safe = typeof parsed.safe === "boolean" ? parsed.safe : false;

    parsed.riskScore =
      typeof parsed.riskScore === "number" ? parsed.riskScore : 50;

    parsed.issues = Array.isArray(parsed.issues) ? parsed.issues : [];

    parsed.alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives
      : [];

    parsed.severity = ["low", "medium", "high", "critical"].includes(
      parsed.severity,
    )
      ? parsed.severity
      : "low";

    parsed.healthImpact =
      typeof parsed.healthImpact === "string" ? parsed.healthImpact : "";

    parsed.summary = typeof parsed.summary === "string" ? parsed.summary : "";

    // 🔥 Backend Severity Override Logic
    const issuesText = parsed.issues.join(" ").toLowerCase();

    const allergyMatch = user.allergies.some((allergy) =>
      issuesText.includes(allergy.toLowerCase()),
    );

    if (allergyMatch) {
      parsed.severity = "critical";
      parsed.safe = false;
    } else if (!parsed.safe && parsed.severity === "low") {
      parsed.severity = "medium";
    }

    // 🔥 Ensure alternatives exist if unsafe
    if (!parsed.safe && parsed.alternatives.length === 0) {
      parsed.alternatives = [
        {
          name: "Search safer alternatives",
          reason: "AI did not provide branded options.",
          searchLink: `https://www.google.com/search?q=vegan+${ingredients[0]}+alternative`,
        },
      ];
    }

    console.log("FINAL RESULT:", parsed);

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
