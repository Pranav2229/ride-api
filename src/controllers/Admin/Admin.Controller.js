// controllers/AdminAuth/adminAuth.controller.js
const pool = require("../../middleware/db.connection.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { emitDriverKycUpdate } = require("../../sockets/RideSocket/ride.socket.js");

const BASE_URL = process.env.API_BASE_URL


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

// =====================================================
// GET /api/admin/drivers/kyc-list?status=PENDING&search=&limit=50&offset=0
// =====================================================
const getKycList = async (req, res) => {
  try {
    const status = (req.query.status || "PENDING").toUpperCase();
    const search = req.query.search || "";
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const result = await pool.query(
      `CALL public.admin_get_driver_kyc_list($1, $2, $3, $4, NULL)`,
      [status, search, limit, offset]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Unable to fetch KYC list" });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({ success: false, message: response.message });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    });
  } catch (error) {
    console.error("getKycList error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /api/admin/drivers/:id/kyc
// =====================================================
const getKycDetail = async (req, res) => {
  try {
    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid driver id" });
    }

    const result = await pool.query(
      `CALL public.admin_get_driver_kyc_detail($1, $2, NULL)`,
      [driverId, BASE_URL]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Unable to fetch driver" });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(404).json({ success: false, message: response.message });
    }

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("getKycDetail error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// POST /api/admin/drivers/:id/kyc/approve
// =====================================================
const approveKyc = async (req, res) => {
  try {
    const adminId = req.user?.adminId;   // ← JWT payload has adminId
    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid driver id" });
    }

    const result = await pool.query(
      `CALL public.admin_approve_driver_kyc($1, $2, NULL)`,
      [driverId, adminId]
    );

    const response = result.rows[0]?.p_response;

    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    // Socket notification
    emitDriverKycUpdate(driverId, "APPROVED", null);

    return res.status(200).json({
      success: true,
      message: "Driver KYC approved",
      data: response.data,
    });
  } catch (error) {
    console.error("approveKyc error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// POST /api/admin/drivers/:id/kyc/reject
// Body: { reason }
// =====================================================
const rejectKyc = async (req, res) => {
  try {
    const adminId = req.user?.adminId;   // ← JWT payload has adminId
    const driverId = Number(req.params.id);
    const reason = String(req.body.reason || "").trim();

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid driver id" });
    }

    if (reason.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be at least 5 characters",
      });
    }

    const result = await pool.query(
      `CALL public.admin_reject_driver_kyc($1, $2, $3, NULL)`,
      [driverId, adminId, reason]
    );

    const response = result.rows[0]?.p_response;

    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    // Socket notification
    emitDriverKycUpdate(driverId, "REJECTED", reason);

    return res.status(200).json({
      success: true,
      message: "Driver KYC rejected",
      data: response.data,
    });
  } catch (error) {
    console.error("rejectKyc error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /api/admin/drivers/kyc-stats
// =====================================================
const getKycStats = async (req, res) => {
  try {
    const result = await pool.query(`CALL public.admin_get_kyc_stats(NULL)`);
    const response = result.rows[0]?.p_response;

    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("getKycStats error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDocumentsList = async (req, res) => {
  try {
    const filter = (req.query.filter || "ALL").toUpperCase();
    const search = req.query.search || "";

    if (!["ALL", "VERIFIED", "PENDING", "REJECTED"].includes(filter)) {
      return res.status(400).json({ success: false, message: "Invalid filter" });
    }

    const result = await pool.query(
      `CALL public.admin_get_driver_documents_list($1, $2, NULL)`,
      [filter, search]
    );

    const response = result.rows[0]?.p_response;

    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("getDocumentsList error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /api/admin/drivers/:id/documents
// =====================================================
const getDriverDocuments = async (req, res) => {
  try {
    const driverId = Number(req.params.id);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid driver id" });
    }

    const result = await pool.query(
      `CALL public.admin_get_driver_documents_detail($1, $2, NULL)`,
      [driverId, BASE_URL]
    );

    const response = result.rows[0]?.p_response;

    if (!response?.success) {
      return res.status(404).json({ success: false, message: response?.message || "Driver not found" });
    }

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("getDriverDocuments error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// POST /api/admin/drivers/:id/documents/:key/status
// Body: { status: 'VERIFIED' | 'REJECTED' | 'PENDING', reason?: string }
// =====================================================
const updateDocumentStatus = async (req, res) => {
  try {
    const adminId = req.user?.adminId;   // ← JWT payload has adminId
    const driverId = Number(req.params.id);
    const documentKey = req.params.key;
    const status = String(req.body.status || "").toUpperCase();
    const reason = req.body.reason ? String(req.body.reason).trim() : null;

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid driver id" });
    }

    if (!["VERIFIED", "REJECTED", "PENDING"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    if (status === "REJECTED" && (!reason || reason.length < 5)) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be at least 5 characters",
      });
    }

    const result = await pool.query(
      `CALL public.admin_update_document_status($1, $2, $3, $4, $5, NULL)`,
      [driverId, documentKey, status, reason, adminId]
    );

    const response = result.rows[0]?.p_response;

    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    // Socket to driver
    emitDriverKycUpdate(driverId, response.data.overall_status, reason);

    return res.status(200).json({
      success: true,
      message: response.message,
      data: response.data,
    });
  } catch (error) {
    console.error("updateDocumentStatus error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// const rejectKyc = async (req, res) => {
//   try {
//     if (!req.admin?.id) {
//       return res.status(401).json({ success: false, message: "Not authenticated" });
//     }

//     const adminId = req.admin.id;
//     const driverId = Number(req.params.id);
//     const reason = String(req.body.reason || "").trim();

//     if (!Number.isInteger(driverId) || driverId <= 0) {
//       return res.status(400).json({ success: false, message: "Invalid driver id" });
//     }

//     if (reason.length < 5) {
//       return res.status(400).json({
//         success: false,
//         message: "Rejection reason must be at least 5 characters",
//       });
//     }

//     const result = await pool.query(
//       `CALL public.admin_reject_driver_kyc($1, $2, $3, NULL)`,
//       [driverId, adminId, reason]
//     );

//     const response = result.rows[0]?.p_response;
//     if (!response?.success) {
//       return res.status(400).json({ success: false, message: response?.message || "Failed" });
//     }

//     emitDriverKycUpdate(driverId, "REJECTED", reason);

//     return res.status(200).json({
//       success: true,
//       message: "Driver KYC rejected",
//       data: response.data,
//     });
//   } catch (error) {
//     console.error("rejectKyc error:", error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// =====================================================
// POST /api/admin/drivers/:id/kyc/section/:section/status
// Body: { status: 'VERIFIED'|'REJECTED'|'PENDING', reason? }
// =====================================================
const updateKycSection = async (req, res) => {
  try {
    if (!req.user?.adminId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const adminId = req.user?.adminId;
    const driverId = Number(req.params.id);
    const section = String(req.params.section || "").toLowerCase();
    const status = String(req.body.status || "").toUpperCase();
    const reason = req.body.reason ? String(req.body.reason).trim() : null;

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid driver id" });
    }

    if (!["vehicle", "bank"].includes(section)) {
      return res.status(400).json({ success: false, message: "Invalid section" });
    }

    if (!["VERIFIED", "REJECTED", "PENDING"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    if (status === "REJECTED" && (!reason || reason.length < 5)) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be at least 5 characters",
      });
    }

    const result = await pool.query(
      `CALL public.admin_update_kyc_section($1, $2, $3, $4, $5, NULL)`,
      [driverId, section, status, reason, adminId]
    );

    const response = result.rows[0]?.p_response;
    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    emitDriverKycUpdate(driverId, status, reason);

    return res.status(200).json({
      success: true,
      message: response.message,
      data: response.data,
    });
  } catch (error) {
    console.error("updateKycSection error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /api/admin/customers
// =====================================================
const getCustomers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const result = await pool.query(
      `CALL public.admin_get_customers($1, NULL)`,
      [search]
    );

    const response = result.rows[0]?.p_response;
    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("getCustomers error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// POST /api/admin/customers/:id/block
// Body: { is_blocked: true | false }
// =====================================================
const toggleCustomerBlock = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const isBlocked = Boolean(req.body.is_blocked);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid customer ID" });
    }

    const result = await pool.query(
      `CALL public.admin_toggle_customer_block($1, $2, NULL)`,
      [userId, isBlocked]
    );

    const response = result.rows[0]?.p_response;
    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    return res.status(200).json({
      success: true,
      message: response.message,
      data: response.data,
    });
  } catch (error) {
    console.error("toggleCustomerBlock error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDrivers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const result = await pool.query(
      `CALL public.admin_get_drivers($1, NULL)`,
      [search]
    );

    const response = result.rows[0]?.p_response;
    if (!response?.success) {
      return res.status(400).json({ success: false, message: response?.message || "Failed" });
    }

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("getDrivers error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const toggleDriverBlock = async (req, res) => {
  try {
    const adminId = req.user?.adminId;
    const driverId = Number(req.params.id);

    // ⚠️ Fix the classic Boolean("false") === true bug
    const raw = req.body?.is_blocked;
    const isBlocked =
      raw === true || raw === "true" || raw === 1 || raw === "1";

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid driver id" });
    }

    const result = await pool.query(
      `CALL public.admin_toggle_driver_block($1, $2, $3, NULL)`,
      [driverId, isBlocked, adminId]
    );

    const response = result.rows[0]?.p_response;
    if (!response?.success) {
      return res
        .status(400)
        .json({ success: false, message: response?.message || "Failed" });
    }

    return res.status(200).json({
      success: true,
      message: response.message,
      data: response.data,
    });
  } catch (error) {
    console.error("toggleDriverBlock error:", error);
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
  getKycList,
  getKycDetail,
  approveKyc,
  rejectKyc,
  getKycStats,
  getDocumentsList,
  getDriverDocuments,
  updateDocumentStatus,
  updateKycSection,
  getCustomers,
  toggleCustomerBlock,
  getDrivers,
  toggleDriverBlock
};