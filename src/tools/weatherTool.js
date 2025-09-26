// tools/weatherTool.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config } from "dotenv";
config(); // Load environment variables

export const getCurrentWeather = tool(
  async () => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return "Error: OpenWeatherMap API key is missing. Please set OPENWEATHER_API_KEY in your .env file.";
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=Mumbai&appid=${apiKey}&units=metric`;

    try {
      console.log(`TOOL (Weather): Getting live weather for ${city}...`);
      const response = await axios.get(url);
      const data = response.data;

      // Extract the most important information from the rich API response
      const weatherInfo = {
        location: `${data.name}, ${data.sys.country}`,
        temperature: `${data.main.temp}°C`,
        feels_like: `${data.main.feels_like}°C`,
        humidity: `${data.main.humidity}%`,
        condition: data.weather[0]?.description || "No description",
        wind_speed: `${data.wind.speed} m/s`,
      };

      return JSON.stringify(weatherInfo, null, 2);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return `Error: Could not find weather information for the city "${city}".`;
      }
      return `Error: Failed to fetch weather data. Details: ${error.message}`;
    }
  },
  {
    name: "getCurrentWeather",
    description: "Gets the current, real-time weather for a specified city using a live API. Use this for any questions about weather conditions.",
    schema: z.object({
      city: z.string().describe("The city name, e.g., 'Mumbai'"),
    }),
  }
);