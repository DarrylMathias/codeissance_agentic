import express from "express";
import axios from "axios";

const router = express.Router();

// Cache for storing news data temporarily
const newsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// News API configurations
const NEWS_APIS = {
  newsapi: {
    baseUrl: "https://newsapi.org/v2/everything",
    key: process.env.NEWS_API_KEY,
    params: (query, limit = 5) => ({
      q: query,
      apiKey: process.env.NEWS_API_KEY,
      language: "en",
      pageSize: limit,
    }),
  },
  gnews: {
    baseUrl: "https://gnews.io/api/v4/search",
    key: process.env.GNEWS_API_KEY,
    params: (query, limit = 5) => ({
      q: query,
      token: process.env.GNEWS_API_KEY,
      lang: "en",
      max: limit,
    }),
  },
  mediastack: {
    baseUrl: "https://api.mediastack.com/v1/news",
    key: process.env.MEDIASTACK_API_KEY,
    params: (query, limit = 5) => ({
      access_key: process.env.MEDIASTACK_API_KEY,
      keywords: query,
      limit,
      languages: "en",
      sort: "published_desc",
    }),
  },
};

// Fetch news from a given API
async function fetchNewsFromAPI(apiName, query, limit = 5) {
  const api = NEWS_APIS[apiName];
  if (!api || !api.key) throw new Error(`${apiName} API not configured or key missing`);

  const response = await axios.get(api.baseUrl, { params: api.params(query, limit), timeout: 10000 });

  const articles = apiName === "mediastack" ? response.data.data || [] : response.data.articles || [];

  return articles.map((article) => ({
    title: article.title || "No title",
    description: article.description || article.content || "No description",
    url: article.url || "#",
    source: article.source?.name || article.source || "Unknown Source",
    publishedAt: article.publishedAt || article.published_at || new Date().toISOString(),
    urlToImage: article.urlToImage || article.image || null,
  }));
}

// POST /api/news - Single route for location-based real-time news
router.post("/", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Both 'latitude' and 'longitude' are required." });
    }

    const cacheKey = `${latitude},${longitude}`;
    if (newsCache.has(cacheKey)) {
      const cached = newsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        return res.json({ success: true, data: cached.news, cached: true });
      }
      newsCache.delete(cacheKey);
    }

    const query = `${latitude},${longitude}`; // Use coordinates as query for location

    // Get all available APIs
    const availableAPIs = Object.keys(NEWS_APIS).filter((api) => NEWS_APIS[api].key);
    if (availableAPIs.length === 0) throw new Error("No news API keys configured");

    let combinedNews = [];

    // Try each API until we have 5 articles
    for (const apiName of availableAPIs) {
      try {
        const news = await fetchNewsFromAPI(apiName, query, 5);
        combinedNews = combinedNews.concat(news);
        if (combinedNews.length >= 5) break;
      } catch (err) {
        console.log(`API ${apiName} failed: ${err.message}`);
        continue;
      }
    }

    // Shuffle and limit to 5
    combinedNews = combinedNews.sort(() => 0.5 - Math.random()).slice(0, 5);

    newsCache.set(cacheKey, { news: combinedNews, timestamp: Date.now() });

    res.json({ success: true, data: combinedNews, cached: false });
  } catch (err) {
    console.error("News API error:", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch news", details: err.message });
  }
});

export default router;
