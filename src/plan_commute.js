import { ChatOllama } from "@langchain/ollama";

import { createToolCallingAgent, AgentExecutor } from "langchain/agents";

import { ChatPromptTemplate } from "@langchain/core/prompts";

import { config } from "dotenv";

// Import the hardcoded commute tool from the local file

// NOTE: Ensure 'mumbai_commute_tool.js' is accessible from this agent file.

import { getMumbaiCommuteOptions } from "./tools/personal_commute.js";

config();

// The agent's dedicated set of tools

const commuteTools = [getMumbaiCommuteOptions];

/**


 * Main function for the Mumbai Commute Agent.


 * This agent uses the hardcoded tool to get pre-defined commute options


 * between Andheri East and Nariman Point for Saturday 9:00 AM.


 * @returns {Promise<string>} The agent's final analysis.


 */

async function runCommuteAgent() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY key in .env file.");
  }

  console.log("🚀 Initializing Mumbai Commute Agent...");

  // --- Agent Setup ---

  // The model used here should be capable of tool calling (like Llama 3.1 or GPT-4o)

  const model = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL,

    model: process.env.OLLAMA_MODEL || "llama3.1",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are an expert Mumbai route and transport analyst. Your task is to use the 'getMumbaiCommuteOptions' tool to retrieve hardcoded travel data (Andheri East to Nariman Point on Saturday 9 AM). You must execute the tool without asking for user input, then analyze the results, clearly stating the distance, and the estimated duration for each mode (Driving, Transit, Walking, Bicycling). Finally, highlight the **fastest** overall option.",
    ],

    [
      "human",
      "Analyze the predefined commute options for Mumbai and provide a detailed, easy-to-read summary.",
    ],

    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = await createToolCallingAgent({
    llm: model,
    tools: commuteTools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({ agent, tools: commuteTools });

  // --- Execution ---

  // The input is simple because the tool requires no parameters. The query instructs the model to use the tool.

  const staticInput = `Analyze the predefined commute options for Andheri East to Nariman Point for next Saturday at 9:00 AM.`;

  console.log("------------------------------------------");

  const result = await agentExecutor.invoke({ input: staticInput });

  console.log("\n✅ Commute Analysis Complete!");

  console.log("------------------------------------------");

  console.log(result.output);

  console.log("------------------------------------------");

  return result.output;
}

async function testAgent() {
  await runCommuteAgent();
}

// Run the test

testAgent().catch(console.error);
