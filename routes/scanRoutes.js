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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
If the product is unsafe, suggest 3 SAFER ALTERNATIVE BRANDS of the same product type.

Only suggest real-world branded products.

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

    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // Optional: extract JSON if Gemini adds extra explanation
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(500).json({
        success: false,
        message: "AI did not return valid JSON structure",
      });
    }

    const jsonString = match[0];
    console.log("RAW AI RESPONSE:");
    console.log(text);
    let parsed;

    try {
      parsed = JSON.parse(jsonString);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Invalid AI response format",
      });
    }
    // Default from AI
    let finalRisk = parsed.riskLevel || "low";

    // If any issue contains user allergy → HIGH
    const issuesText = parsed.issues.join(" ").toLowerCase();

    const allergyMatch = user.allergies.some((allergy) =>
      issuesText.includes(allergy.toLowerCase()),
    );

    if (allergyMatch) {
      finalRisk = "high";
    }

    // If safe false but no allergy → medium
    if (!parsed.safe && !allergyMatch) {
      finalRisk = "medium";
    }

    parsed.riskLevel = finalRisk;

    await Scan.create({
      user: user._id,
      ingredients,
      result: parsed,
    });

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gemini analysis failed",
    });
  }
});
router.get("/history", protect, async (req, res) => {
  try {
    const scans = await Scan.find({ user: req.user }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      history: scans,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});
module.exports = router;
