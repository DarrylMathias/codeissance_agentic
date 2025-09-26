// tools/placesTool.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config } from "dotenv";
config();

export const findNearbyPlaces = tool(
  async ({ latitude, longitude, keyword = "event", radius = 5000 }) => {
    console.log(`🔧 TOOL (Places): Input params - lat: ${latitude}, lng: ${longitude}, keyword: '${keyword}', radius: ${radius}`);
    
    // Validate required parameters
    if (latitude === undefined || longitude === undefined) {
      const errorMsg = "Error: Tool call failed because 'latitude' and 'longitude' are required. You MUST provide both coordinates to use this tool.";
      console.error(`❌ ${errorMsg}`);
      return errorMsg;
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      const errorMsg = `Error: Invalid latitude '${latitude}'. Must be between -90 and 90.`;
      console.error(`❌ ${errorMsg}`);
      return errorMsg;
    }

    if (longitude < -180 || longitude > 180) {
      const errorMsg = `Error: Invalid longitude '${longitude}'. Must be between -180 and 180.`;
      console.error(`❌ ${errorMsg}`);
      return errorMsg;
    }

    // Check API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      const errorMsg = "Error: Google Maps API key is missing from environment variables.";
      console.error(`❌ ${errorMsg}`);
      return errorMsg;
    }

    // Build API URL
    const baseUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
    const params = new URLSearchParams({
      location: `${latitude},${longitude}`,
      radius: radius.toString(),
      keyword: keyword,
      key: apiKey
    });
    const url = `${baseUrl}?${params.toString()}`;

    try {
      console.log(`🌐 TOOL (Places): Searching for '${keyword}' near ${latitude},${longitude} within ${radius}m`);
      console.log(`🌐 TOOL (Places): Fetching from Google Places API...`);
      
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'RouteePlanner/1.0'
        }
      });

      // Check API response status
      if (response.data.status === 'ZERO_RESULTS') {
        console.log(`No places found for '${keyword}' in this area`);
        return `No ${keyword} places found within ${radius}m of this location.`;
      } else if (response.data.status !== 'OK') {
        const errorMsg = `Google Places API Error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`;
        console.error(`API Error: ${errorMsg}`);
        return errorMsg;
      }

      const places = response.data.results;
      console.log(`✅ TOOL (Places): Found ${places.length} places`);

      if (places.length === 0) {
        return `No places found matching '${keyword}' near coordinates ${latitude}, ${longitude} within ${radius} meters.`;
      }

      // Format and limit results
      const simplifiedPlaces = places.slice(0, 5).map((place, index) => ({
        rank: index + 1,
        name: place.name,
        types: place.types.slice(0, 3), // Limit types to keep response manageable
        vicinity: place.vicinity,
        rating: place.rating || 'No rating',
        price_level: place.price_level !== undefined ? '$'.repeat(place.price_level + 1) : 'N/A',
        open_now: place.opening_hours?.open_now !== undefined ? 
          (place.opening_hours.open_now ? 'Open' : 'Closed') : 'Unknown'
      }));

      const result = {
        search_params: {
          location: `${latitude}, ${longitude}`,
          keyword: keyword,
          radius: `${radius}m`
        },
        total_found: places.length,
        showing: simplifiedPlaces.length,
        places: simplifiedPlaces
      };

      console.log(`✅ TOOL (Places): Returning ${simplifiedPlaces.length} formatted places`);
      return JSON.stringify(result, null, 2);

    } catch (error) {
      const errorMsg = `Error: Failed to fetch places data. ${error.message}`;
      console.error(`❌ TOOL (Places):`, error);
      
      // Provide more specific error information
      if (error.response) {
        console.error(`❌ Response status: ${error.response.status}`);
        console.error(`❌ Response data:`, error.response.data);
        return `${errorMsg} (HTTP ${error.response.status})`;
      } else if (error.request) {
        return `${errorMsg} (Network error - no response received)`;
      } else {
        return errorMsg;
      }
    }
  },
  {
    name: "findNearbyPlaces",
    description: "Finds points of interest (like events, restaurants, parks, etc.) near a specific geographic coordinate using Google Places API.",
    schema: z.object({
      latitude: z.union([z.string(), z.number()])
        .transform(val => {
          const num = Number(val);
          if (isNaN(num)) {
            throw new Error(`Invalid latitude: ${val}`);
          }
          return num;
        })
        .refine(val => val >= -90 && val <= 90, {
          message: "Latitude must be between -90 and 90"
        })
        .describe("The latitude of the location to search around (required, -90 to 90)."),
      
      longitude: z.union([z.string(), z.number()])
        .transform(val => {
          const num = Number(val);
          if (isNaN(num)) {
            throw new Error(`Invalid longitude: ${val}`);
          }
          return num;
        })
        .refine(val => val >= -180 && val <= 180, {
          message: "Longitude must be between -180 and 180"
        })
        .describe("The longitude of the location to search around (required, -180 to 180)."),
      
      keyword: z.string()
        .optional()
        .default("event")
        .describe("A keyword to search for (e.g., 'event', 'restaurant', 'park', 'hospital', 'gas station')."),
      
      radius: z.number()
        .optional()
        .default(5000)
        .refine(val => val > 0 && val <= 50000, {
          message: "Radius must be between 1 and 50000 meters"
        })
        .describe("The search radius in meters (1 to 50000, default: 5000).")
    })
  }
);

// Alternative tool for finding places by type instead of keyword
export const findNearbyPlacesByType = tool(
  async ({ latitude, longitude, type = "point_of_interest", radius = 5000 }) => {
    console.log(`🔧 TOOL (PlacesByType): Input params - lat: ${latitude}, lng: ${longitude}, type: '${type}', radius: ${radius}`);
    
    if (latitude === undefined || longitude === undefined) {
      return "Error: 'latitude' and 'longitude' are required parameters.";
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return "Error: Google Maps API key is missing.";
    }

    const baseUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
    const params = new URLSearchParams({
      location: `${latitude},${longitude}`,
      radius: radius.toString(),
      type: type,
      key: apiKey
    });

    try {
      console.log(`🌐 TOOL (PlacesByType): Searching for type '${type}' near ${latitude},${longitude}`);
      
      const response = await axios.get(`${baseUrl}?${params.toString()}`, {
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        return `Google Places API Error: ${response.data.status}`;
      }

      const places = response.data.results.slice(0, 5).map(place => ({
        name: place.name,
        types: place.types,
        vicinity: place.vicinity,
        rating: place.rating || 'No rating'
      }));

      return JSON.stringify({
        search_type: type,
        location: `${latitude}, ${longitude}`,
        places: places
      }, null, 2);

    } catch (error) {
      console.error("TOOL (PlacesByType) error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "findNearbyPlacesByType",
    description: "Finds places by specific Google Places type categories near a location.",
    schema: z.object({
      latitude: z.union([z.string(), z.number()]).transform(val => Number(val)),
      longitude: z.union([z.string(), z.number()]).transform(val => Number(val)),
      type: z.string().optional().default("point_of_interest")
        .describe("Google Places type (e.g., 'restaurant', 'gas_station', 'hospital', 'tourist_attraction')"),
      radius: z.number().optional().default(5000)
    })
  }
);

// Export both tools as an array for easy importing
export const placesTools = [findNearbyPlaces, findNearbyPlacesByType];