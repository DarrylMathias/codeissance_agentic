// tools/index.js
import { getRedditPosts } from "./redditTools.js";
import { getCurrentWeather } from "./weatherTool.js";
import { getTrafficConditions } from "./trafficTools.js"; 
import { getLocationTool } from "./locationTool.js" // detail of event along with route

// This array contains every tool the agent has access to.
// To add a new tool, just import it and add it to this list.
export const allTools = [getRedditPosts,
    getCurrentWeather,
    getTrafficConditions,
    getLocationTool
];