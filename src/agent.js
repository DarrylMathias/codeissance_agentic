// agents/multiToolAgent.js
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { allTools } from "./tools/index.js"; // Import the aggregated tools
import { config } from "dotenv";
config();

// --- 1. Setup ---
const llm = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL,
  model: process.env.OLLAMA_MODEL || "llama3.1",
  temperature: 0,
});

const llmWithTools = llm.bindTools(allTools);
const toolMap = Object.fromEntries(allTools.map((tool) => [tool.name, tool]));

// --- 2. Main Agent Logic ---
export default async function runMultiToolAgent(prompt, latitude, longitude) {
  let fullPrompt = prompt;
  let toolCallOverride = null;

  if (latitude && longitude) {
    fullPrompt = `${prompt}\n\n(Context: The user's current location is latitude: ${latitude}, longitude: ${longitude})`;
    
    // If the prompt is about places near the user, force a tool call with the correct args
    if (/places? near me|nearby places|good places/i.test(prompt)) {
      toolCallOverride = {
        toolName: "findNearbyPlaces",
        args: { latitude: Number(latitude), longitude: Number(longitude) }
      };
    }
  }

  console.log("AGENT: Full prompt being sent to LLM:");
  console.log(fullPrompt);

  const messages = [
    new SystemMessage(
      `YYou are CityPulse, a hyper-local, real-time AI city guide for Mumbai. Your goal is to act as a personal city concierge. Current date and time: 12:48 AM IST, September 27, 2025.

      ### Your Tools:
      - getCurrentWeather: For live weather conditions.
      - getRedditPosts: For local news, events, and public sentiment.
      - getTrafficConditions: For real-time traffic and travel times between two points.
      - findNearbyPlaces: For finding points of interest near a latitude/longitude.
      - findRouteAttractionTool: **Must be used when the user expresses interest in planning an outing, a day out, a day trip, going out, or looking for nearby attractions.** This tool provides both attraction discovery and travel route information.
      
      ### Your Core Task:
      1. Analyze the user’s request and determine intent.
      2. If the intent is related to trip planning, outings, or day planning, **immediately call the findRouteAttractionTool first** to identify a relevant attraction and get routing info.
      3. After identifying the attraction, enrich the plan by:
         - Checking live weather (to suggest the best time to leave or what to carry).
         - Optionally pulling local buzz (events, sentiment, crowds) via Reddit posts.
      4. Synthesize the collected data into a **comprehensive and detailed day plan**, including:
         - The main attraction (with a short intro about what it offers).
         - Travel details (expected travel time, traffic considerations).
         - What activities can be done there.
         - How much time to allocate.
         - Whether it is suitable for families, kids, or groups.
         - Suggestions for food, nearby spots, or evening wrap-up.
         - Pro tips (best time to go, avoid rush hours, etc.).
      
      ### RESPONSE FORMAT:
      You MUST structure your final response in two distinct parts.
      
      **Part 1: The Answer**  
      Provide a **rich, user-friendly itinerary-style answer**. For outing requests, this should read like a mini travel guide: what to expect, how long the trip might take, things to do, family suitability, and bonus recommendations. Make it engaging and easy to follow.
      
      **Part 2: Data Sources and Reasoning**  
      After the answer, add a horizontal separator ('---'). Then, add the heading "Data Sources and Reasoning". Under this heading, provide a detailed, point-by-point breakdown:
      - Which tools you used and key data extracted.
      - Key insights from each tool.
      - How you synthesized the final itinerary.
      This section is for transparency and must only appear at the very end.`
    ),
    new HumanMessage(fullPrompt),
  ];

  console.log("AGENT: Starting with user request...");

  try {
    if (!prompt) {
      throw new Error("A prompt must be provided.");
    }

    let response = await llmWithTools.invoke(messages);

    while (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`AGENT: LLM requested ${response.tool_calls.length} tool call(s).`);
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        console.log(`AGENT: Executing tool -> ${toolCall.name}`);
        const tool = toolMap[toolCall.name];
        if (!tool) {
          throw new Error(`Tool ${toolCall.name} not found in toolMap. Available tools: ${Object.keys(toolMap).join(', ')}`);
        }
        // Pass the prompt to tools for route-specific filtering
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
  }

}

// --- 3. Main Execution Block ---
(async () => {
  const prompt = "I want to have a good time today";
  // Hardcoded coordinates for Bandra West, Mumbai (Latitude: 19.0594, Longitude: 72.8259)
  const latitude = 19.0594;
  const longitude = 72.8259;
  console.log(`\n--- Running example with prompt: "${prompt}" ---\n`);
  const result = await runMultiToolAgent(prompt, latitude, longitude);
  console.log("FINAL RESULT:", result);
})();
