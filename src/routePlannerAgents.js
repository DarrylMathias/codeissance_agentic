// agents/expertRoutePlannerAgent.js
import { config } from "dotenv";
import { getTrafficConditions } from "./tools/trafficTools.js";
import { findNearbyPlaces } from "./tools/locationTool.js"; // Updated import path

config();

export default async function runExpertPlanner({ startCoordinates, endCoordinates }) {
  console.log("🚀 Starting Expert Route Planner...");

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error("❌ GOOGLE_MAPS_API_KEY is missing!");
    throw new Error("Missing Google Maps API key.");
  }
  console.log("✅ GOOGLE_MAPS_API_KEY loaded successfully");

  // Fix coordinate parsing - handle both object formats
  const startLat = startCoordinates.latitude || startCoordinates.lat;
  const startLng = startCoordinates.longitude || startCoordinates.lng;
  const endLat = endCoordinates.latitude || endCoordinates.lat;
  const endLng = endCoordinates.longitude || endCoordinates.lng;

  console.log("Start Coordinates:", { lat: startLat, lng: startLng });
  console.log("End Coordinates:", { lat: endLat, lng: endLng });

  // Validate coordinates
  if (!startLat || !startLng || !endLat || !endLng) {
    throw new Error("Invalid coordinates provided. Both start and end coordinates with latitude/longitude are required.");
  }

  try {
    const origin = `${startLat},${startLng}`;
    const destination = `${endLat},${endLng}`;
    console.log("🛣️ Origin:", origin);
    console.log("🛣️ Destination:", destination);

    // ✅ Traffic + ETA
    console.log("⚡ Fetching traffic conditions...");
    const trafficResult = await getTrafficConditions.invoke({ origin, destination });
    console.log("✅ Traffic result:", trafficResult);

    // ✅ Nearby places (start + end) - run in parallel for better performance
    console.log("⚡ Fetching nearby places...");
    const [startPlaces, endPlaces] = await Promise.all([
      findNearbyPlaces.invoke({
        latitude: parseFloat(startLat),
        longitude: parseFloat(startLng),
        keyword: "point_of_interest",
        radius: 2000
      }),
      findNearbyPlaces.invoke({
        latitude: parseFloat(endLat),
        longitude: parseFloat(endLng),
        keyword: "point_of_interest", 
        radius: 2000
      })
    ]);

    console.log("✅ Places fetched - Start:", typeof startPlaces);
    console.log("✅ Places fetched - End:", typeof endPlaces);

    // ✅ Build full report
    let report;
    
    if (typeof trafficResult === 'string') {
      // Handle error case
      report = `
📍 Route Analysis Report
========================

❌ Route Error: ${trafficResult}

🏁 Nearby Start Location (${origin}):
${startPlaces}

🏁 Nearby End Location (${destination}):
${endPlaces}

💡 Suggestion: Please verify that the coordinates are valid and accessible by road.
`;
    } else {
      // Handle success case
      report = `
📍 Route Analysis Report
========================

🛣️ Route Summary: ${trafficResult.summary}
📏 Distance: ${trafficResult.distance}
⏱️ Estimated Duration: ${trafficResult.duration}
🚦 Duration in Traffic: ${trafficResult.durationInTraffic}

🏁 Nearby Start Location (${origin}):
${startPlaces}

🏁 Nearby End Location (${destination}):
${endPlaces}

✅ Route planning completed successfully!
`;
    }

    console.log("🎯 Final Report Generated!");
    return report;

  } catch (err) {
    console.error("❌ Error inside runExpertPlanner:", err.message);
    console.error("❌ Stack trace:", err.stack);
    
    // Return a user-friendly error report
    const errorReport = `
📍 Route Analysis Report
========================

❌ System Error: ${err.message}

🔧 Troubleshooting:
- Verify Google Maps API key is valid and has proper permissions
- Check that Directions API and Places API are enabled
- Ensure coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
- Check network connectivity

📞 Contact support if the issue persists.
`;
    
    return errorReport;
  }
}

// Helper function to validate coordinates
function validateCoordinates(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    return { valid: false, error: "Coordinates must be valid numbers" };
  }
  
  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: "Latitude must be between -90 and 90" };
  }
  
  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: "Longitude must be between -180 and 180" };
  }
  
  return { valid: true };
}

// Enhanced version with validation
export async function runExpertPlannerWithValidation({ startCoordinates, endCoordinates }) {
  console.log("🚀 Starting Expert Route Planner with Validation...");
  
  // Extract coordinates
  const startLat = startCoordinates.latitude || startCoordinates.lat;
  const startLng = startCoordinates.longitude || startCoordinates.lng;
  const endLat = endCoordinates.latitude || endCoordinates.lat;
  const endLng = endCoordinates.longitude || endCoordinates.lng;
  
  // Validate start coordinates
  const startValidation = validateCoordinates(startLat, startLng);
  if (!startValidation.valid) {
    throw new Error(`Invalid start coordinates: ${startValidation.error}`);
  }
  
  // Validate end coordinates
  const endValidation = validateCoordinates(endLat, endLng);
  if (!endValidation.valid) {
    throw new Error(`Invalid end coordinates: ${endValidation.error}`);
  }
  
  // If validation passes, run the normal planner
  return runExpertPlanner({ startCoordinates, endCoordinates });
}

// Usage example:
/*
const result = await runExpertPlanner({
  startCoordinates: { latitude: '19.064', longitude: '72.83' },
  endCoordinates: { latitude: '19.098', longitude: '72.876' }
});
console.log(result);
*/