🥗 NutriLens Backend

AI-Powered Personalized Food Ingredient Analysis API

NutriLens Backend is the server-side API for an AI-powered food safety scanner that evaluates ingredient lists based on a user's diet, allergies, and health conditions.

Built for a hackathon focused on preventive healthcare and intelligent food decision-making.

🚨 Problem

People struggle to interpret ingredient labels and determine whether packaged foods are safe for their:

Allergies (e.g., Gluten, Nuts)

Diet preferences (Keto, Vegan)

Health conditions (Diabetes, IBS, etc.)

Most existing solutions provide generic nutrition data, not personalized safety insights.

💡 Solution

This backend:

Analyzes ingredient lists using Google Gemini AI

Evaluates them against a personalized user profile

Generates structured safety verdicts (Safe / Warning / Danger)

Calculates a risk score

Suggests real branded alternatives when unsafe

Stores scan history

Allows saving and deleting scans

🛠 Tech Stack

Node.js

Express.js

MongoDB (Atlas)

Mongoose

Google Gemini API

JWT Authentication

Express Rate Limiting

Deployed on Render

⚙️ Core Features

🔐 User Registration & Login (JWT-based)

🤖 AI-powered structured ingredient analysis

📊 Risk scoring system

❤️ Save / Unsave scans

📜 Paginated scan history

🗑 Delete scans

🔁 Duplicate scan detection (user-level)

⚡ Ingredient hash-based caching

🛡 Rate limiting to protect AI usage

📡 API Endpoints
Base URL
https://nutrilens-015o.onrender.com
🔐 Authentication
POST   /api/users/register
POST   /api/users/login
🧪 Scan
POST   /api/scan
GET    /api/scan/history?page=1&limit=10
PUT    /api/scan/save/:id
GET    /api/scan/saved
DELETE /api/scan/:id

All scan routes require:

Authorization: Bearer <JWT_TOKEN>
🔄 Scan Processing Flow

Authenticate user (JWT)

Normalize ingredient list

Check duplicate scans (user-level)

Check global ingredient cache (hash-based)

Call Gemini API (if not cached)

Store structured result in MongoDB

Return structured JSON response

🔐 Environment Variables

Create a .env file:

PORT=5000
MONGO_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_jwt_secret
🧪 Run Locally

Install dependencies:

npm install

Start the server:

npm run dev

Server runs at:

http://localhost:5000
🌍 Live Deployment

Backend deployed on Render:

https://nutrilens-015o.onrender.com
🏆 Hackathon Context

NutriLens demonstrates:

Practical AI integration

Personalized health-based decision systems

Scalable backend architecture

Secure API design
