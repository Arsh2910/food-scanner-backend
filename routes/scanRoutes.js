const protect = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
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

Return ONLY valid JSON in this format:

{
  "safe": true or false,
  "issues": [],
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
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    const jsonString = cleaned.substring(firstBrace, lastBrace + 1);

    const parsed = JSON.parse(jsonString);

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gemini analysis failed",
    });
  }
});

module.exports = router;
