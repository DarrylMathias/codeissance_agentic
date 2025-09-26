// server.js
import express from "express";
import runMultiToolAgent from "./src/agent.js"; // Import the agent function

// --- 1. Server Setup ---
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// --- 2. API Route Definition ---
app.post("/api/citypulse", async (req, res) => {
  // Extract the prompt from the request body
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "The 'prompt' field is required in the request body." });
  }

  try {
    // Call the agent function and wait for the result
    const agentResponse = await runMultiToolAgent(prompt);
    
    // Send the agent's final answer back as a JSON response
    res.status(200).json({ response: agentResponse });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "The agent failed to process your request." });
  }
});

// --- 3. Start the Server ---
app.listen(port, () => {
  console.log(`CityPulse API server is running on http://localhost:${port}`);
  console.log("Send a POST request to /api/citypulse to interact with the agent.");
});