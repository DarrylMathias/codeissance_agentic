import { tool } from "@langchain/core/tools";

import { z } from "zod";

import axios from "axios";

import { config } from "dotenv";

config();

// Define the fixed route details

const ORIGIN = "Andheri East, Mumbai";

const DESTINATION = "Nariman Point, Mumbai";

/**


 * Helper function to calculate the Unix timestamp (in seconds) for the next Saturday at 9:00 AM.


 * This is necessary for the Google Maps Directions API to return expected travel times for Transit.


 */

const getNextSaturday9AMTimestamp = () => {
  const now = new Date();

  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate days until next Saturday (6)

  let daysUntilSaturday = 6 - dayOfWeek;

  // If today is Saturday, we look for the Saturday in 7 days

  if (dayOfWeek === 6) {
    daysUntilSaturday = 7;
  }

  const nextSaturday = new Date(now);

  // Move to the date of the next Saturday

  nextSaturday.setDate(now.getDate() + daysUntilSaturday);

  // Set the time to 9:00 AM (in local time, which the Date object handles before converting to UTC epoch)

  nextSaturday.setHours(9, 0, 0, 0);

  // Return the timestamp in seconds (required by Google Maps API)

  return Math.floor(nextSaturday.getTime() / 1000);
};

/**


 * A tool that finds all available commute options (Driving, Transit, Walking, Bicycling)


 * between Andheri East and Nariman Point in Mumbai, calculated for the next Saturday at 9 AM.


 */

export const getMumbaiCommuteOptions = tool(
  async () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return "Error: Google Maps API key is missing. Please set GOOGLE_MAPS_API_KEY in your .env file.";
    }

    const departureTime = getNextSaturday9AMTimestamp();

    const commuteModes = ["driving", "transit", "walking", "bicycling"];

    const results = [];

    console.log(
      `TOOL (MumbaiCommute): Calculating routes for Saturday 9:00 AM (Timestamp: ${departureTime})`
    );

    // Iterate through all specified modes of transport

    for (const mode of commuteModes) {
      let trafficUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        ORIGIN
      )}&destination=${encodeURIComponent(
        DESTINATION
      )}&key=${apiKey}&mode=${mode}`;

      // Transit mode REQUIRES a departure_time for accurate scheduling

      // Driving mode also benefits from departure_time for historical traffic data

      if (mode === "driving" || mode === "transit") {
        trafficUrl += `&departure_time=${departureTime}`;
      }

      console.log(`TOOL (MumbaiCommute): Fetching route for mode: ${mode}`);

      try {
        const response = await axios.get(trafficUrl);

        const route = response.data.routes[0];

        if (route) {
          const leg = route.legs[0];

          // Directions API uses 'duration_in_traffic' only for driving mode when 'departure_time' is set.

          const durationWithTraffic = leg.duration_in_traffic
            ? leg.duration_in_traffic.text
            : null;

          results.push({
            mode: mode.toUpperCase(),

            distance: leg.distance.text,

            duration: leg.duration.text, // Base duration

            duration_in_traffic: durationWithTraffic,

            summary_route: route.summary || "Direct route.",
          });
        } else {
          console.log(`No route found for ${mode}.`);
        }
      } catch (error) {
        // Log the error but don't fail the entire tool execution

        console.error(`Error fetching route for ${mode}: ${error.message}`);

        results.push({
          mode: mode.toUpperCase(),

          error: `Failed to find a route for this mode.`,
        });
      }
    }

    if (results.length === 0) {
      return `Error: Could not find any commute options between ${ORIGIN} and ${DESTINATION} for the specified time.`;
    }

    return JSON.stringify(
      {
        origin: ORIGIN,

        destination: DESTINATION,

        target_time: "Next Saturday at 9:00 AM",

        commute_options: results,
      },
      null,
      2
    );
  },

  {
    name: "getMumbaiCommuteOptions",

    description:
      "Calculates the available commute options (Driving, Transit, Walking, Bicycling) between Andheri East, Mumbai, and Nariman Point, Mumbai. The calculation is hardcoded to use a departure time of the next Saturday at 9:00 AM, using historical or scheduled data where available.",

    schema: z.object({
      // No parameters are needed as all inputs are hardcoded
    }),
  }
);
