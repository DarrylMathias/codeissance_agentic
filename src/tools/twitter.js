import axios from 'axios';
import { config } from "dotenv";

config();

// Twitter API configurations
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_API_URL = 'https://api.twitter.com/2';

// Debug function to check Bearer token and API access
async function debugTwitterAPI() {
  console.log("=".repeat(50));
  console.log("DEBUGGING TWITTER API CONNECTION");
  console.log("=".repeat(50));
  
  if (!TWITTER_BEARER_TOKEN) {
    console.log("❌ TWITTER_BEARER_TOKEN not found in environment variables");
    console.log("💡 Please add TWITTER_BEARER_TOKEN=your_bearer_token to your .env file");
    return false;
  }
  
  console.log("✅ TWITTER_BEARER_TOKEN found");
  console.log(`📝 Token length: ${TWITTER_BEARER_TOKEN.length} characters`);
  console.log(`📝 Token preview: ${TWITTER_BEARER_TOKEN.substring(0, 20)}...`);
  
  try {
    const response = await axios.get(`${TWITTER_API_URL}/tweets/search/recent`, {
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        query: 'hello world',
        max_results: 1
      },
      timeout: 10000
    });
    console.log("✅ Basic API connection successful");
    return true;
  } catch (error) {
    console.log("❌ Basic API connection failed");
    console.log(`📋 Status: ${error.response?.status}`);
    console.log(`📋 Error: ${error.response?.data?.title || error.message}`);
    console.log(`📋 Details: ${JSON.stringify(error.response?.data, null, 2)}`);
    
    if (error.response?.status === 400) {
      console.log("\n💡 Common causes of 400 errors:");
      console.log("   • Invalid Bearer Token format");
      console.log("   • Exceeded rate limits");
      console.log("   • Query syntax issues");
      console.log("   • Missing API permissions");
    }
    
    if (error.response?.status === 401) {
      console.log("\n💡 401 Unauthorized - Check your Bearer token");
    }
    
    if (error.response?.status === 429) {
      console.log("\n💡 429 Rate Limited - Wait before retrying");
    }
    
    return false;
  }
}

// Fetch weather alerts from Twitter
async function fetchWeatherAlertsTwitterV2() {
  try {
    console.log("🌤️ Fetching weather alerts from Twitter API v2...");
    
    if (!TWITTER_BEARER_TOKEN) {
      console.log("⚠️ No Twitter Bearer Token configured");
      return "Twitter Bearer Token not configured. Using mock data instead.";
    }
    
    const accounts = ['MahanagarPalika', 'MumbaiPolice', 'mybmc'];
    let allAlerts = "OFFICIAL WEATHER ALERTS FROM MUMBAI AUTHORITIES:\n\n";
    let hasResults = false;
    
    for (const account of accounts) {
      try {
        const query = `from:${account} (weather OR rain OR storm)`;
        
        console.log(`🔍 Searching: ${query}`);
        
        const response = await axios.get(`${TWITTER_API_URL}/tweets/search/recent`, {
          headers: {
            'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: {
            query: query,
            max_results: 5,
            'tweet.fields': 'created_at,text',
          },
          timeout: 15000
        });

        if (response.data?.data && response.data.data.length > 0) {
          hasResults = true;
          console.log(`✅ Found ${response.data.data.length} tweets from @${account}`);
          
          response.data.data.forEach((tweet) => {
            allAlerts += `ALERT from @${account}:\n`;
            allAlerts += `${tweet.text}\n`;
            allAlerts += `Time: ${new Date(tweet.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n`;
          });
        } else {
          console.log(`ℹ️ No recent tweets found from @${account}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (queryError) {
        console.log(`❌ Failed to fetch from @${account}: ${queryError.response?.status} - ${queryError.message}`);
        
        if (queryError.response?.status === 429) {
          console.log("⏳ Rate limited, waiting 60 seconds...");
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    }
    
    return hasResults ? allAlerts : "No recent weather alerts found from official Mumbai accounts.";
      
  } catch (error) {
    console.error("❌ Error in fetchWeatherAlertsTwitterV2:", error.message);
    return `Unable to fetch live weather alerts: ${error.message}. Using fallback data.`;
  }
}

// Fetch traffic alerts from Twitter, including Bandra to Thane route
async function fetchTrafficAlertsTwitterV2() {
  try {
    console.log("🚗 Fetching traffic alerts from Twitter API v2...");
    
    if (!TWITTER_BEARER_TOKEN) {
      return "Twitter Bearer Token not configured. Using mock data instead.";
    }
    
    const accounts = ['MumbaiPolice', 'MahanagarPalika'];
    let allAlerts = "OFFICIAL TRAFFIC ALERTS FROM MUMBAI AUTHORITIES:\n\n";
    let hasResults = false;
    
    for (const account of accounts) {
      try {
        const query = `from:${account} (traffic OR road OR accident OR Bandra OR Thane)`;
        console.log(`🔍 Searching: ${query}`);
        
        const response = await axios.get(`${TWITTER_API_URL}/tweets/search/recent`, {
          headers: {
            'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: {
            query: query,
            max_results: 5,
            'tweet.fields': 'created_at,text',
          },
          timeout: 15000
        });

        if (response.data?.data && response.data.data.length > 0) {
          hasResults = true;
          console.log(`✅ Found ${response.data.data.length} traffic updates from @${account}`);
          
          response.data.data.forEach((tweet) => {
            allAlerts += `TRAFFIC UPDATE from @${account}:\n`;
            allAlerts += `${tweet.text}\n`;
            allAlerts += `Time: ${new Date(tweet.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n`;
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (queryError) {
        console.log(`❌ Failed to fetch traffic updates from @${account}: ${queryError.response?.status} - ${queryError.message}`);
      }
    }
    
    return hasResults ? allAlerts : "No recent traffic alerts found from official Mumbai accounts.";
      
  } catch (error) {
    console.error("❌ Error in fetchTrafficAlertsTwitterV2:", error.message);
    return `Unable to fetch live traffic alerts: ${error.message}. Using fallback data.`;
  }
}

// Mock data including a Bandra to Thane route post
async function getMockAlerts() {
  console.log("🔄 Using enhanced mock data for demonstration...");
  
  const currentTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const oneHourAgo = new Date(Date.now() - 3600000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const twoHoursAgo = new Date(Date.now() - 7200000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  const mockWeatherAlerts = `OFFICIAL WEATHER ALERTS FROM MUMBAI AUTHORITIES:

ALERT from @MahanagarPalika:
IMD predicts moderate to heavy rainfall in Mumbai today between 2 PM - 8 PM. Citizens advised to avoid low-lying areas. BMC emergency helpline: 1916 is operational.
Time: ${currentTime}

ALERT from @MumbaiPolice:
Weather Update: Light to moderate rain expected. Drive carefully, maintain safe distance. Avoid speeding on wet roads. Emergency dial 100.
Time: ${oneHourAgo}

ALERT from @mybmc:
Monsoon preparedness: Keep important documents safe. Avoid unnecessary travel during peak hours 4-7 PM today due to expected heavy rainfall.
Time: ${twoHoursAgo}

`;

  const mockTrafficAlerts = `OFFICIAL TRAFFIC ALERTS FROM MUMBAI AUTHORITIES:

TRAFFIC UPDATE from @MumbaiPolice:
Heavy traffic on Western Express Highway from Bandra to Thane due to vehicle breakdown near Kherwadi. Expect 30-40 min delays. Consider using Eastern Express Highway via Ghatkopar.
Time: ${currentTime}

TRAFFIC UPDATE from @MumbaiPolice:
Construction work at Bandra-Worli Sea Link toll plaza. Traffic moving slowly. Allow extra 20-30 minutes for South Mumbai to Bandra route.
Time: ${oneHourAgo}

TRAFFIC UPDATE from @MahanagarPalika:
Tree fell on LBS Road near Kurla station due to strong winds. One lane blocked. BMC team clearing the obstruction. Expect delays.
Time: ${twoHoursAgo}

`;

  return { weatherAlerts: mockWeatherAlerts, trafficAlerts: mockTrafficAlerts };
}

// Twitter tool for integration with agent
const getTwitterAlerts = {
  name: "getTwitterAlerts",
  description: "Fetches real-time weather and traffic alerts from official Mumbai Twitter accounts.",
  invoke: async (args) => {
    try {
      const prompt = args.prompt || "";
      const isRouteSpecific = /Bandra.*Thane|Thane.*Bandra/i.test(prompt);
      let weatherAlerts, trafficAlerts;
      let usingLiveData = false;

      const hasToken = !!process.env.TWITTER_BEARER_TOKEN;
      if (hasToken) {
        const apiWorking = await debugTwitterAPI();
        if (apiWorking) {
          console.log("✅ Using live Twitter data");
          weatherAlerts = await fetchWeatherAlertsTwitterV2();
          trafficAlerts = await fetchTrafficAlertsTwitterV2();
          usingLiveData = true;
        } else {
          console.log("🔄 Falling back to mock data");
        }
      } else {
        console.log("🔄 No Twitter API token, using mock data");
      }

      if (!usingLiveData) {
        const mockData = await getMockAlerts();
        weatherAlerts = mockData.weatherAlerts;
        trafficAlerts = mockData.trafficAlerts;
      }

      let filteredTrafficAlerts = trafficAlerts;
      if (isRouteSpecific) {
        filteredTrafficAlerts = trafficAlerts
          .split('\n\n')
          .filter(alert => /Bandra.*Thane|Thane.*Bandra/i.test(alert))
          .join('\n\n') || "No specific Bandra to Thane traffic alerts found.";
      }

      const alertsSummary = `Current Weather Alerts:\n${weatherAlerts}\n\nCurrent Traffic Alerts:\n${filteredTrafficAlerts}`;

      return JSON.stringify({
        alertsSummary,
        dataSource: usingLiveData ? 'live' : 'mock',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching Twitter alerts:", error.message);
      return JSON.stringify({
        alertsSummary: "No current alerts available due to an error.",
        dataSource: 'error',
        timestamp: new Date().toISOString()
      });
    }
  }
};

export { debugTwitterAPI, fetchWeatherAlertsTwitterV2, fetchTrafficAlertsTwitterV2, getMockAlerts, getTwitterAlerts };