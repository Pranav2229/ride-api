const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";

const reverseGeocode = async (lat, lng) => {
  try {
    const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data;
    }

    // rate limit shared with searchPlaces
    const now = Date.now();
    const since = now - lastRequestAt;
    if (since < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - since);
    }
    lastRequestAt = Date.now();

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      lang: "en",
      limit: "1",
    });

    const url = `${PHOTON_REVERSE_URL}?${params.toString()}`;
    console.log("🔍 Photon Reverse URL:", url);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "BuddyRide/1.0 (contact@buddyride.app)",
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`Photon reverse error: ${res.status}`);

    const json = await res.json();
    const features = json.features || [];

    if (features.length === 0) {
      const result = { description: "Unknown location", title: "Unknown" };
      cache.set(cacheKey, { at: Date.now(), data: result });
      return result;
    }

    const f = features[0];
    const props = f.properties || {};
    const [lon, latRes] = f.geometry.coordinates;

    const parts = [
      props.name,
      props.street,
      props.district,
      props.city,
      props.state,
      props.country,
    ].filter(Boolean);

    const result = {
      description: parts.join(", ") || "Unknown location",
      title: props.name || props.street || props.city || "Unknown",
      latitude: latRes,
      longitude: lon,
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

    cache.set(cacheKey, { at: Date.now(), data: result });
    return result;
  } catch (error) {
    console.error("reverseGeocode error:", error);
    return { description: "Unknown location", title: "Unknown" };
  }
};

module.exports = { searchPlaces, reverseGeocode };