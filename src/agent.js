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
export default async function runMultiToolAgent(prompt, latitude, longitude) {
  if (!prompt) {
    throw new Error("A prompt must be provided.");
  }

  let fullPrompt = prompt;
  let toolCallOverride = null;

  // Add location context
  if (latitude && longitude) {
    fullPrompt = `${prompt}\n\n(Context: The user's current location is latitude: ${latitude}, longitude: ${longitude})`;

    // Force tool calls for nearby places if prompt mentions restaurants/food
    if (/places? near me|nearby places|good places|restaurant|dinner|cafe|food/i.test(prompt)) {
      toolCallOverride = {
        toolName: "findNearbyPlaces",
        args: { latitude: Number(latitude), longitude: Number(longitude) },
      };
    }

    // Force route planning if prompt mentions outing/day plan/trip
    if (/outing|day trip|day out|going out|attraction/i.test(prompt)) {
      toolCallOverride = {
        toolName: "findRouteAttractionTool",
        args: { keyword: "popular attraction" },
      };
    }
  }

  console.log("AGENT: Full prompt being sent to LLM:");
  console.log(fullPrompt);

  const messages = [
    new SystemMessage(
      `You are CityPulse, a hyper-local AI city guide for Mumbai. 
      Your tools: getCurrentWeather, getRedditPosts, getTrafficConditions, findNearbyPlaces, findRouteAttractionTool.
      Provide detailed itinerary-style answers for trips, restaurants, and attractions.`
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
