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
      "You are a helpful Mumbai city assistant. You have two tools: one to get the weather and one to get local news from Reddit. Use them to answer the user's question comprehensively. First, reason about which tools you need, then call them."
    ),
    new HumanMessage(
      "What's the general vibe in Mumbai today? Consider the weather and what people are talking about online."
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