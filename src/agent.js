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
async function runMultiToolAgent() {
  const messages = [
    new SystemMessage(
      `You are CityPulse, a hyper-local, real-time AI city guide for Mumbai. Your primary goal is to act as a personal city concierge, helping users navigate their day by providing context-aware guidance for commuting, leisure, and errands.

      You have access to a set of real-time data tools:
      - getCurrentWeather: For live weather conditions.
      - getRedditPosts: For local news, events, and public sentiment.
      
      Your task is to autonomously analyze the user's request, determine which tools are necessary to gather the required information, execute the tool calls, and then synthesize the data into a single, comprehensive, and actionable response.
      
      Always be proactive in your suggestions. For example, if bad weather is detected, you should consider its impact on local events or traffic. Ensure your answers are transparent by citing your data sources (e.g., "According to the weather service..." or "Based on a discussion on Reddit...").
      
      Return the data in JSON format wherever applicable, and ensure your final response is clear, concise, and user-friendly.
      `
    ),
    new HumanMessage(
      "Today considering the weather, what are some good outdoor activities to do in Mumbai and where?"
    ),
  ];

  console.log("AGENT: Starting with user request...");

  try {
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
  } catch (error) {
    console.error("AGENT: An error occurred:", error.message);
  }
}

runMultiToolAgent();