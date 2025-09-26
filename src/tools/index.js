// src/tools/index.js
import { getRedditPosts } from "./redditTools.js";
import { getCurrentWeather } from "./weatherTool.js";
import { getTrafficConditions } from "./trafficTools.js";
import { findNearbyPlaces } from "./locationTool.js";
import { findRouteAttractionTool } from "./attraction.js";
import { getPlacesAlongRoute } from "./mapsPlacesTools.js";

// Aggregate all tools here
export const allTools = [
  getRedditPosts,
  getCurrentWeather,
  getTrafficConditions,
  findNearbyPlaces,
  findRouteAttractionTool,
  getPlacesAlongRoute
];
