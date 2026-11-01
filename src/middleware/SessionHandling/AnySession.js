const verifySession = require("./VarifyingSession.js");         // customer
const verifyDriverSession = require("./DriverSession.js");      // driver
const pool = require("../db.connection.js");

/**
 * Tries customer session first, falls back to driver session.
 * If neither matches → 401.
 * Sets req.role = "USER" | "DRIVER" on success.
 */
const verifyAnySession = async (req, res, next) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // Determine which table this userId belongs to
  try {
    const userRes = await pool.query(
      `SELECT 1 FROM public.users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (userRes.rows.length > 0) {
      req.role = "USER";
      return verifySession(req, res, next);
    }

    const driverRes = await pool.query(
      `SELECT 1 FROM public.drivers WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (driverRes.rows.length > 0) {
      req.role = "DRIVER";
      return verifyDriverSession(req, res, next);
    }

    return res.status(401).json({ success: false, message: "User not found" });
  } catch (e) {
    console.error("verifyAnySession error:", e);
    return res.status(500).json({ success: false, message: "Session check failed" });
  }
};

module.exports = verifyAnySession;