// OSRM (Open Source Routing Machine) — free routing engine
// Public demo: router.project-osrm.org
// For production: self-host or use a paid host

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const USER_AGENT = "BuddyRide/1.0 (contact@buddyride.app)";

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getRoute = async (fromLat, fromLng, toLat, toLng) => {
  const cacheKey = `${fromLat},${fromLng}|${toLat},${toLng}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`OSRM error: ${res.status}`);
  }

  const json = await res.json();

  if (!json.routes || json.routes.length === 0) {
    throw new Error("No route found");
  }

  const route = json.routes[0];

  // OSRM returns GeoJSON with [lng, lat] — convert to { latitude, longitude }
  const geometry = route.geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const result = {
    distance_m: route.distance,       // meters
    distance_km: Math.round((route.distance / 1000) * 10) / 10,
    duration_s: route.duration,       // seconds
    duration_min: Math.round(route.duration / 60),
    geometry,
  };

  cache.set(cacheKey, { at: Date.now(), data: result });
  return result;
};

module.exports = { getRoute };