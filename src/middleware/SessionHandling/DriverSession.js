const pool = require("../db.connection");

const verifyDriverSession = async (req, res, next) => {
  try {
    const sessionToken = req.headers["x-session-token"];
    const driverId = req.user?.userId;              // same field as customer JWT

    if (!driverId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        code: "SESSION_REQUIRED",
        message: "Session token required",
      });
    }

    const { rows } = await pool.query(
      `SELECT session_token FROM public.drivers WHERE id = $1`,
      [driverId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Driver not found" });
    }

    if (rows[0].session_token !== sessionToken) {
      return res.status(401).json({
        success: false,
        code: "SESSION_REVOKED",
        message: "You have been logged out because your account was used on another device.",
      });
    }

    next();
  } catch (err) {
    console.error("verifyDriverSession error:", err);
    return res.status(500).json({ success: false, message: "Session check failed" });
  }
};


module.exports =  verifyDriverSession 