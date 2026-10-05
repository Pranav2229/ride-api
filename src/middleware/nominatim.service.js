// Nominatim (OpenStreetMap) wrapper
// Free, no API key. Respect their usage policy:
// https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "BuddyRide/1.0 (contact@buddyride.app)";

// Simple in-memory cache to reduce duplicate hits
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// Rate limiting: Nominatim allows 1 request/sec
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100; // small buffer

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
        format: "json",
        addressdetails: "1",
        limit: String(limit),
    });

    // Bias results around user location
    if (lat != null && lng != null) {
        const delta = 0.5; // ~50km
        params.set(
            "viewbox",
            `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`
        );
        params.set("bounded", "0"); // soft bias, not strict
    }

    const url = `${NOMINATIM_URL}?${params.toString()}`;

    const res = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
        },
    });

    if (!res.ok) {
        throw new Error(`Nominatim error: ${res.status}`);
    }

    const json = await res.json();

    const results = json.map((item) => ({
        place_id: String(item.place_id),
        description: item.display_name,
        title: extractShortName(item),
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type,
        address: item.address || null,
    }));

    cache.set(cacheKey, { at: Date.now(), data: results });
    return results;
};

const extractShortName = (item) => {
    const a = item.address || {};
    return (
        a.name ||
        a.road ||
        a.suburb ||
        a.neighbourhood ||
        a.city ||
        a.town ||
        a.village ||
        item.display_name?.split(",")[0] ||
        "Place"
    );
};

module.exports = { searchPlaces };