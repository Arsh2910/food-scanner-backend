const scanRoutes = require("./routes/scanRoutes");
const ingredientRoutes = require("./routes/ingredientRoutes");
const rateLimit = require("express-rate-limit");
const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 5000;

require("dotenv").config();

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");

const app = express();
app.set("trust proxy", 1);
// 🔥 Connect DB FIRST
connectDB();

// 🔥 Middlewares
app.use(cors());
app.use(express.json());

// 🔥 Rate Limiter for Scan (protect Gemini API)
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 scan requests per 15 min per IP
  message: {
    success: false,
    message: "Too many scan requests. Try again later.",
  },
});

// 🔥 Routes
app.use("/api/users", userRoutes);
app.use("/api/ingredients", ingredientRoutes);

// 👇 Apply limiter ONLY to scan route
app.use("/api/scan", scanLimiter, scanRoutes);

app.get("/", (req, res) => {
  res.send("Food Scanner Backend Running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
