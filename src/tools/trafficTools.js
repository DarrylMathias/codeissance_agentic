// tools/trafficTool.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config } from "dotenv";
config();

export const getTrafficConditions = tool(
  async (input) => {
    // Accept both origin/destination as strings and startLat/startLng/endLat/endLng as numbers/strings
    let origin, destination;
    if (input.origin && input.destination) {
      origin = input.origin;
      destination = input.destination;
    } else if (
      (input.startLat !== undefined && input.startLng !== undefined &&
        input.endLat !== undefined && input.endLng !== undefined)
    ) {
      origin = `${input.startLat},${input.startLng}`;
      destination = `${input.endLat},${input.endLng}`;
    } else {
      return "Error: Provide either {origin, destination} as strings or {startLat, startLng, endLat, endLng} as numbers.";
    }
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return "Error: Google Maps API key is missing. Please set GOOGLE_MAPS_API_KEY in your .env file.";
    }
    if (!origin || !destination || typeof origin !== "string" || typeof destination !== "string" || origin.trim() === "" || destination.trim() === "") {
      return "Error: Both 'origin' and 'destination' must be non-empty strings in the format 'latitude,longitude'.";
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${apiKey}&departure_time=now`;

    try {
      console.log(`TOOL (Traffic): Getting live traffic from '${origin}' to '${destination}'...`);
      const response = await axios.get(url);
      const route = response.data.routes[0];

      if (!route) {
        return `Error: Could not find a route between ${origin} and ${destination}.`;
      }

      const leg = route.legs[0];
      const trafficInfo = {
        origin: leg.start_address,
        destination: leg.end_address,
        distance: leg.distance.text,
        duration_without_traffic: leg.duration.text,
        duration_with_traffic: leg.duration_in_traffic.text,
      };

      return JSON.stringify(trafficInfo, null, 2);
    } catch (error) {
      return `Error: Failed to fetch traffic data. Details: ${error.message}`;
    }
  },
  {
    name: "getTrafficConditions",
    description: "Calculates the real-time travel time and traffic delay between two specific points in Mumbai using Google Maps. Use this to answer any questions about traffic.",
    schema: z.object({
      origin: z.string().optional().describe("The starting point as 'lat,lng' string."),
      destination: z.string().optional().describe("The ending point as 'lat,lng' string."),
      startLat: z.union([z.string(), z.number()]).optional().describe("The latitude of the starting point."),
      startLng: z.union([z.string(), z.number()]).optional().describe("The longitude of the starting point."),
      endLat: z.union([z.string(), z.number()]).optional().describe("The latitude of the ending point."),
      endLng: z.union([z.string(), z.number()]).optional().describe("The longitude of the ending point."),
    }),
  }
);