// Photon (komoot.io) — free geocoding, no API key
// Powered by OpenStreetMap data. Policy: https://photon.komoot.io/

const PHOTON_URL = "https://photon.komoot.io/api";

const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ✅ Accepted country names for India
const INDIA_COUNTRY_VALUES = new Set([
  "india",
  "in",
  "ind",
  "republic of india",
  "भारत",
]);

const isIndia = (props) => {
  const country = (props?.country || "").trim().toLowerCase();
  const countrycode = (props?.countrycode || "").trim().toLowerCase();

  return (
    INDIA_COUNTRY_VALUES.has(country) ||
    countrycode === "in" ||
    countrycode === "ind"
  );
};

const searchPlaces = async (query, { lat, lng, limit = 10 } = {}) => {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const cacheKey = `${query.trim().toLowerCase()}|${lat || ""}|${lng || ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const now = Date.now();
  const since = now - lastRequestAt;
  if (since < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - since);
  }
  lastRequestAt = Date.now();

  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit * 2), // ✅ fetch extra to compensate for filtering
    lang: "en",
  });

  // Bias to user's location (soft — improves ranking)
  if (lat != null && lng != null) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  }

  const url = `${PHOTON_URL}?${params.toString()}`;
  console.log("🔍 Photon URL:", url);

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

  const results = features
    .filter((f) => f.geometry?.coordinates)
    .filter((f) => isIndia(f.properties))   // ✅ India only
    .slice(0, limit)                         // then cap to requested limit
    .map((f) => {
      const props = f.properties || {};
      const [lon, lat] = f.geometry.coordinates;

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

// // Photon (komoot.io) — free geocoding, no API key
// // Powered by OpenStreetMap data. Policy: https://photon.komoot.io/

// const PHOTON_URL = "https://photon.komoot.io/api";

// // Simple in-memory cache to reduce duplicate hits
// const cache = new Map();
// const CACHE_TTL_MS = 60 * 1000; // 1 minute

// // Rate limiting: be polite (Photon has no hard limit, but be reasonable)
// let lastRequestAt = 0;
// const MIN_INTERVAL_MS = 300; // 3 req/sec max

// const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// const searchPlaces = async (query, { lat, lng, limit = 10 } = {}) => {
//   if (!query || query.trim().length < 3) {
//     return [];
//   }

//   const cacheKey = `${query.trim().toLowerCase()}|${lat || ""}|${lng || ""}`;
//   const cached = cache.get(cacheKey);
//   if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
//     return cached.data;
//   }

//   // Rate limit
//   const now = Date.now();
//   const since = now - lastRequestAt;
//   if (since < MIN_INTERVAL_MS) {
//     await sleep(MIN_INTERVAL_MS - since);
//   }
//   lastRequestAt = Date.now();

//   const params = new URLSearchParams({
//     q: query.trim(),
//     limit: String(limit),
//     lang: "en",
//   });

//   // Bias results around user location (Photon uses lat/lon directly)
//   if (lat != null && lng != null) {
//     params.set("lat", String(lat));
//     params.set("lon", String(lng));
//   }

//   const url = `${PHOTON_URL}?${params.toString()}`;

//   const res = await fetch(url, {
//     headers: {
//       "User-Agent": "BuddyRide/1.0 (contact@buddyride.app)",
//       Accept: "application/json",
//     },
//   });

//   if (!res.ok) {
//     throw new Error(`Photon error: ${res.status}`);
//   }

//   const json = await res.json();
//   const features = json.features || [];

//   const results = features.map((f) => {
//     const props = f.properties || {};
//     const [lon, lat] = f.geometry?.coordinates || [];

//     // Build a display name similar to Nominatim's format
//     const parts = [
//       props.name,
//       props.street,
//       props.district,
//       props.city,
//       props.state,
//       props.country,
//     ].filter(Boolean);

//     return {
//       place_id: String(props.osm_id || `${lat},${lon}`),
//       description: parts.join(", "),
//       title: props.name || props.street || props.city || "Place",
//       latitude: lat,
//       longitude: lon,
//       type: props.osm_value || props.type,
//       address: {
//         name: props.name,
//         road: props.street,
//         suburb: props.district,
//         city: props.city,
//         state: props.state,
//         country: props.country,
//         postcode: props.postcode,
//       },
//     };
//   });

//   cache.set(cacheKey, { at: Date.now(), data: results });
//   return results;
// };

// module.exports = { searchPlaces };

