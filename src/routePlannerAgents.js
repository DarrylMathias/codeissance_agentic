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
      - getTrafficConditions: Takes 'origin' and 'destination' as "latitude,longitude" strings.
      - findNearbyPlaces: Takes 'latitude' and 'longitude' as numbers.
      
      You must use the provided coordinates to call these tools. First, get the traffic for the whole route. Then, find nearby places for the start and end points separately. Finally, synthesize all information into a complete report.`],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = await createToolCallingAgent({ llm: model, tools: plannerTools, prompt });
  const agentExecutor = new AgentExecutor({ agent, tools: plannerTools });

  // 🔽🔽🔽 SIMPLIFIED DYNAMIC INPUT 🔽🔽🔽
  // We now give the agent a very simple, direct task.
  // The complex multi-step instructions are already in the system prompt.
  const dynamicInput = `My route starts at ${startCoordinates.lat},${startCoordinates.lng} and ends at ${endCoordinates.lat},${endCoordinates.lng}. Please provide your expert analysis.`;
  // 🔼🔼🔼 END OF UPDATE 🔼🔼🔼

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