// tools/mapsPlacesTool.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";

export const getPlacesAlongRoute = tool(
  async ({ origin, destination, placeType = "police", radius = 5000, maxResults = 10, apiKey }) => {
    if (!apiKey) {
      return "Error: Google Maps API key is required. Please provide your API key.";
    }

    try {
      console.log(`TOOL (Maps): Finding ${placeType} along route from ${origin} to ${destination}...`);
      
      // Step 1: Get the route using Google Directions API
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json`;
      const directionsParams = {
        origin,
        destination,
        key: apiKey,
        alternatives: false
      };

      const directionsResponse = await axios.get(directionsUrl, { params: directionsParams });
      
      if (directionsResponse.data.status !== 'OK') {
        return `Failed to get route: ${directionsResponse.data.error_message || directionsResponse.data.status}`;
      }

      const route = directionsResponse.data.routes[0];
      const legs = route.legs;
      
      // Step 2: Extract waypoints along the route
      const waypoints = [];
      
      // Add origin
      waypoints.push({
        lat: legs[0].start_location.lat,
        lng: legs[0].start_location.lng,
        description: "Start"
      });

      // Sample points along each leg of the route
      legs.forEach((leg, legIndex) => {
        leg.steps.forEach((step, stepIndex) => {
          // Sample every few steps to avoid too many API calls
          if (stepIndex % 3 === 0) {
            waypoints.push({
              lat: step.start_location.lat,
              lng: step.start_location.lng,
              description: `Route point ${legIndex}-${stepIndex}`
            });
          }
        });
      });

      // Add destination
      const lastLeg = legs[legs.length - 1];
      waypoints.push({
        lat: lastLeg.end_location.lat,
        lng: lastLeg.end_location.lng,
        description: "End"
      });

      // Step 3: Search for places near each waypoint
      const allPlaces = [];
      const processedPlaceIds = new Set(); // To avoid duplicates

      for (const waypoint of waypoints) {
        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
        const placesParams = {
          location: `${waypoint.lat},${waypoint.lng}`,
          radius,
          type: placeType,
          key: apiKey
        };

        try {
          const placesResponse = await axios.get(placesUrl, { params: placesParams });
          
          if (placesResponse.data.status === 'OK') {
            placesResponse.data.results.forEach(place => {
              // Avoid duplicate places
              if (!processedPlaceIds.has(place.place_id)) {
                processedPlaceIds.add(place.place_id);
                
                allPlaces.push({
                  name: place.name,
                  address: place.vicinity,
                  rating: place.rating || null,
                  placeId: place.place_id,
                  location: {
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng
                  },
                  isOpen: place.opening_hours?.open_now || null,
                  nearWaypoint: waypoint.description
                });
              }
            });
          }
        } catch (placeError) {
          console.log(`Error searching places near waypoint ${waypoint.description}:`, placeError.message);
        }

        // Add small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 4: Sort by distance from route and limit results
      const limitedPlaces = allPlaces.slice(0, maxResults);

      const result = {
        route: {
          distance: route.legs.reduce((total, leg) => total + leg.distance.value, 0),
          duration: route.legs.reduce((total, leg) => total + leg.duration.value, 0),
          summary: route.summary
        },
        places: limitedPlaces,
        searchParams: {
          placeType,
          radius: `${radius}m`,
          totalFound: allPlaces.length,
          showing: limitedPlaces.length
        }
      };

      return JSON.stringify(result, null, 2);

    } catch (error) {
      return `Failed to find places along route: ${error.message}. Please check your API key and parameters.`;
    }
  },
  {
    name: "getPlacesAlongRoute",
    description: 
      "Finds specific types of places (like police stations, hospitals, gas stations, etc.) along a route between two locations using Google Maps API. " +
      "Returns detailed information about each place including name, address, rating, and location coordinates.",
    schema: z.object({
      origin: z.string().describe("Starting location (address, city, or coordinates like '40.7128,-74.0060')"),
      destination: z.string().describe("Ending location (address, city, or coordinates)"),
      placeType: z.string().optional().describe("Type of place to search for. Options include: 'police', 'hospital', 'gas_station', 'restaurant', 'atm', 'pharmacy', 'bank', etc. Defaults to 'police'"),
      radius: z.number().optional().describe("Search radius in meters around each route point. Defaults to 5000m (5km)"),
      maxResults: z.number().optional().describe("Maximum number of places to return. Defaults to 10"),
      apiKey: z.string().describe("Your Google Maps API key (required)")
    }),
  }
);