// tools/index.js
import { getRedditPosts } from "./redditTools.js";
<<<<<<< HEAD
// import { getCurrentWeather } from "./weatherTool.js";

// This array contains every tool the agent has access to.
// To add a new tool, just import it and add it to this list.
export const allTools = [getRedditPosts, 
    // getCurrentWeather
=======
import { getCurrentWeather } from "./weatherTool.js";

// This array contains every tool the agent has access to.
// To add a new tool, just import it and add it to this list.
export const allTools = [getRedditPosts,
    getCurrentWeather
>>>>>>> c6b5ebad83412374cb1e443d2c760bd6625be2a0
];