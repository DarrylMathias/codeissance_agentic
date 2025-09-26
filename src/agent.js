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
  const fullPrompt = latitude && longitude
    ? `${prompt}\n\n(Context: The user's current location is latitude: ${latitude}, longitude: ${longitude})`
    : prompt;
  console.log(fullPrompt);
  const messages = [
    new SystemMessage(
      `You are CityPulse, a hyper-local, real-time AI city guide for Mumbai. Your goal is to act as a personal city concierge.

      ### Your Tools:
      - getCurrentWeather: For live weather conditions.
      - getRedditPosts: For local news, events, and public sentiment.
      - getTrafficConditions: For real-time traffic and travel times between two points.

      ### Your Core Task:
      1.  Autonomously analyze the user's request.
      2.  Determine which tools are necessary to gather all required information.
      3.  Execute the tool calls.
      4.  Synthesize the data from all tools into a single, comprehensive response.
      5.  Strictly follow the response format below.

      ### RESPONSE FORMAT:
      You MUST structure your final response in two distinct parts.
    
      **Part 1: The Answer**
      Begin with a direct, user-friendly, and comprehensive answer to the user's question. Synthesize the information from your tools into a natural, easy-to-read summary. DO NOT mention the tools or data sources in this part.

      **Part 2: Data Sources and Reasoning**
      After the answer, add a horizontal separator ('---'). Then, add the heading "Data Sources and Reasoning". Under this heading, you must provide a detailed, point-by-point breakdown of which tools you used and the key data you extracted from each one. This section is for transparency and must only appear at the very end of your response.`
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

// // --- 3. CLI Support in ESM ---
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// if (process.argv[1] === __filename) {
//   const prompt =
//     process.argv[2] || "What's the best way to travel from Bandra to Thane today?";
//   const latitude = process.argv[3] ? parseFloat(process.argv[3]) : null;
//   const longitude = process.argv[4] ? parseFloat(process.argv[4]) : null;

//   runMultiToolAgent(prompt, latitude, longitude)
//     .then((result) => console.log(result))
//     .catch((err) => console.error("Error:", err.message));
// }

