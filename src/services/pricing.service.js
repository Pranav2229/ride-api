/**
 * BuddyRide Kohima Pricing Service
 * Implements Checkpoint & Landmark-based Fare Engine for Kohima, Nagaland
 *
 * Hotspots / Checkpoints along the transit spine:
 * 1. High School Junction (North)
 * 2. Razhu Point (Central Hub)
 * 3. PR Hill Junction (South)
 */

// 3 Major Transit Checkpoints in order along Kohima spine
const CHECKPOINTS = [
  { id: "HIGH_SCHOOL", name: "High School Junction", order: 0, lat: 25.6888, lng: 94.1082 },
  { id: "RAZHU_POINT", name: "Razhu Point", order: 1, lat: 25.6747, lng: 94.1086 },
  { id: "PR_HILL", name: "PR Hill Junction", order: 2, lat: 25.6601, lng: 94.1045 },
];

// Transit segment fares between checkpoints
const CHECKPOINT_TRANSIT_FARES = {
  "HIGH_SCHOOL-RAZHU_POINT": 50,
  "RAZHU_POINT-HIGH_SCHOOL": 50,
  "RAZHU_POINT-PR_HILL": 50,
  "PR_HILL-RAZHU_POINT": 50,
  "HIGH_SCHOOL-PR_HILL": 100, // 50 + 50
  "PR_HILL-HIGH_SCHOOL": 100,
};

// Official Kohima Destination Fares chart
// Format: { [checkpointId]: { [landmarkNormalized]: originalFare } }
const OFFICIAL_CHART = {
  HIGH_SCHOOL: {
    "g rio": 50,
    "bible college": 50,
    "i&c office": 50,
    "hotel vivor": 50,
    "polytechnic": 50,
    "northfield school": 50,
    "ig stadium": 50,
    "peraciezie gate": 50,
    "bright morning star children home": 100,
    "meriema junction": 100,
    "nielit": 100,
    "nagaland university": 150,
    "penzie": 50,
    "gasie": 70,
    "bayavu": 50,
    "bayavü": 50,
    "nbse": 50,
    "civil secretariat": 50,
    "nbcc": 50,
    "npsc": 50,
    "nla": 70,
    "thizama junction": 100,
    "dbs": 100,
    "kohima college": 100,
    "alder college": 50,
    "keziekie": 50,
    "themezhie": 50,
    "sepfuzou": 50,
    "sepfüzou": 50,
    "kohimas hospital": 50,
    "nhak": 100,
    "kohima village": 70,
    "panchayat hall": 70,
    "christ king school": 100,
    "razhu point": 50,
    "isbt": 200,
  },
  RAZHU_POINT: {
    "nhak": 70,
    "para medical": 100,
    "avilie petrol pump": 100,
    "check post": 100,
    "kodh": 150,
    "bayavu": 50,
    "bayavü": 50,
    "sepfuzou": 50,
    "sepfüzou": 50,
    "kenouzou": 50,
    "dbs": 70,
    "kohima college": 100,
    "civil secretariat": 100,
    "nbcc": 100,
    "npsc": 100,
    "nla": 120,
    "thizama gate": 150,
    "administrative training institute": 100,
    "kohima village": 70,
    "d khel ground": 70,
    "oriental college": 70,
    "black gate": 100,
    "bsf camp": 150,
    "mezhrir hr sec": 50,
    "chandmari taxi stand": 70,
    "porter lane": 100,
    "modern college": 100,
    "lerie bank": 100,
    "ag office": 100,
    "model christian college": 120,
    "officers hill": 50,
    "beyond": 70,
    "pwd junction": 50,
    "pr hill junction": 50,
    "model college": 150,
    "isbt": 150,
    "high school junction": 50,
  },
  PR_HILL: {
    "jail colony": 50,
    "fernwood": 50,
    "stella": 50,
    "mhbhss": 50,
    "dainty hr sec": 50,
    "forest colony": 50,
    "lower forest colony": 70,
    "cd king": 100,
    "alder retreat": 100,
    "school of music": 100,
    "science college": 100,
    "sazolie": 150,
    "lfs": 50,
    "aradura inn": 70,
    "south police station": 50,
    "lerie bank": 50,
    "lerie gate": 50,
    "st mary's": 100,
    "st marys": 100,
    "kros college": 100,
    "heliport": 150,
    "nst garage": 70,
    "new reserve": 100,
    "police camp": 150,
    "phesama police check gate": 100,
    "isbt": 150,
    "razhu point": 50,
  },
};

// Map each landmark to its primary/nearest checkpoint and base local fare
const LANDMARK_MAP = {
  // --- High School Zone ---
  "g rio": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "bible college": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "i&c office": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "hotel vivor": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "polytechnic": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "northfield school": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "ig stadium": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "peraciezie gate": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "bright morning star children home": { checkpoint: "HIGH_SCHOOL", fare: 100 },
  "meriema junction": { checkpoint: "HIGH_SCHOOL", fare: 100 },
  "nielit": { checkpoint: "HIGH_SCHOOL", fare: 100 },
  "nagaland university": { checkpoint: "HIGH_SCHOOL", fare: 150 },
  "penzie": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "gasie": { checkpoint: "HIGH_SCHOOL", fare: 70 },
  "bayavu": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "bayavü": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "nbse": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "civil secretariat": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "nbcc": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "npsc": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "nla": { checkpoint: "HIGH_SCHOOL", fare: 70 },
  "thizama junction": { checkpoint: "HIGH_SCHOOL", fare: 100 },
  "thizama gate": { checkpoint: "HIGH_SCHOOL", fare: 100 },
  "dbs": { checkpoint: "HIGH_SCHOOL", fare: 70 },
  "kohima college": { checkpoint: "HIGH_SCHOOL", fare: 100 },
  "alder college": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "keziekie": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "themezhie": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "sepfuzou": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "sepfüzou": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "kohimas hospital": { checkpoint: "HIGH_SCHOOL", fare: 50 },
  "christ king school": { checkpoint: "HIGH_SCHOOL", fare: 100 },
  "high school": { checkpoint: "HIGH_SCHOOL", fare: 0 },
  "high school junction": { checkpoint: "HIGH_SCHOOL", fare: 0 },

  // --- Razhu Point Zone ---
  "nhak": { checkpoint: "RAZHU_POINT", fare: 70 },
  "para medical": { checkpoint: "RAZHU_POINT", fare: 100 },
  "avilie petrol pump": { checkpoint: "RAZHU_POINT", fare: 100 },
  "check post": { checkpoint: "RAZHU_POINT", fare: 100 },
  "kodh": { checkpoint: "RAZHU_POINT", fare: 150 },
  "kenouzou": { checkpoint: "RAZHU_POINT", fare: 50 },
  "administrative training institute": { checkpoint: "RAZHU_POINT", fare: 100 },
  "ati": { checkpoint: "RAZHU_POINT", fare: 100 },
  "kohima village": { checkpoint: "RAZHU_POINT", fare: 70 },
  "panchayat hall": { checkpoint: "RAZHU_POINT", fare: 70 },
  "d khel ground": { checkpoint: "RAZHU_POINT", fare: 70 },
  "oriental college": { checkpoint: "RAZHU_POINT", fare: 70 },
  "black gate": { checkpoint: "RAZHU_POINT", fare: 100 },
  "bsf camp": { checkpoint: "RAZHU_POINT", fare: 150 },
  "mezhrir hr sec": { checkpoint: "RAZHU_POINT", fare: 50 },
  "chandmari taxi stand": { checkpoint: "RAZHU_POINT", fare: 70 },
  "chandmari": { checkpoint: "RAZHU_POINT", fare: 70 },
  "porter lane": { checkpoint: "RAZHU_POINT", fare: 100 },
  "modern college": { checkpoint: "RAZHU_POINT", fare: 100 },
  "ag office": { checkpoint: "RAZHU_POINT", fare: 100 },
  "model christian college": { checkpoint: "RAZHU_POINT", fare: 120 },
  "model college": { checkpoint: "RAZHU_POINT", fare: 150 },
  "officers hill": { checkpoint: "RAZHU_POINT", fare: 50 },
  "beyond": { checkpoint: "RAZHU_POINT", fare: 70 },
  "pwd junction": { checkpoint: "RAZHU_POINT", fare: 50 },
  "pwd": { checkpoint: "RAZHU_POINT", fare: 50 },
  "razhu point": { checkpoint: "RAZHU_POINT", fare: 0 },
  "razhu": { checkpoint: "RAZHU_POINT", fare: 0 },

  // --- PR Hill Zone ---
  "jail colony": { checkpoint: "PR_HILL", fare: 50 },
  "fernwood": { checkpoint: "PR_HILL", fare: 50 },
  "stella": { checkpoint: "PR_HILL", fare: 50 },
  "mhbhss": { checkpoint: "PR_HILL", fare: 50 },
  "dainty hr sec": { checkpoint: "PR_HILL", fare: 50 },
  "forest colony": { checkpoint: "PR_HILL", fare: 50 },
  "lower forest colony": { checkpoint: "PR_HILL", fare: 70 },
  "cd king": { checkpoint: "PR_HILL", fare: 100 },
  "alder retreat": { checkpoint: "PR_HILL", fare: 100 },
  "school of music": { checkpoint: "PR_HILL", fare: 100 },
  "science college": { checkpoint: "PR_HILL", fare: 100 },
  "sazolie": { checkpoint: "PR_HILL", fare: 150 },
  "lfs": { checkpoint: "PR_HILL", fare: 50 },
  "aradura inn": { checkpoint: "PR_HILL", fare: 70 },
  "south police station": { checkpoint: "PR_HILL", fare: 50 },
  "lerie bank": { checkpoint: "PR_HILL", fare: 50 },
  "lerie gate": { checkpoint: "PR_HILL", fare: 50 },
  "st mary's": { checkpoint: "PR_HILL", fare: 100 },
  "st marys": { checkpoint: "PR_HILL", fare: 100 },
  "kros college": { checkpoint: "PR_HILL", fare: 100 },
  "heliport": { checkpoint: "PR_HILL", fare: 150 },
  "nst garage": { checkpoint: "PR_HILL", fare: 70 },
  "new reserve": { checkpoint: "PR_HILL", fare: 100 },
  "police camp": { checkpoint: "PR_HILL", fare: 150 },
  "phesama police check gate": { checkpoint: "PR_HILL", fare: 100 },
  "phesama": { checkpoint: "PR_HILL", fare: 100 },
  "pr hill": { checkpoint: "PR_HILL", fare: 0 },
  "pr hill junction": { checkpoint: "PR_HILL", fare: 0 },
  "isbt": { checkpoint: "HIGH_SCHOOL", fare: 200 },
};

/**
 * Normalizes text string for fuzzy landmark lookup
 */
function normalizeName(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[,\-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Identifies whether an address contains a known landmark
 */
function identifyLandmark(address) {
  if (!address) return null;
  const clean = normalizeName(address);

  // Exact checkpoint checks
  if (clean.includes("high school")) return { name: "High School Junction", key: "high school junction", ...LANDMARK_MAP["high school junction"] };
  if (clean.includes("razhu")) return { name: "Razhu Point", key: "razhu point", ...LANDMARK_MAP["razhu point"] };
  if (clean.includes("pr hill")) return { name: "PR Hill Junction", key: "pr hill junction", ...LANDMARK_MAP["pr hill junction"] };

  // Longest substring match across known landmarks
  let bestMatch = null;
  let maxLen = 0;

  for (const [key, val] of Object.entries(LANDMARK_MAP)) {
    if (clean.includes(key) && key.length > maxLen) {
      maxLen = key.length;
      bestMatch = { name: key, key, ...val };
    }
  }

  return bestMatch;
}

/**
 * Calculates BuddyRide Platform Commission
 * Rule: 15% of original fare, rounded DOWN to a whole rupee,
 * with a minimum of ₹7 and a maximum of ₹15 per ride.
 */
function calculateCommission(originalFare) {
  if (!originalFare || originalFare <= 0) return 7;
  const computed = Math.floor(originalFare * 0.15);
  return Math.min(15, Math.max(7, computed));
}

/**
 * Calculates the Local Fare between two checkpoints
 */
function getCheckpointTransitFare(cpA, cpB) {
  if (cpA === cpB) return 0;
  const key = `${cpA}-${cpB}`;
  return CHECKPOINT_TRANSIT_FARES[key] || 50;
}

/**
 * Resolves checkpoint zone from GPS coordinates within Greater Kohima
 */
function getCheckpointFromCoords(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (isNaN(numLat) || isNaN(numLng)) return null;

  // Greater Kohima coordinate boundary
  if (numLat < 25.55 || numLat > 25.75 || numLng < 94.00 || numLng > 94.20) {
    return null; // outside Kohima urban zone
  }

  // Kohima spine partition by latitude
  // North section (High School zone)
  if (numLat >= 25.680) {
    return { name: "High School Zone", key: "high school zone", checkpoint: "HIGH_SCHOOL", fare: 50 };
  }
  // South section (PR Hill zone)
  if (numLat <= 25.667) {
    return { name: "PR Hill Zone", key: "pr hill zone", checkpoint: "PR_HILL", fare: 50 };
  }
  // Central hub (Razhu Point zone)
  return { name: "Razhu Point Zone", key: "razhu point zone", checkpoint: "RAZHU_POINT", fare: 50 };
}

/**
 * Core Fare Calculation using the Checkpoint & Landmark system
 */
function calculateKohimaFare(
  pickupAddress,
  dropAddress,
  distanceKm = 0,
  durationMin = 0,
  pickupLat = null,
  pickupLng = null,
  dropLat = null,
  dropLng = null
) {
  let pLandmark = identifyLandmark(pickupAddress);
  let dLandmark = identifyLandmark(dropAddress);

  // If text didn't match a listed landmark, resolve by GPS coordinates
  if (!pLandmark && pickupLat !== null && pickupLng !== null) {
    pLandmark = getCheckpointFromCoords(pickupLat, pickupLng);
  }
  if (!dLandmark && dropLat !== null && dropLng !== null) {
    dLandmark = getCheckpointFromCoords(dropLat, dropLng);
  }

  // If neither landmark could be identified and coordinates are outside Kohima,
  // fallback to distance-based dynamic pricing
  if (!pLandmark && !dLandmark) {
    return null;
  }

  // If total distance exceeds Kohima local boundary (> 15 km), fallback to distance pricing
  if (Number(distanceKm) > 15) {
    return null;
  }

  // Checkpoint assignment
  const cpA = pLandmark ? pLandmark.checkpoint : "RAZHU_POINT";
  const cpB = dLandmark ? dLandmark.checkpoint : "RAZHU_POINT";

  const keyA = pLandmark ? pLandmark.key : null;
  const keyB = dLandmark ? dLandmark.key : null;

  let originalFare = 50; // Minimum default in Kohima
  let isCheckpointPricing = true;
  let checkpointsCrossed = [];

  // Check direct chart lookup if one of the ends is a hotspot checkpoint
  if (keyA === "high school junction" && keyB && OFFICIAL_CHART.HIGH_SCHOOL[keyB]) {
    originalFare = OFFICIAL_CHART.HIGH_SCHOOL[keyB];
  } else if (keyA === "razhu point" && keyB && OFFICIAL_CHART.RAZHU_POINT[keyB]) {
    originalFare = OFFICIAL_CHART.RAZHU_POINT[keyB];
  } else if (keyA === "pr hill junction" && keyB && OFFICIAL_CHART.PR_HILL[keyB]) {
    originalFare = OFFICIAL_CHART.PR_HILL[keyB];
  } else if (keyB === "high school junction" && keyA && OFFICIAL_CHART.HIGH_SCHOOL[keyA]) {
    originalFare = OFFICIAL_CHART.HIGH_SCHOOL[keyA];
  } else if (keyB === "razhu point" && keyA && OFFICIAL_CHART.RAZHU_POINT[keyA]) {
    originalFare = OFFICIAL_CHART.RAZHU_POINT[keyA];
  } else if (keyB === "pr hill junction" && keyA && OFFICIAL_CHART.PR_HILL[keyA]) {
    originalFare = OFFICIAL_CHART.PR_HILL[keyA];
  } else if (cpA === cpB) {
    // Both in same zone
    const legA = pLandmark ? pLandmark.fare : 50;
    const legB = dLandmark ? dLandmark.fare : 50;
    if (keyA === keyB) {
      originalFare = 30; // same location minimum
    } else {
      originalFare = Math.max(50, Math.min(legA, legB));
    }
  } else {
    // Different zones: crosses checkpoints!
    const transitFare = getCheckpointTransitFare(cpA, cpB);
    const legA = pLandmark ? pLandmark.fare : 0;
    const legB = dLandmark ? dLandmark.fare : 0;

    // Checkpoints crossed
    if ((cpA === "HIGH_SCHOOL" && cpB === "PR_HILL") || (cpA === "PR_HILL" && cpB === "HIGH_SCHOOL")) {
      checkpointsCrossed = ["High School Junction", "Razhu Point", "PR Hill Junction"];
    } else if (cpA === "HIGH_SCHOOL" || cpB === "HIGH_SCHOOL") {
      checkpointsCrossed = ["High School Junction", "Razhu Point"];
    } else {
      checkpointsCrossed = ["Razhu Point", "PR Hill Junction"];
    }

    // Additive crossing formula tested by client
    // Fare = transit between checkpoints + outer extension beyond base
    const extensionA = legA > 50 ? legA - 50 : 0;
    const extensionB = legB > 50 ? legB - 50 : 0;
    originalFare = transitFare + extensionA + extensionB;

    if (originalFare < 50) originalFare = 50;
  }

  const commission = calculateCommission(originalFare);
  const customerFare = originalFare + commission;

  return {
    pricing_mode: "KOHIMA_CHECKPOINT",
    is_checkpoint_pricing: isCheckpointPricing,
    checkpoints_crossed: checkpointsCrossed,
    pickup_checkpoint: cpA,
    drop_checkpoint: cpB,
    original_fare: originalFare,
    commission: commission,
    customer_fare: customerFare,
  };
}

/**
 * Vehicle Fare Multiplier Table
 */
const VEHICLE_SPECS = [
  {
    vehicle_type: "Bike",
    display_name: "Bike",
    icon: "motorbike",
    seats: "1 Seat",
    description: "Fast and affordable bike rides",
    multiplier: 1.0,
    base_fallback: 20,
    per_km_fallback: 6,
    per_min_fallback: 0.5,
    min_fare_fallback: 30,
  },
  {
    vehicle_type: "Cab",
    display_name: "Cab",
    icon: "car",
    seats: "4 Seats",
    description: "Affordable everyday rides",
    multiplier: 2.0,
    base_fallback: 40,
    per_km_fallback: 12,
    per_min_fallback: 1.5,
    min_fare_fallback: 80,
  },
  {
    vehicle_type: "SUV",
    display_name: "SUV",
    icon: "car-sports",
    seats: "6 Seats",
    description: "Extra space for family",
    multiplier: 3.0,
    base_fallback: 60,
    per_km_fallback: 18,
    per_min_fallback: 2.0,
    min_fare_fallback: 120,
  },
  {
    vehicle_type: "Parcel",
    display_name: "Parcel",
    icon: "package-variant",
    seats: "1 Parcel",
    description: "Quick parcel delivery",
    multiplier: 1.0,
    base_fallback: 25,
    per_km_fallback: 8,
    per_min_fallback: 0.75,
    min_fare_fallback: 40,
  },
];

/**
 * Estimates fares for all vehicles based on Kohima Checkpoints with distance fallback
 */
function estimateAllVehicleFares({
  pickup_address,
  drop_address,
  pickup_latitude = null,
  pickup_longitude = null,
  drop_latitude = null,
  drop_longitude = null,
  distance_km = 0,
  duration_min = 0,
  is_night = false,
  vehicle_type = null,
}) {
  const kohimaPricing = calculateKohimaFare(
    pickup_address,
    drop_address,
    Number(distance_km),
    Number(duration_min),
    pickup_latitude,
    pickup_longitude,
    drop_latitude,
    drop_longitude
  );

  const nightMult = is_night ? 1.2 : 1.0;

  const vehicleList = VEHICLE_SPECS.map((v) => {
    let originalFare = 0;
    let commission = 0;
    let customerFare = 0;
    let mode = "KOHIMA_CHECKPOINT";

    if (kohimaPricing) {
      originalFare = Math.round(kohimaPricing.original_fare * v.multiplier);
      commission = calculateCommission(originalFare);
      customerFare = originalFare + commission;
      mode = "KOHIMA_CHECKPOINT";
    } else {
      // Fallback distance-based formula
      const dist = Number(distance_km) || 0;
      const dur = Number(duration_min) || 0;
      const calc = v.base_fallback + dist * v.per_km_fallback + dur * v.per_min_fallback;
      const baseTotal = Math.max(v.min_fare_fallback, Math.round(calc * nightMult));
      commission = calculateCommission(baseTotal);
      originalFare = baseTotal;
      customerFare = originalFare + commission;
      mode = "DISTANCE_FALLBACK";
    }

    return {
      vehicle_type: v.vehicle_type,
      display_name: v.display_name,
      icon: v.icon,
      seats: v.seats,
      description: v.description,
      fare: customerFare,               // Total customer pays (Original + Commission)
      original_fare: originalFare,      // What the driver receives
      commission: commission,           // BuddyRide platform fee
      customer_fare: customerFare,
      pricing_mode: mode,
      checkpoints_crossed: kohimaPricing?.checkpoints_crossed || [],
    };
  });

  if (vehicle_type) {
    return vehicleList.filter(
      (v) => v.vehicle_type.toLowerCase() === vehicle_type.toLowerCase()
    );
  }

  return vehicleList;
}

module.exports = {
  CHECKPOINTS,
  OFFICIAL_CHART,
  LANDMARK_MAP,
  identifyLandmark,
  calculateCommission,
  calculateKohimaFare,
  estimateAllVehicleFares,
};
