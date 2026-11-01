// middleware/verifySession.js
const pool = require("../db.connection");

const verifySession = async (req, res, next) => {
  try {
    const sessionToken = req.headers["x-session-token"];
    const userId = req.user?.userId;

    if (!userId) {
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
      `SELECT session_token FROM public.users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (rows[0].session_token !== sessionToken) {
      return res.status(401).json({
        success: false,
        code: "SESSION_REVOKED",       // ✅ frontend checks this exact string
        message: "You have been logged out because your account was used on another device.",
      });
    }

    next();
  } catch (err) {
    console.error("verifySession error:", err);
    return res.status(500).json({ success: false, message: "Session check failed" });
  }
};


module.exports = verifySession