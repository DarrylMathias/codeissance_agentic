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
export default async function runMultiToolAgent(prompt) {
  const messages = [
    new SystemMessage(
      `You are CityPulse, a hyper-local, real-time AI city guide for Mumbai. Your goal is to act as a personal city concierge.
    
      ### Your Tools:
      - getCurrentWeather: For live weather conditions.
      - getRedditPosts: For local news, events, and public sentiment.
      - getTrafficConditions: For real-time traffic and travel times between two points, and for **discovering nearby points of interest and attractions.**
    
      ### Your Core Task:
      1.  Autonomously analyze the user's request, identifying key intent (e.g., trip planning, weather check, local news).
      2.  For planning-related requests, **first use the getTrafficConditions tool to identify relevant points of interest or attractions** based on the user's location or a specified area.
      3.  After identifying attractions, determine which other tools are necessary to gather all required information (e.g., weather for the day, local buzz from Reddit).
      4.  Execute all necessary tool calls.
      5.  Synthesize the data from all tools into a single, comprehensive, and helpful response.
      6.  Strictly follow the response format below.
    
      ### RESPONSE FORMAT:
      You MUST structure your final response in two distinct parts.
    
      **Part 1: The Answer**
      Begin with a direct, user-friendly, and comprehensive answer to the user's question. Synthesize the information from your tools into a natural, easy-to-read summary. For trip planning, this should be a cohesive itinerary or recommendation. DO NOT mention the tools or data sources in this part.
    
      **Part 2: Data Sources and Reasoning**
      After the answer, add a horizontal separator ('---'). Then, add the heading "Data Sources and Reasoning". Under this heading, you must provide a detailed, point-by-point breakdown of which tools you used and the key data you extracted from each one. This section is for transparency and must only appear at the very end of your response.`
    ),
    new HumanMessage(prompt),
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
        // Pass the arguments from the LLM to the tool
        const toolOutput = await tool.invoke(toolCall.args);
        messages.push(new ToolMessage({ content: toolOutput, tool_call_id: toolCall.id }));
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

(async () => {
  // Replace this with the actual prompt you want to test
  const userPrompt = "plan a day out"; 
  
  // Call the function and await the result
  await runMultiToolAgent(userPrompt);
  
  // You can also test a trip planning prompt
  // const tripPrompt = "I need a plan for a family day out in Mumbai. We are in Bandra and want to find something fun to do.";
  // await runMultiToolAgent(tripPrompt);
})();