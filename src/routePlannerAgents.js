// agents/expertRoutePlannerAgent.js
import { ChatOllama } from "@langchain/ollama";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { config } from "dotenv";

import { getTrafficConditions } from "./tools/trafficTools.js";
import { findNearbyPlaces } from "./tools/locationTool.js";

config();

const plannerTools = [getTrafficConditions, findNearbyPlaces];

export default async function runExpertPlanner({ startCoordinates, endCoordinates }) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing Google Maps API key.");
  }

  console.log("🚀 Initializing Expert Route Planner Agent...");

  const model = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL || "llama3.1",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an expert route planner. Your task is to analyze a route defined by start and end coordinates. You have two tools:
      - getTrafficConditions: Requires an object with two properties: 'origin' and 'destination', both as non-empty strings in the format "latitude,longitude" (e.g., "19.07,72.87").
      - findNearbyPlaces: Requires an object with 'latitude' and 'longitude' as numbers (or numeric strings). Optionally, you can provide 'keyword' (string, default "event") and 'radius' (number, default 5000).

      STRICTLY ensure that when calling getTrafficConditions, you provide both 'origin' and 'destination' as non-empty strings in the correct format. When calling findNearbyPlaces, always provide valid numbers for 'latitude' and 'longitude'.

      First, get the traffic for the whole route using getTrafficConditions. Then, find nearby places for the start and end points separately using findNearbyPlaces. Finally, synthesize all information into a complete report.`],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = await createToolCallingAgent({ llm: model, tools: plannerTools, prompt });
  const agentExecutor = new AgentExecutor({ agent, tools: plannerTools });


  const dynamicInput = `My route starts at ${startCoordinates.lat},${startCoordinates.lng} and ends at ${endCoordinates.lat},${endCoordinates.lng}. Please provide your expert analysis.`;

  console.log(`Analyzing route with simplified prompt for coordinates: ${JSON.stringify(startCoordinates)} to ${JSON.stringify(endCoordinates)}...`);
  console.log("------------------------------------------");

  const result = await agentExecutor.invoke({ input: dynamicInput });

  console.log("\n✅ Route Analysis Complete!");
  console.log("------------------------------------------");
  console.log(result.output);
  console.log("------------------------------------------");

  return result.output;
}

// ... (Execution Block remains the same)