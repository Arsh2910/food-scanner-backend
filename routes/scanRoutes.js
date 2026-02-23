const protect = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional food safety analyzer.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    const aiText = completion.choices[0].message.content;

    const parsed = JSON.parse(aiText);

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "AI analysis failed",
    });
  }
});

module.exports = router;
