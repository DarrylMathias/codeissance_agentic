// tools/index.js
import { getRedditPosts } from "./redditTools.js";
import { getCurrentWeather } from "./weatherTool.js";
import { getTrafficConditions } from "./trafficTools.js";
import { findNearbyPlacesTools } from "./locationTool.js";

// This array contains every tool the agent has access to.
// To add a new tool, just import it and add it to this list.
export const allTools = [getRedditPosts,
    getCurrentWeather,
    getTrafficConditions,
    findNearbyPlacesTools
];