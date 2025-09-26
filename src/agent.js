import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { allTools } from "./tools/index.js";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

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
  const fullPrompt =
    latitude && longitude
      ? `${prompt}\n\n(Context: The user's current location is latitude: ${latitude}, longitude: ${longitude})`
      : prompt;

  console.log(
    "AGENT: Starting with user prompt at 10:10 PM IST, September 26, 2025..."
  );
  console.log(fullPrompt.substring(0, 200) + "...");

  const messages = [
    new SystemMessage(
      `You are CityPulse, a hyper-local, real-time AI city guide for Mumbai. Your goal is to act as a personal city concierge. Current date and time: 10:10 PM IST, September 26, 2025.

      ### Your Tools:
      - getCurrentWeather: For live weather conditions.
      - getRedditPosts: For local news, events, and public sentiment.
      - getTrafficConditions: For real-time traffic and travel times between two points.
      - findNearbyPlaces: For finding nearby locations based on user preferences.
      - getTwitterAlerts: For real-time weather and traffic alerts from official Mumbai Twitter accounts.

      ### Your Core Task:
      1. Analyze the user's request and determine which tools are necessary.
      2. Execute tool calls to gather required information (e.g., use getTwitterAlerts for weather/traffic updates).
      3. Synthesize the data from all tools into a comprehensive response.
      4. For prompts involving routes like Bandra to Thane, prioritize relevant traffic alerts (e.g., delays or alternate routes) in the answer without mentioning the source.
      5. Strictly follow the response format below.

      ### RESPONSE FORMAT:
      You MUST structure your final response in two distinct parts.

      **Part 1: The Answer**
      Begin with a direct, user-friendly, and comprehensive answer to the user's question. Synthesize the information from tools into a natural, easy-to-read summary. For example, if the prompt involves travel from Bandra to Thane, mention any relevant traffic delays or alternate routes without citing the source.

      **Part 2: Data Sources and Reasoning**
      After the answer, add a horizontal separator ('---'). Then, add the heading "Data Sources and Reasoning". Under this heading, provide a detailed, point-by-point breakdown:
      - Which tools you used and key data extracted.
      - Key insights from the tools (e.g., specific Twitter alerts for Bandra to Thane).
      - How you synthesized the information to form the answer.
      This section is for transparency and must only appear at the very end.`
    ),
    new HumanMessage(fullPrompt),
  ];

  console.log("AGENT: Processing request...");

  try {
    if (!prompt) {
      throw new Error("A prompt must be provided.");
    }

    let response = await llmWithTools.invoke(messages);

    while (response.tool_calls && response.tool_calls.length > 0) {
      console.log(
        `AGENT: LLM requested ${response.tool_calls.length} tool call(s).`
      );
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        console.log(`AGENT: Executing tool -> ${toolCall.name}`);
        const tool = toolMap[toolCall.name];
        // Pass the prompt to getTwitterAlerts for route-specific filtering
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
    return `Error: ${error.message}\n\n---\nData Sources and Reasoning:\n- Tools Used: None.\n- Synthesis: Could not provide recommendations due to error.`;
  }
}

// --- 3. CLI Support in ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  const prompt =
    process.argv[2] || "What's the best way to travel from Bandra to Thane today?";
  const latitude = process.argv[3] ? parseFloat(process.argv[3]) : null;
  const longitude = process.argv[4] ? parseFloat(process.argv[4]) : null;

  runMultiToolAgent(prompt, latitude, longitude)
    .then((result) => console.log(result))
    .catch((err) => console.error("Error:", err.message));
}
