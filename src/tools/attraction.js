// src/tools/attraction.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config } from "dotenv";

config();

/**
 * Combined tool: finds the most relevant attraction near a location
 * and calculates real-time traffic route to it.
 */
export const findRouteAttractionTool = tool(
  async ({ keyword }) => {
    // Hardcoded location for Bandra West, Mumbai
    const latitude = 19.054444;
    const longitude = 72.840556;

    const finalKeyword = keyword || "popular tourist attraction";
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return "Error: Google Maps API key is missing. Please set GOOGLE_MAPS_API_KEY in your .env file.";
    }

    const origin = `${latitude},${longitude}`;

    // --- Step 1: Find Nearby Place ---
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${origin}&radius=5000&keyword=${encodeURIComponent(
      finalKeyword
    )}&key=${apiKey}`;

    console.log(`TOOL (AttractionRoute): Searching for '${finalKeyword}' near ${origin}`);

    let attraction;
    try {
      const response = await axios.get(nearbyUrl);
      const places = response.data.results;

      if (!places || places.length === 0) {
        return `No popular places or attractions found matching '${finalKeyword}' within 5km.`;
      }

      attraction = places[0]; // Top result
    } catch (error) {
      return `Error in Step 1 (Nearby Search): ${error.message}`;
    }

    const destinationAddress = attraction.vicinity || attraction.name;
    const destinationId = `place_id:${attraction.place_id}`;

    // --- Step 2: Get Traffic Conditions ---
    const trafficUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destinationId}&key=${apiKey}&departure_time=now`;

    console.log(`TOOL (AttractionRoute): Getting traffic to '${destinationAddress}'`);

    try {
      const response = await axios.get(trafficUrl);
      const route = response.data.routes[0];

      if (!route) {
        return `Error in Step 2 (Directions): Could not find a route to ${destinationAddress}.`;
      }

      const leg = route.legs[0];

      // Friendly output for agent/LLM
      const result = `
Attraction: ${attraction.name}
Address: ${destinationAddress}
Type: ${attraction.types.join(", ")}

Travel Info:
- Distance: ${leg.distance.text}
- Estimated Duration (no traffic): ${leg.duration.text}
- Estimated Duration (with traffic): ${leg.duration_in_traffic.text}
- Route Summary: ${route.summary}
`;

      return result.trim();
    } catch (error) {
      return `Error in Step 2 (Directions): ${error.message}`;
    }
  },
  {
    name: "findRouteAttractionTool", // MUST match what the agent expects
    description: "Find nearby attractions and calculate real-time traffic route to them.",
    schema: z.object({
      keyword: z
        .string()
        .optional()
        .describe("Type of attraction to look for, e.g., park, museum, cafe."),
    }),
  }
);
