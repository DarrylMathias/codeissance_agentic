import { config } from "dotenv";
config();

import express from "express";
import runMultiToolAgent from "./src/agent.js";
import runExpertPlanner from "./src/routePlannerAgents.js";
import { findNearbyPlaces } from "./userfav.js"; // Import the middleware
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
  const { prompt, latitude, longitude } = req.body;
  console.log(`SERVER: Prompt: "${prompt}"`);
  console.log(`SERVER: Location: Latitude=${latitude}, Longitude=${longitude}`);

  if (!prompt && !latitude && !longitude) {
    return res.status(400).json({ error: "The 'prompt', 'latitude', and 'longitude' fields are required." });
  }

  try {
    const agentResponse = await runMultiToolAgent(prompt, latitude, longitude);
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

// Nearby places GET endpoint
app.get("/api/nearby-places", findNearbyPlaces);

// Nearby places POST endpoint - FIXED VERSION
app.post("/api/nearby-places", async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    // Validate input parameters
    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Latitude and longitude are required',
        message: 'Please provide lat and lng in the request body'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Latitude and longitude must be valid numbers'
      });
    }

    // Create a mock request object with query parameters for the middleware
    const mockReq = {
      query: {
        lat: latitude.toString(),
        lng: longitude.toString(),
        respond: 'true'
      },
      path: '/api/nearby-places'
    };

    // Create a mock response object to capture the middleware response
    let middlewareResponse = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          middlewareResponse = { status: code, data };
          return mockRes;
        }
      }),
      json: (data) => {
        middlewareResponse = { status: 200, data };
        return mockRes;
      }
    };

    // Call the middleware with mock objects
    await findNearbyPlaces(mockReq, mockRes, () => {});

    // Send the response
    if (middlewareResponse) {
      return res.status(middlewareResponse.status).json(middlewareResponse.data);
    } else {
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Unable to process nearby places request'
      });
    }

  } catch (error) {
    console.error('POST /api/nearby-places Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to fetch nearby places'
    });
  }
});

// --- 3. Start the Server ---
app.listen(port, () => {
  console.log(`CityPulse API server is running on http://localhost:${port}`);
  console.log("➡️ Send a POST request to /api/citypulse or /api/routePlanner");
  console.log("➡️ Send a GET request to /api/nearby-places?lat=<latitude>&lng=<longitude>");
  console.log("➡️ Send a POST request to /api/nearby-places with {lat, lng} in body");
});

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});