
// Photon (komoot.io) — free geocoding, no API key
// Powered by OpenStreetMap data. Policy: https://photon.komoot.io/

const PHOTON_URL = "https://photon.komoot.io/api";

// Simple in-memory cache to reduce duplicate hits
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// Rate limiting: be polite (Photon has no hard limit, but be reasonable)
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 300; // 3 req/sec max

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const searchPlaces = async (query, { lat, lng, limit = 10 } = {}) => {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const cacheKey = `${query.trim().toLowerCase()}|${lat || ""}|${lng || ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  // Rate limit
  const now = Date.now();
  const since = now - lastRequestAt;
  if (since < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - since);
  }
  lastRequestAt = Date.now();

  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
    lang: "en",
  });

  // Bias results around user location (Photon uses lat/lon directly)
  if (lat != null && lng != null) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  }

  const url = `${PHOTON_URL}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "BuddyRide/1.0 (contact@buddyride.app)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Photon error: ${res.status}`);
  }

  const json = await res.json();
  const features = json.features || [];

  const results = features.map((f) => {
    const props = f.properties || {};
    const [lon, lat] = f.geometry?.coordinates || [];

    // Build a display name similar to Nominatim's format
    const parts = [
      props.name,
      props.street,
      props.district,
      props.city,
      props.state,
      props.country,
    ].filter(Boolean);

    return {
      place_id: String(props.osm_id || `${lat},${lon}`),
      description: parts.join(", "),
      title: props.name || props.street || props.city || "Place",
      latitude: lat,
      longitude: lon,
      type: props.osm_value || props.type,
      address: {
        name: props.name,
        road: props.street,
        suburb: props.district,
        city: props.city,
        state: props.state,
        country: props.country,
        postcode: props.postcode,
      },
    };
  });

  cache.set(cacheKey, { at: Date.now(), data: results });
  return results;
};

module.exports = { searchPlaces };

// // Nominatim (OpenStreetMap) wrapper
// // Free, no API key. Respect their usage policy:
// // https://operations.osmfoundation.org/policies/nominatim/

// const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// const USER_AGENT = "BuddyRide/1.0 (contact@buddyride.app)";

// // Simple in-memory cache to reduce duplicate hits
// const cache = new Map();
// const CACHE_TTL_MS = 60 * 1000; // 1 minute

// // Rate limiting: Nominatim allows 1 request/sec
// let lastRequestAt = 0;
// const MIN_INTERVAL_MS = 1100; // small buffer

// const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// const searchPlaces = async (query, { lat, lng, limit = 10 } = {}) => {
//     if (!query || query.trim().length < 3) {
//         return [];
//     }

//     const cacheKey = `${query.trim().toLowerCase()}|${lat || ""}|${lng || ""}`;
//     const cached = cache.get(cacheKey);
//     if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
//         return cached.data;
//     }

//     // Rate limit
//     const now = Date.now();
//     const since = now - lastRequestAt;
//     if (since < MIN_INTERVAL_MS) {
//         await sleep(MIN_INTERVAL_MS - since);
//     }
//     lastRequestAt = Date.now();

//     const params = new URLSearchParams({
//         q: query.trim(),
//         format: "json",
//         addressdetails: "1",
//         limit: String(limit),
//     });

//     // Bias results around user location
//     if (lat != null && lng != null) {
//         const delta = 0.5; // ~50km
//         params.set(
//             "viewbox",
//             `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`
//         );
//         params.set("bounded", "0"); // soft bias, not strict
//     }

//     const url = `${NOMINATIM_URL}?${params.toString()}`;

//     const res = await fetch(url, {
//         headers: {
//             "User-Agent": USER_AGENT,
//             Accept: "application/json",
//         },
//     });

//     if (!res.ok) {
//         throw new Error(`Nominatim error: ${res.status}`);
//     }

//     const json = await res.json();

//     const results = json.map((item) => ({
//         place_id: String(item.place_id),
//         description: item.display_name,
//         title: extractShortName(item),
//         latitude: parseFloat(item.lat),
//         longitude: parseFloat(item.lon),
//         type: item.type,
//         address: item.address || null,
//     }));

//     cache.set(cacheKey, { at: Date.now(), data: results });
//     return results;
// };

// const extractShortName = (item) => {
//     const a = item.address || {};
//     return (
//         a.name ||
//         a.road ||
//         a.suburb ||
//         a.neighbourhood ||
//         a.city ||
//         a.town ||
//         a.village ||
//         item.display_name?.split(",")[0] ||
//         "Place"
//     );
// };

// module.exports = { searchPlaces };