// tools/redditTool.js
import { tool } from "@langchain/core/tools";
import axios from "axios";

export const getRedditPosts = tool(
  async () => {
    try {
      console.log("TOOL (Reddit): Fetching posts...");
      const response = await axios.get(
        "https://www.reddit.com/r/mumbai/rising/.json?limit=2"
      );
      const posts = response.data.data.children.map((post) => ({
        title: post.data.title,
        text: post.data.selftext,
      }));
      return JSON.stringify(posts, null, 2);
    } catch (error) {
      return "Failed to fetch Reddit posts.";
    }
  },
  {
    name: "getRedditPosts",
    description: "Fetches recent posts from the r/mumbai subreddit. Use this to understand the local news and general atmosphere of the city of Mumbai.",
  }
);