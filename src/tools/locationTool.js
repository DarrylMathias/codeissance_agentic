// tools/placesTool.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config } from "dotenv";
config();

export const findNearbyPlacesTools = tool(
  async ({ latitude, longitude, keyword = "event", radius = 5000 }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return "Error: Google Maps API key is missing.";
    }
    if (
      latitude === undefined || longitude === undefined ||
      isNaN(Number(latitude)) || isNaN(Number(longitude))
    ) {
      return "Error: Both 'latitude' and 'longitude' must be valid numbers.";
    }
    if (keyword !== undefined && typeof keyword !== "string") {
      return "Error: 'keyword' must be a string if provided.";
    }
    if (radius !== undefined && (isNaN(Number(radius)) || Number(radius) <= 0)) {
      return "Error: 'radius' must be a positive number if provided.";
    }

    console.log(`Latitude ${latitude}, Longitude ${longitude}`);

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
    description: "Finds points of interest (like events or parks) near a specific geographic coordinate. Both latitude and longitude are required parameters.",
    schema: z.object({
      keyword: z.string().describe("A keyword to search for, e.g., 'event' or 'restaurant'."),
      latitude: z.number().describe("The latitude of the central point."),
      longitude: z.number().describe("The longitude of the central point."),
      radius: z.number().describe("The search radius in meters."),
    }),
  }
);