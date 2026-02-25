const scanRoutes = require("./routes/scanRoutes");
const ingredientRoutes = require("./routes/ingredientRoutes");
const rateLimit = require("express-rate-limit");
const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 5000;

require("dotenv").config();

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
console.log("userRoutes type:", typeof userRoutes);
const app = express();

app.use(cors());
app.use(express.json());
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many scan requests. Try again later.",
  },
});

app.use("/api/scan", scanLimiter);
app.use("/api/users", userRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/scan", scanRoutes);
connectDB();

app.get("/", (req, res) => {
  res.send("Food Scanner Backend Running 🚀");
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
