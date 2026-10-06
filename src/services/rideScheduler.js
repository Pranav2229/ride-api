// src/services/rideScheduler.js
const pool = require("../middleware/db.connection.js");
const { getNearbyDriversForSocket } = require("./driver.service.js");
const {
  emitRideToDrivers,
  emitRideCancelled,
} = require("../sockets/RideSocket/ride.socket.js");

const REBROADCAST_INTERVAL_MS = 30 * 1000;
const RIDE_SEARCH_TIMEOUT_MIN = 5;

const rebroadcastSearchingRides = async () => {
  try {
    // 1. Auto-cancel stale SEARCHING rides
    const cancelResult = await pool.query(
      `UPDATE public.rides
       SET ride_status = 'CANCELLED',
           cancelled_by = 'SYSTEM',
           cancel_reason = 'No driver found within ${RIDE_SEARCH_TIMEOUT_MIN} minutes',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE ride_status = 'SEARCHING'
         AND created_at < NOW() - INTERVAL '${RIDE_SEARCH_TIMEOUT_MIN} minutes'
       RETURNING id, user_id`
    );

    for (const ride of cancelResult.rows) {
      try {
        emitRideCancelled(
          ride.user_id,
          {
            ride_id: ride.id,
            cancelled_by: "SYSTEM",
            reason: "No driver found. Please try again.",
          },
          "USER"
        );
        console.log(`⏱️ Auto-cancelled stale ride ${ride.id}`);
      } catch (e) {
        console.log("Emit cancel error:", e.message);
      }
    }

    // 2. Re-broadcast still-SEARCHING rides
    const searchingRides = await pool.query(
      `SELECT id, user_id, ride_unique_id, ride_status,
              pickup_address, pickup_latitude, pickup_longitude,
              drop_address, drop_latitude, drop_longitude,
              distance, estimated_time, fare_amount, discount_amount,
              tax_amount, final_amount, payment_method, created_at
       FROM public.rides
       WHERE ride_status = 'SEARCHING'
         AND created_at > NOW() - INTERVAL '${RIDE_SEARCH_TIMEOUT_MIN} minutes'
       ORDER BY created_at DESC`
    );

    for (const ride of searchingRides.rows) {
      const drivers = await getNearbyDriversForSocket(
        ride.pickup_latitude,
        ride.pickup_longitude
      );

      if (drivers.length > 0) {
        console.log(
          `🔄 Re-broadcasting ride ${ride.id} to ${drivers.length} drivers`
        );
        emitRideToDrivers(drivers, ride);
      }
    }
  } catch (error) {
    console.error("Rebroadcast error:", error.message);
  }
};

// ✅ Export a function — this is what `require(...)(...)` needs
module.exports = () => {
  console.log(
    `🔄 Ride re-broadcast scheduler started (every ${REBROADCAST_INTERVAL_MS / 1000}s, timeout ${RIDE_SEARCH_TIMEOUT_MIN}min)`
  );

  // Run once immediately (helps with testing)
  rebroadcastSearchingRides();

  // Then every 30s
  setInterval(rebroadcastSearchingRides, REBROADCAST_INTERVAL_MS);
};