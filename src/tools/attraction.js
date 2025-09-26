import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config } from "dotenv";

config();

/**

* A combined tool that finds the most relevant attraction near a location

* and immediately calculates the real-time traffic route to it.

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

    console.log(
      `TOOL (AttractionRoute): Step 1 - Searching for '${finalKeyword}' near ${origin}`
    );

    let attraction;
    try {
      const response = await axios.get(nearbyUrl);
      const places = response.data.results;

      if (places.length === 0) {
        return `No popular places or attractions found matching '${finalKeyword}' within 5km of the specified location.`;
      }

      attraction = places[0]; // Top result
    } catch (error) {
      return `Error in Step 1 (Nearby Search): Failed to fetch places data. Details: ${error.message}`;
    }

    const destinationAddress = attraction.vicinity || attraction.name;
    const destinationId = `place_id:${attraction.place_id}`;

    // --- Step 2: Get Traffic Conditions ---
    const trafficUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destinationId}&key=${apiKey}&departure_time=now`;

    console.log(
      `TOOL (AttractionRoute): Step 2 - Getting traffic to '${destinationAddress}'`
    );

    try {
      const response = await axios.get(trafficUrl);
      const route = response.data.routes[0];

      if (!route) {
        return `Error in Step 2 (Directions): Could not find a route from ${origin} to ${destinationAddress}.`;
      }

      const leg = route.legs[0];

      const result = {
        attraction: {
          name: attraction.name,
          address: destinationAddress,
          types: attraction.types,
        },
        traffic_info: {
          distance: leg.distance.text,
          duration_without_traffic: leg.duration.text,
          duration_with_traffic: leg.duration_in_traffic.text,
          summary_route: route.summary,
        },
      };

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error in Step 2 (Directions): Failed to fetch traffic data. Details: ${error.message}`;
    }
  },
  {
    name: "findRouteAttraction",
    description:
      "Find nearby attractions and calculate real-time traffic route to them.",
    schema: z.object({
      keyword: z
        .string()
        .optional()
        .describe("Type of attraction to look for, e.g., park, museum, cafe."),
    }),
  }
);