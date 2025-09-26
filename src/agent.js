// agents/multiToolAgent.js
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { allTools } from "./tools/index.js"; // Aggregated tools
import { config } from "dotenv";
config();

// --- 1. Setup LLM ---
const llm = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL,
  model: process.env.OLLAMA_MODEL || "llama3.1",
  temperature: 0,
});

// Bind tools to LLM
const llmWithTools = llm.bindTools(allTools);
const toolMap = Object.fromEntries(allTools.map((tool) => [tool.name, tool]));

// --- 2. Main Agent Function ---
export default async function runMultiToolAgent(prompt, startLat, startLong, endLat, endLang) {
  if (!prompt) {
    throw new Error("A prompt must be provided.");
  }

  let fullPrompt = prompt;
  let toolCallOverride = null;

  // Add location context
  const hasOrigin = typeof startLat !== "undefined" && typeof startLong !== "undefined" && !isNaN(Number(startLat)) && !isNaN(Number(startLong));
  const hasDestination = typeof endLat !== "undefined" && typeof endLang !== "undefined" && !isNaN(Number(endLat)) && !isNaN(Number(endLang));

  if (hasOrigin || hasDestination) {
    let contextStr = "";
    if (hasOrigin) contextStr += `(Origin: latitude: ${startLat}, longitude: ${startLong})`;
    if (hasDestination) contextStr += `${hasOrigin ? ", " : ""}(Destination: latitude: ${endLat}, longitude: ${endLang})`;
    fullPrompt = `${prompt}\n\n(Context: ${contextStr})`;

    // Prefer getPlacesAlongRoute for 'along the way' queries if at least one location is present
    if (/\b(along the way|on the way|en route|route|between|from .* to .*)\b/i.test(prompt) &&
      /(petrol pump|gas station|restaurant|food|cafe|places?|stop|break|eat|dinner|lunch|breakfast)/i.test(prompt)) {
      if (hasOrigin && hasDestination) {
        toolCallOverride = {
          toolName: "getPlacesAlongRoute",
          args: {
            startLat: Number(startLat),
            startLong: Number(startLong),
            endLat: Number(endLat),
            endLong: Number(endLang),
            keyword: "petrol pump"
          },
        };
      } else {
        // If only one location is present, fallback to nearby places
        const lat = hasOrigin ? Number(startLat) : Number(endLat);
        const long = hasOrigin ? Number(startLong) : Number(endLang);
        toolCallOverride = {
          toolName: "findNearbyPlaces",
          args: { latitude: lat, longitude: long },
        };
      }
    } else if (/places? near me|nearby places|good places|restaurant|dinner|cafe|food/i.test(prompt)) {
      // Fallback to nearby places if not 'along the way'
      const lat = hasOrigin ? Number(startLat) : Number(endLat);
      const long = hasOrigin ? Number(startLong) : Number(endLang);
      toolCallOverride = {
        toolName: "findNearbyPlaces",
        args: { latitude: lat, longitude: long },
      };
    }

    // Force route planning if prompt mentions outing/day plan/trip
    if (/outing|day trip|day out|going out|attraction/i.test(prompt)) {
      toolCallOverride = {
        toolName: "findRouteAttractionTool",
        args: { keyword: "popular attraction" },
      };
    }
  } else if (/\b(along the way|on the way|en route|route|between|from .* to .*)\b/i.test(prompt) &&
    /(petrol pump|gas station|restaurant|food|cafe|places?|stop|break|eat|dinner|lunch|breakfast)/i.test(prompt)) {
    // If neither location is present, but prompt is about 'along the way', return error early
    return "Error: Please provide both origin and destination coordinates to find places along the way.";
  }

  console.log("AGENT: Full prompt being sent to LLM:");
  console.log(fullPrompt);

  const messages = [
    new SystemMessage(
      `Of course. Here is the system prompt formatted for clarity and readability, using Markdown to structure the sections.

***

You are **CityPulse**, a hyper-local AI city guide and expert itinerary planner for Mumbai. Your primary purpose is to transform user requests, especially open-ended ones like "plan my day" or "show me around Bandra," into detailed, actionable itineraries.

### Your Tools
You have access to the following specialized tools:
- getPlacesAlongRoute: Your primary tool for itinerary creation. Given a start and end point, it returns a list of interesting places (restaurants, attractions, etc.) along that path with descriptions.
- getTrafficConditions: Provides real-time traffic and travel time estimates between two points.
- findNearbyPlaces: Finds points of interest around a single specific location.
- getCurrentWeather: Fetches the current weather conditions for Mumbai.
- getRedditPosts: Scans local subreddits for timely news, events, and public sentiment.

### Your Core Workflow for Itinerary Planning
When a user asks you to plan a trip, a tour, or their day, you **MUST** follow this reasoning process:

1.  **Establish a Route**
    * First, determine a logical start and end point for the itinerary.
    * If the user provides them (e.g., *"plan a trip from Colaba to Juhu"*), use those.
    * If the request is general (e.g., *"plan my day"*), you **must autonomously define a logical route**. A great default for a tourist is from the **"Gateway of India"** to **"Bandra Fort"**. Use common sense to create a route that fits the user's implied intent (sightseeing, food tour, etc.).

2.  **Gather Points of Interest**
    * Once a start and end point are established, your primary action is to call the getPlacesAlongRoute tool to get a list of potential stops.

3.  **Enrich the Itinerary**
    * Use your other tools to add crucial context and make the plan practical:
    * **Traffic:** Use getTrafficConditions to estimate travel times *between* the stops.
    * **Weather:** Use getCurrentWeather to add practical advice (e.g., *"It's sunny, so wear a hat"*).
    * **Details:** Use findNearbyPlaces if you need more options around a specific stop.
    * **Local Buzz:** Use getRedditPosts to check for sudden events, closures, or local tips relevant to the route.

4.  **Synthesize and Present**
    * Combine all information into a single, cohesive response.
    * Your final output **MUST** be a detailed, step-by-step itinerary, including:
        * **Suggested Timings:** (e.g., "10:00 AM - 11:30 AM").
        * **Location & Description:** What it is and why they should visit.
        * **Travel Notes:** (e.g., *"Expect a 20-minute cab ride to the next stop"*).
        * **Proactive Tips:** Based on weather, traffic, or local news.`
    ),
    new HumanMessage(fullPrompt),
  ];

  console.log("AGENT: Starting with user request...");

  try {
    let response = await llmWithTools.invoke(messages);

    // If there is a manual override, inject it as a ToolMessage
    if (toolCallOverride) {
      const overrideTool = toolMap[toolCallOverride.toolName];
      if (overrideTool) {
        const toolOutput = await overrideTool.invoke(toolCallOverride.args);
        messages.push(new ToolMessage({ content: toolOutput, tool_call_id: "manual-override" }));
        response = await llmWithTools.invoke(messages);
      }
    }

    // Handle tool calls from LLM
    while (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`AGENT: LLM requested ${response.tool_calls.length} tool call(s).`);
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const toolName = toolCall.name || "(missing)";
        console.log(`AGENT: Executing tool -> ${toolName}`);

        const tool = toolMap[toolCall.name];
        if (!tool) {
          console.warn(
            `⚠️ Tool "${toolCall.name}" not found. Available tools: ${Object.keys(toolMap).join(', ')}`
          );
          messages.push(
            new ToolMessage({
              content: `Error: Requested tool "${toolCall.name}" is not available.`,
              tool_call_id: toolCall.id
            })
          );
          continue; // skip invalid tool
        }

        const toolOutput = await tool.invoke({
          ...toolCall.args,
          prompt: fullPrompt,
        });
        messages.push(
          new ToolMessage({ content: toolOutput, tool_call_id: toolCall.id })
        );
      }

      console.log("AGENT: Feeding tool results back to LLM...");
      response = await llmWithTools.invoke(messages);
    }

    console.log("\n--- Final Answer ---");
    console.log(response.content);
    return response.content;

  } catch (error) {
    console.error("AGENT: An error occurred:", error.message);
    return `Error: ${error.message}`;
  }
}
