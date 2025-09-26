import { config } from "dotenv";
config();

import express from "express";
import runMultiToolAgent from "./src/agent.js";
import runExpertPlanner from "./src/routePlannerAgents.js";
import cors from 'cors';


// --- 1. Server Setup ---
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());
app.use(cors());
// --- 2. API Route Definition ---

// General citypulse endpoint
app.post("/api/citypulse", async (req, res) => {
  const { prompt, startLat, startLong, endLat, endLang } = req.body;
  console.log(`SERVER: Prompt: "${prompt}"`);
  console.log(`SERVER: Origin Location: Latitude=${startLat}, Longitude=${startLong}`);
  console.log(`SERVER: End Location: Latitude=${endLat}, Longitude=${endLang}`);

  if (!prompt && !startLat && !startLong && !endLat && !endLang) {
    return res.status(400).json({ error: "The 'prompt', 'latitude', and 'longitude' fields are required." });
  }

  try {
    const agentResponse = await runMultiToolAgent(prompt, startLat, startLong, endLat, endLang);
    res.status(200).json({ response: agentResponse });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "The agent failed to process your request." });
  }
});

// Route planner endpoint
app.post("/api/routePlanner", async (req, res) => {
  const { startCoordinates, endCoordinates } = req.body;

  if (!startCoordinates || !endCoordinates) {
    return res.status(400).json({ error: "Both 'startCoordinates' and 'endCoordinates' are required in the request body." });
  }

  try {
    const agentResponse = await runExpertPlanner({ startCoordinates, endCoordinates });
    res.status(200).json({ response: agentResponse });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "The route planner failed to process your request." });
  }
});

// --- 3. Start the Server ---
app.listen(port, () => {
  console.log(`CityPulse API server is running on http://localhost:${port}`);
  console.log("➡️ Send a POST request to /api/citypulse or /api/routePlanner");
});

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
