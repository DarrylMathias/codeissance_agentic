// agents/tools/trafficTools.js
import axios from "axios";

export const getTrafficConditions = {
  name: "getTrafficConditions",
  description: "Fetch route distance, duration, and traffic conditions using Google Maps Directions API",
  async invoke({ origin, destination }) {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) throw new Error("Missing Google Maps API key");

      // Encode the coordinates properly for URL
      const encodedOrigin = encodeURIComponent(origin);
      const encodedDestination = encodeURIComponent(destination);
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodedOrigin}&destination=${encodedDestination}&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

      console.log("🌐 API URL:", url.replace(apiKey, "***API_KEY***")); // Log URL without exposing API key

      const response = await axios.get(url);
      
      // Enhanced error handling
      if (response.data.status !== 'OK') {
        console.error("❌ API Error Status:", response.data.status);
        console.error("❌ API Error Message:", response.data.error_message);
        return `API Error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`;
      }

      if (!response.data.routes || response.data.routes.length === 0) {
        return "No routes found between the specified locations.";
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];
      
      return {
        distance: leg.distance.text,
        duration: leg.duration.text,
        durationInTraffic: leg.duration_in_traffic?.text || leg.duration.text,
        summary: route.summary,
        status: 'success'
      };
    } catch (error) {
      console.error("❌ Error in getTrafficConditions:", error.message);
      if (error.response) {
        console.error("❌ Response status:", error.response.status);
        console.error("❌ Response data:", error.response.data);
      }
      return `Error fetching traffic data: ${error.message}`;
    }
  }
};