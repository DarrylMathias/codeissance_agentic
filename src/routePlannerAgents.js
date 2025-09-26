// agents/expertRoutePlannerAgent.js
import { Ollama } from "@langchain/ollama";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { config } from "dotenv";

// Import only the tools this agent needs
import { getTrafficConditions } from "./tools/trafficTools.js";
import { findNearbyPlaces } from "./tools/locationTool.js";

config();

// The agent's dedicated set of tools
const plannerTools = [getTrafficConditions, findNearbyPlaces];

/**
 * Main function for the Expert Route Planner Agent.
 * @param {object} startCoordinates - The starting coordinates { lat, lng }.
 * @param {object} endCoordinates - The ending coordinates { lat, lng }.
 * @returns {Promise<string>} The agent's final analysis.
 */

async function runExpertPlanner({ startCoordinates, endCoordinates }) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing Google Maps API key.");
  }

  console.log("🚀 Initializing Expert Route Planner Agent...");

  // --- Agent Setup ---
  const model = new Ollama({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL || "llama3.1",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert route planner. Your task is to analyze a given route for events and traffic information. You have access to specialized tools for finding traffic conditions and nearby places. Use them to find relevant details for the start and end of the route and synthesize a complete report."],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = await createOpenAIFunctionsAgent({ llm: model, tools: plannerTools, prompt });
  const agentExecutor = new AgentExecutor({ agent, tools: plannerTools });

  // --- Execution ---
  // Create a dynamic prompt for the agent based on the input coordinates
  const dynamicInput = `Provide a full analysis for the route starting at coordinates ${startCoordinates.lat},${startCoordinates.lng} and ending at ${endCoordinates.lat},${endCoordinates.lng}.
  1. First, check the current traffic conditions for the entire route.
  2. Next, find any interesting events or points of interest near the START location.
  3. Finally, find interesting events or points of interest near the END location.
  4. Synthesize all this information into a final, easy-to-read report.`;

  console.log(`Analyzing route from ${JSON.stringify(startCoordinates)} to ${JSON.stringify(endCoordinates)}...`);
  console.log("------------------------------------------");

  const result = await agentExecutor.invoke({ input: dynamicInput });

  console.log("\n✅ Route Analysis Complete!");
  console.log("------------------------------------------");
  console.log(result.output);
  console.log("------------------------------------------");

  return result.output;
}

async function testAgent() {
  const start = { lat: 19.0760, lng: 72.8777 }; // Mumbai Airport
  const end = { lat: 18.9220, lng: 72.8347 };   // Gateway of India

  await runExpertPlanner({ startCoordinates: start, endCoordinates: end });
}

// Run the test
testAgent().catch(console.error);