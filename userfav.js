
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Make sure to install: npm install node-fetch

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google Maps Nearby Search API configuration  
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY; // Support both naming conventions
const GOOGLE_NEARBY_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

// Load top 5 preferences from fav.json
let topFivePreferences = [];
let settings = {};

try {
  const favData = JSON.parse(fs.readFileSync(path.join(__dirname, 'fav.json'), 'utf8'));
  topFivePreferences = favData.topFivePreferences || [];
  settings = favData.settings || {};
} catch (error) {
  console.error('Error loading fav.json:', error);
  // Fallback default settings
  settings = {
    maxResultsPerType: 10,
    defaultRadius: 5000,
    units: 'meters'
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Map our preference types to Google Places API types and keywords
 */
const GOOGLE_SEARCH_MAPPING = {
  cafe: {
    type: 'cafe',
    keyword: 'coffee shop cafe bistro'
  },
  park: {
    type: 'park',
    keyword: 'park garden recreation nature'
  },
  movie_theater: {
    type: 'movie_theater',
    keyword: 'cinema movie theater entertainment'
  },
  shopping_mall: {
    type: 'shopping_mall',
    keyword: 'mall shopping center market'
  },
  gym: {
    type: 'gym',
    keyword: 'gym fitness center yoga sports'
  }
};

/**
 * Fetch nearby places using Google Maps Nearby Search API - REAL-TIME ONLY
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} type - Type of place to search for
 * @param {number} radius - Search radius in meters
 * @param {Array} keywords - Additional keywords for search
 * @returns {Array} Array of places
 */
async function fetchNearbyPlacesFromGoogle(lat, lng, type, radius, keywords = []) {
  if (!GOOGLE_MAPS_API_KEY) {
    const errorMsg = 'Google Maps API key not found. Please add GOOGLE_MAPS_API_KEY=your_key to your .env file';
    console.error('🔑', errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const searchConfig = GOOGLE_SEARCH_MAPPING[type];
    if (!searchConfig) {
      throw new Error(`Unknown place type: ${type}`);
    }

    // Build search parameters for real-time data
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: Math.min(radius, 50000).toString(), // Google API max radius is 50km
      type: searchConfig.type,
      key: GOOGLE_MAPS_API_KEY
    });

    // Add keyword for more specific search
    if (searchConfig.keyword) {
      params.append('keyword', searchConfig.keyword);
    }

    const url = `${GOOGLE_NEARBY_SEARCH_URL}?${params}`;
    
    console.log(`🔍 Real-time search: ${type} places near ${lat}, ${lng} within ${radius}m...`);
    
    const response = await fetch(url);
    const data = await response.json();

    // Handle API response status
    if (data.status === 'REQUEST_DENIED') {
      throw new Error(`Google API Request Denied: ${data.error_message || 'Check API key and permissions'}`);
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Google API quota exceeded. Please check your billing and quotas.');
    }

    if (data.status === 'INVALID_REQUEST') {
      throw new Error(`Invalid request: ${data.error_message || 'Check request parameters'}`);
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    if (!data.results || data.results.length === 0) {
      console.log(`ℹ️ No ${type} places found in real-time search`);
      return [];
    }

    // Process REAL-TIME API results only
    const places = data.results
      .filter(place => {
        // Only include places with complete real-time data
        return place.geometry && 
               place.geometry.location && 
               place.geometry.location.lat && 
               place.geometry.location.lng &&
               place.name &&
               place.business_status !== 'CLOSED_PERMANENTLY';
      })
      .map(place => {
        const placeLocation = place.geometry.location;
        const distance = calculateDistance(lat, lng, placeLocation.lat, placeLocation.lng);
        
        return {
          name: place.name,
          lat: placeLocation.lat,
          lng: placeLocation.lng,
          distance: distance,
          rating: place.rating || 0,
          user_ratings_total: place.user_ratings_total || 0,
          vicinity: place.vicinity || place.formatted_address || '',
          price_level: place.price_level,
          place_id: place.place_id,
          types: place.types || [],
          business_status: place.business_status || 'OPERATIONAL',
          opening_hours: place.opening_hours?.open_now || null
        };
      })
      .filter(place => {
        // Filter to only include operational businesses within radius
        return place.business_status === 'OPERATIONAL' && place.distance <= radius;
      })
      .sort((a, b) => {
        // Sort by distance first, then by rating for quality
        if (Math.abs(a.distance - b.distance) < 100) { // If within 100m, sort by rating
          return (b.rating || 0) - (a.rating || 0);
        }
        return a.distance - b.distance;
      });

    console.log(`✅ Real-time data: Found ${places.length} ${type} places`);
    
    // Log real-time place details
    if (places.length > 0) {
      console.log(`   📍 Closest: ${places[0].name} (${Math.round(places[0].distance)}m)`);
      if (places[0].rating > 0) {
        console.log(`   ⭐ Rating: ${places[0].rating}/5 (${places[0].user_ratings_total} reviews)`);
      }
      if (places[0].opening_hours !== null) {
        console.log(`   🕒 Currently ${places[0].opening_hours ? 'Open' : 'Closed'}`);
      }
    }
    
    return places;

  } catch (error) {
    console.error(`❌ Real-time fetch failed for ${type}:`, error.message);
    throw error; // Re-throw to handle in main function
  }
}

/**
 * Fallback function with mock data when Google API is not available
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude  
 * @param {string} type - Type of place
 * @param {number} radius - Search radius in meters
 * @returns {Array} Array of mock places
 */
function fetchMockPlaces(lat, lng, type, radius) {
  console.log(`🔄 Using mock data for ${type} places (API not available)`);
  
  const mockData = {
    cafe: [
      { name: 'Coffee House Central', lat: lat + 0.001, lng: lng + 0.001 },
      { name: 'Artisan Café & Bistro', lat: lat + 0.002, lng: lng - 0.001 },
      { name: 'Brew & Beans Coffee Shop', lat: lat - 0.001, lng: lng + 0.002 },
      { name: 'Cozy Corner Bistro', lat: lat + 0.0015, lng: lng - 0.0015 },
      { name: 'The Daily Grind Café', lat: lat - 0.0005, lng: lng + 0.001 },
      { name: 'Steam Coffee Roasters', lat: lat + 0.003, lng: lng + 0.001 },
      { name: 'Urban Bean Coffee', lat: lat - 0.002, lng: lng - 0.001 }
    ],
    park: [
      { name: 'City Central Park', lat: lat + 0.004, lng: lng - 0.002 },
      { name: 'Green Valley Gardens', lat: lat - 0.003, lng: lng + 0.004 },
      { name: 'Riverside Nature Park', lat: lat + 0.002, lng: lng + 0.003 },
      { name: 'Community Recreation Area', lat: lat - 0.001, lng: lng - 0.002 },
      { name: 'Botanical Gardens', lat: lat + 0.005, lng: lng - 0.001 },
      { name: 'Sunset Hills Park', lat: lat - 0.004, lng: lng + 0.002 }
    ],
    movie_theater: [
      { name: 'Cineplex Downtown', lat: lat + 0.003, lng: lng + 0.001 },
      { name: 'Galaxy Cinema Complex', lat: lat - 0.002, lng: lng + 0.003 },
      { name: 'Metro Movies Theater', lat: lat + 0.001, lng: lng - 0.002 },
      { name: 'IMAX Entertainment Center', lat: lat - 0.003, lng: lng - 0.001 },
      { name: 'Classic Cinema Hall', lat: lat + 0.002, lng: lng + 0.002 },
      { name: 'Starlight Drive-In Theater', lat: lat - 0.004, lng: lng + 0.003 }
    ],
    shopping_mall: [
      { name: 'Central Shopping Mall', lat: lat + 0.002, lng: lng + 0.001 },
      { name: 'Metro Shopping Center', lat: lat - 0.001, lng: lng + 0.003 },
      { name: 'Plaza Grande Mall', lat: lat + 0.003, lng: lng - 0.001 },
      { name: 'City Square Shopping Complex', lat: lat - 0.002, lng: lng - 0.002 },
      { name: 'Fashion District Mall', lat: lat + 0.001, lng: lng + 0.002 },
      { name: 'Marketplace Shopping Center', lat: lat - 0.003, lng: lng + 0.001 }
    ],
    gym: [
      { name: 'Fitness First Gym', lat: lat + 0.001, lng: lng - 0.001 },
      { name: 'PowerHouse Fitness Center', lat: lat - 0.002, lng: lng + 0.002 },
      { name: 'Yoga & Wellness Center', lat: lat + 0.0015, lng: lng + 0.0015 },
      { name: 'CrossFit Training Arena', lat: lat - 0.001, lng: lng - 0.003 },
      { name: 'Aquatic Sports Complex', lat: lat + 0.003, lng: lng - 0.002 },
      { name: 'Elite Fitness Studio', lat: lat - 0.0025, lng: lng + 0.0025 }
    ]
  };

  const places = mockData[type] || [];
  
  return places
    .map(place => ({
      ...place,
      distance: calculateDistance(lat, lng, place.lat, place.lng),
      rating: 4.0 + Math.random() * 1.0, // Mock rating between 4.0-5.0
      vicinity: 'Mock Location Data'
    }))
    .filter(place => place.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Main middleware function to find nearby places based on user's location
 * REAL-TIME DATA ONLY - NO MOCK/HARDCODED DATA
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function findNearbyPlaces(req, res, next) {
  try {
    const { lat, lng } = req.query;
    
    // Validate input parameters
    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Latitude and longitude are required',
        message: 'Please provide lat and lng query parameters'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Latitude and longitude must be valid numbers'
      });
    }

    // Check if Google API key is available
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        error: 'API configuration error',
        message: 'Google Maps API key is required for real-time data. Please add GOOGLE_MAPS_API_KEY=your_key to your .env file.'
      });
    }

    console.log(`🌍 REAL-TIME SEARCH: Finding places near ${latitude}, ${longitude}`);

    const nearbyPlacesByType = {};
    const fetchPromises = [];
    const errors = [];
    
    // Create promises for all real-time Google API calls
    for (const preference of topFivePreferences) {
      const promise = fetchNearbyPlacesFromGoogle(
        latitude, 
        longitude, 
        preference.type, 
        preference.radius,
        preference.keywords
      ).then(places => {
        // Store real-time results - only name and coordinates as requested
        nearbyPlacesByType[preference.type] = places
          .slice(0, settings.maxResultsPerType)
          .map(place => ({
            name: place.name,
            lat: place.lat,
            lng: place.lng
          }));
      }).catch(apiError => {
        console.error(`❌ Real-time fetch failed for ${preference.name}:`, apiError.message);
        errors.push({ type: preference.type, error: apiError.message });
        nearbyPlacesByType[preference.type] = []; // Empty array for failed requests
      });
      
      fetchPromises.push(promise);
    }

    // Wait for all real-time API calls to complete
    console.log(`⏳ Executing ${fetchPromises.length} real-time API calls...`);
    await Promise.all(fetchPromises);
    
    // Count total places found from real-time data
    const totalPlaces = Object.values(nearbyPlacesByType).reduce((sum, places) => sum + places.length, 0);
    
    // Log results
    if (totalPlaces > 0) {
      console.log(`✅ Real-time success: Found ${totalPlaces} places total`);
    } else {
      console.log(`⚠️ No places found in real-time search`);
    }

    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} API calls failed:`, errors.map(e => e.type).join(', '));
    }

    // Prepare real-time response data
    const responseData = {
      userLocation: {
        lat: latitude,
        lng: longitude
      },
      nearbyPlaces: nearbyPlacesByType,
      timestamp: new Date().toISOString(),
      source: 'Google Maps Nearby Search API - Real-time',
      totalResults: totalPlaces,
      searchRadius: topFivePreferences.map(p => ({ type: p.type, radius: p.radius })),
      ...(errors.length > 0 && { apiErrors: errors })
    };

    // Add to request object for next middleware or route handler
    req.nearbyPlaces = responseData;

    // If this is an API endpoint, send real-time response
    if (req.path === '/api/nearby-places' || req.query.respond === 'true') {
      return res.json({
        success: true,
        data: responseData,
        message: totalPlaces > 0 
          ? `Found ${totalPlaces} nearby places in real-time` 
          : 'No places found in the specified area'
      });
    }

    // Otherwise, continue to next middleware
    next();

  } catch (error) {
    console.error('❌ Real-time search system error:', error);
    res.status(500).json({
      error: 'Real-time search failed',
      message: 'Unable to fetch nearby places from Google API',
      details: error.message
    });
  }
}

/**
 * Helper function to get top 5 preferences configuration
 */
function getTopFivePreferences() {
  return {
    preferences: topFivePreferences,
    settings: settings
  };
}

/**
 * Helper function to reload configuration from fav.json
 */
function reloadConfiguration() {
  try {
    const favData = JSON.parse(fs.readFileSync(path.join(__dirname, 'fav.json'), 'utf8'));
    topFivePreferences = favData.topFivePreferences || [];
    settings = favData.settings || {};
    return true;
  } catch (error) {
    console.error('Error reloading fav.json:', error);
    return false;
  }
}

export {
  findNearbyPlaces,
  getTopFivePreferences,
  reloadConfiguration,
  calculateDistance
};

