// controllers/AdminAuth/adminAuth.controller.js
const pool = require("../../middleware/db.connection.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

const adminLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // ✅ Normalize
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    // 1. Call SP to fetch credentials
    const result = await pool.query(
      `CALL public.admin_login($1, $2, NULL)`,
      [email, password]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to process login",
      });
    }

    const response = result.rows[0].p_response;

    // 2. SP-level failure
    if (!response.success) {
      return res.status(401).json({
        success: false,
        message: response.message,
        code: response.code,
      });
    }

    const admin = response.data;


    // 3. bcrypt compare
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // 4. Sign JWT
    const accessToken = jwt.sign(
      {
        adminId: admin.admin_id,
        email: admin.email,
        role: admin.role,
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "12h" }
    );

    const refreshToken = jwt.sign(
      { adminId: admin.admin_id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // 5. Update last_login_at
    await pool.query(`CALL public.update_admin_last_login($1)`, [admin.admin_id]);

    // 6. Audit log
    await pool.query(
      `INSERT INTO public.admin_audit_log (admin_id, action, details)
       VALUES ($1, 'ADMIN_LOGIN', $2)`,
      [admin.admin_id, JSON.stringify({ ip: req.ip, ua: req.get("user-agent") })]
    );

    // 7. Return (never leak password_hash)
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        admin: {
          id: admin.admin_id,
          full_name: admin.full_name,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          last_login_at: admin.last_login_at,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getDashboardKpis = async (req, res) => {
  try {
    const result = await pool.query(`CALL public.admin_dashboard_kpis(NULL)`);

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Unable to fetch KPIs" });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({ success: false, message: response.message });
    }

    return res.status(200).json({
      success: true,
      data: {
        today: response.today,
        live: response.live,
      },
    });
  } catch (error) {
    console.error("Dashboard KPIs Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardAlerts = async (req, res) => {
  try {
    const result = await pool.query(`CALL public.admin_dashboard_alerts(NULL)`);

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Unable to fetch alerts" });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({ success: false, message: response.message });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Dashboard Alerts Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardCharts = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);

    const result = await pool.query(
      `CALL public.admin_dashboard_charts($1, NULL)`,
      [days]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Unable to fetch chart data" });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({ success: false, message: response.message });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Dashboard Charts Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardLiveRides = async (req, res) => {
  try {
    const result = await pool.query(`CALL public.admin_live_rides(NULL)`);

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Unable to fetch live rides" });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({ success: false, message: response.message });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Dashboard Live Rides Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardRecentCancellations = async (req, res) => {
  try {
    const result = await pool.query(`CALL public.admin_recent_cancellations(NULL)`);

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Unable to fetch cancellations" });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({ success: false, message: response.message });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Dashboard Recent Cancellations Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardOverview = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);

    const [kpisResult, alertsResult, chartsResult, liveResult, cancelsResult] =
      await Promise.all([
        pool.query(`CALL public.admin_dashboard_kpis(NULL)`),
        pool.query(`CALL public.admin_dashboard_alerts(NULL)`),
        pool.query(`CALL public.admin_dashboard_charts($1, NULL)`, [days]),
        pool.query(`CALL public.admin_live_rides(NULL)`),
        pool.query(`CALL public.admin_recent_cancellations(NULL)`),
      ]);

    const kpis = kpisResult.rows[0]?.p_response;
    const alerts = alertsResult.rows[0]?.p_response;
    const charts = chartsResult.rows[0]?.p_response;
    const live = liveResult.rows[0]?.p_response;
    const cancels = cancelsResult.rows[0]?.p_response;

    return res.status(200).json({
      success: true,
      data: {
        kpis: kpis?.success ? { today: kpis.today, live: kpis.live } : null,
        alerts: alerts?.success ? alerts.data : null,
        charts: charts?.success ? charts.data : null,
        live_rides: live?.success ? live.data : [],
        cancellations: cancels?.success ? cancels.data : [],
      },
    });
  } catch (error) {
    console.error("Dashboard Overview Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
  adminLogin,
  getDashboardKpis,
  getDashboardAlerts,
  getDashboardCharts,
  getDashboardLiveRides,
  getDashboardRecentCancellations,
  getDashboardOverview,
};