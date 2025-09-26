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

  // Prepare arguments
  const origin = `${startCoordinates.lat},${startCoordinates.lng}`;
  const destination = `${endCoordinates.lat},${endCoordinates.lng}`;

  // Call traffic tool directly
  const trafficResult = await getTrafficConditions.invoke({ origin, destination });

  // Call places tool for start and end
  const startPlaces = await findNearbyPlaces.invoke({ latitude: startCoordinates.lat, longitude: startCoordinates.lng });
  const endPlaces = await findNearbyPlaces.invoke({ latitude: endCoordinates.lat, longitude: endCoordinates.lng });

  // Synthesize a report
  const report = `Route Analysis Report\n\nTRAFFIC:\n${trafficResult}\n\nNEAR START (${origin}):\n${startPlaces}\n\nNEAR END (${destination}):\n${endPlaces}`;

  console.log("\n✅ Route Analysis Complete!");
  console.log("------------------------------------------");
  console.log(report);
  console.log("------------------------------------------");

  return report;
}
