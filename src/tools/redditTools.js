// tools/redditTool.js
import { tool } from "@langchain/core/tools";
import { z } from "zod"; // We'll use Zod to define the input schema
import axios from "axios";

export const getRedditPosts = tool(
  // The tool now accepts an optional 'subreddit' argument
  async ({ subreddit } = {}) => {
    // A curated list of relevant subreddits. Reddit's API lets us query
    // them all at once by joining their names with a '+'
    const defaultSubreddits = [
      "mumbai",
      "mumbaifood",
      "IndiaSocial", // Often has relevant discussions from Mumbaikars
      "MumbaiIndians", // For sports and local events
    ].join("+");

    // Use the LLM's specified subreddit, or fall back to our default list
    const targetSubreddit = subreddit || defaultSubreddits;
    const url = `https://www.reddit.com/r/${targetSubreddit}/hot/.json?limit=10`;

    try {
      console.log(`TOOL (Reddit): Fetching posts from r/${targetSubreddit}...`);
      const response = await axios.get(url);

      const posts = response.data.data.children.map((post) => ({
        subreddit: post.data.subreddit, // It's useful to know where the post came from
        title: post.data.title,
        text: post.data.selftext,
        url: `https://reddit.com${post.data.permalink}`,
      }));
      return JSON.stringify(posts, null, 2);
    } catch (error) {
      return `Failed to fetch Reddit posts from r/${targetSubreddit}. The subreddit may not exist or there was a network error.`;
    }
  },
  {
    name: "getRedditPosts",
    description:
      "Fetches hot posts from relevant Mumbai-focused subreddits (mumbai, mumbaifood, etc.). Use this to understand local news, events, and the general atmosphere of the city. You can optionally specify a single subreddit to query for more targeted information.",
    // Define the expected input schema for the LLM
    schema: z.object({
      subreddit: z.string().optional().describe("A specific subreddit to query, e.g., 'mumbaifood'. If omitted, a general list of Mumbai subreddits will be used."),
    }),
  }
);