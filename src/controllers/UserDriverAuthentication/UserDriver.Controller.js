const pool = require("../../middleware/db.connection.js");
const jwt = require("jsonwebtoken");
const { generateOTP } = require("../../middleware/otp.js")
const {
  checkSchema,
  body,
  validationResult
} = require("express-validator");
const crypto = require("crypto");
const { emitRideCancelled } = require('../../sockets/RideSocket/ride.socket.js')
const { getIO } = require("../../sockets/index.js");


const cancelRide = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      ride_id,
      cancelled_by,
      reason
    } = req.body;

    const result = await pool.query(
      `
      CALL public.cancel_ride(
        $1,
        $2,
        $3,
        NULL
      )
      `,
      [
        ride_id,
        cancelled_by,
        reason
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to cancel ride"
      });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message
      });
    }

    // ✅ EMIT SOCKET EVENTS HERE
    try {
      const cancelledData = {
        ride_id: response.data.ride_id,
        cancelled_by: response.data.cancelled_by,
        reason: response.data.reason,
        cancelled_at: response.data.cancelled_at,
      };

      // Notify the user
      if (response.data.user_id) {
        emitRideCancelled(
          response.data.user_id,
          cancelledData,
          "USER"
        );
      }

      // Notify the driver (if assigned)
      if (response.data.driver_id) {
        emitRideCancelled(
          response.data.driver_id,
          cancelledData,
          "DRIVER"
        );
      }

      try {
        const { getIO } = require("../../sockets/index.js");
        const io = getIO();

        // Broadcast cancellation so any driver with this ride in queue clears it
        io.emit("ride_cancelled", {
          ride_id: response.data.ride_id,
          rideId: response.data.ride_id,
          cancelled_by: response.data.cancelled_by,
          reason: response.data.reason,
        });
      } catch (e) {
        console.log("ride_cancelled broadcast error:", e.message);
      }
    } catch (emitErr) {
      console.log("emitRideCancelled error:", emitErr.message);
      // Don't fail the request if socket emit fails
    }

    return res.status(200).json({
      success: true,
      message: response.message,
      data: response.data
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required"
      });
    }
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );



    const accessToken = jwt.sign(
      {
        userId: decoded.userId
      },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: "15m"
      }
    );

    return res.status(200).json({
      success: true,
      accessToken
    });

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Invalid refresh token"
    });

  }
};

const resendUserOTP = async (req, res) => {
  try {

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check user
    const userResult = await pool.query(
      `
      SELECT id, email, is_verified
      FROM public.users
      WHERE id = $1
      `,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Generate new OTP
    const otp = generateOTP();

    // OTP valid for 10 minutes
    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );


    // Store new OTP
    await pool.query(
      `
      INSERT INTO public.user_otps
      (
        user_id,
        otp,
        expires_at
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      `,
      [
        user_id,
        otp,
        expiresAt
      ]
    );

    // TODO: Send OTP to email/SMS here
    console.log("New OTP:", otp);

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully"
    });

  } catch (error) {

    console.error("Resend OTP Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};



// ============================================================
// Shared helper — verify caller is user OR driver of the ride,
// and that the ride is still chat-active (not locked).
// Returns { ride } on success, or sends a response and returns null.
// ============================================================
const loadRideForChat = async (req, res) => {
  const callerId = req.user?.userId;           // same field for user & driver
  const rideId = Number(req.params.rideId);

  if (!callerId || !Number.isFinite(rideId)) {
    res.status(400).json({ success: false, message: "Invalid request" });
    return null;
  }

  const { rows } = await pool.query(
    `SELECT id, user_id, driver_id, ride_status
     FROM public.rides WHERE id = $1 LIMIT 1`,
    [rideId]
  );

  if (rows.length === 0) {
    res.status(404).json({ success: false, message: "Ride not found" });
    return null;
  }

  const ride = rows[0];

  // Role check — caller must be the ride's customer or driver
  let role = null;
  if (ride.user_id === callerId) role = "USER";
  else if (ride.driver_id === callerId) role = "DRIVER";

  if (!role) {
    res.status(403).json({ success: false, message: "Not your ride" });
    return null;
  }

  // Chat is locked once ride is completed/cancelled (read-only allowed)
  const isLocked = ride.ride_status === "COMPLETED" || ride.ride_status === "CANCELLED";

  return { ride, role, callerId, isLocked };
};

// ============================================================
// GET /rides/:rideId/messages
// Loads chat history. Optional ?before=<id> for pagination.
// ============================================================
const getMessages = async (req, res) => {
  try {
    const ctx = await loadRideForChat(req, res);
    if (!ctx) return;

    const { ride } = ctx;
    const before = req.query.before ? Number(req.query.before) : null;
    const limit = Math.min(Number(req.query.limit) || 100, 200);

    const params = [ride.id, limit];
    let whereClause = "WHERE ride_id = $1";
    if (before) {
      whereClause += " AND id < $3";
      params.push(before);
    }

    const { rows } = await pool.query(
      `SELECT id, sender_type, sender_id, message, created_at
       FROM public.ride_messages
       ${whereClause}
       ORDER BY id DESC
       LIMIT $2`,
      params
    );

    // Return ascending (oldest first) — matches chat UI
    const messages = rows.reverse().map((m) => ({
      id: String(m.id),
      sender_type: m.sender_type,
      message: m.message,
      created_at: m.created_at,
    }));

    return res.json({
      success: true,
      data: { messages, locked: ctx.isLocked },
    });
  } catch (e) {
    console.error("getMessages error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
};

// ============================================================
// POST /rides/:rideId/messages
// Sends a message via HTTP (fallback) — also emits to socket.
// Main flow uses socket "chat_send"; this exists as a backup.
// ============================================================
const sendMessage = async (req, res) => {
  try {
    const ctx = await loadRideForChat(req, res);
    if (!ctx) return;

    if (ctx.isLocked) {
      return res.status(400).json({ success: false, message: "Chat locked for this ride" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const text = String(req.body.message || "").trim();
    if (!text || text.length > 1000) {
      return res.status(400).json({ success: false, message: "Message must be 1–1000 chars" });
    }

    // ✅ Read tempId from request body (client sends it)
    const tempId = String(req.body.tempId || "").trim() || null;

    const { rows } = await pool.query(
      `INSERT INTO public.ride_messages (ride_id, sender_type, sender_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_type, sender_id, message, created_at`,
      [ctx.ride.id, ctx.role, ctx.callerId, text]
    );

    const payload = {
      rideId: ctx.ride.id,
      id: String(rows[0].id),
      sender_type: rows[0].sender_type,
      sender_id: rows[0].sender_id,
      message: rows[0].message,
      created_at: rows[0].created_at,
    };

    // ✅ Broadcast to everyone with tempId — the sender's own client uses
    //    tempId to skip the banner; the recipient ignores it.
    try {
      getIO().to(`ride:${ctx.ride.id}`).emit("chat_message", { ...payload, tempId });
    } catch (e) {
      console.log("emit chat_message error:", e.message);
    }

    return res.status(201).json({ success: true, data: { ...payload, tempId } });
  } catch (e) {
    console.error("sendMessage error:", e);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  }
};

module.exports = {
  refreshToken,
  cancelRide,
  resendUserOTP,
  getMessages,
  sendMessage,
  loadRideForChat
};