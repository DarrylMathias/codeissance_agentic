// tools/placesTool.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config } from "dotenv";
config();

export const findNearbyPlaces = tool(
  async ({ latitude, longitude, keyword = "event", radius = 5000 }) => {
    // This check happens AFTER the schema validation passes.
    if (latitude === undefined || longitude === undefined) {
      // This helpful error is sent back to the LLM, teaching it how to fix its mistake.
      return "Error: Tool call failed because 'latitude' and 'longitude' are missing. You MUST provide both coordinates to use this tool.";
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return "Error: Google Maps API key is missing.";
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;

    try {
      console.log(`TOOL (Places): Searching for '${keyword}' near ${latitude},${longitude}`);
      const response = await axios.get(url);
      const places = response.data.results;

      if (places.length === 0) {
        return `No places found matching '${keyword}' near the specified location.`;
      }

      const simplifiedPlaces = places.slice(0, 5).map(p => ({
        name: p.name,
        types: p.types,
        vicinity: p.vicinity,
      }));

      return JSON.stringify(simplifiedPlaces, null, 2);
    } catch (error) {
      return `Error: Failed to fetch places data. Details: ${error.message}`;
    }
  },
  {
    name: "findNearbyPlaces",
    description: "Finds points of interest (like events or parks) near a specific geographic coordinate.",
    schema: z.object({
      latitude: z.union([z.string(), z.number()]).optional()
        .transform(val => (val !== undefined ? Number(val) : undefined))
        .describe("The latitude of the location to search around."),
      longitude: z.union([z.string(), z.number()]).optional()
        .transform(val => (val !== undefined ? Number(val) : undefined))
        .describe("The longitude of the location to search around."),
      keyword: z.string().optional().describe("A keyword to search for, e.g., 'concert'."),
      radius: z.number().optional().describe("The search radius in meters."),
    }),
  }
);