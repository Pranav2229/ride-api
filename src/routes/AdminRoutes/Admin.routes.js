const express = require('express');
const router = express.Router();
const {
    body,
} = require("express-validator");
const {
    adminLogin,
    getDashboardKpis,
    getDashboardAlerts,
    getDashboardCharts,
    getDashboardLiveRides,
    getDashboardRecentCancellations,
    getDashboardOverview,
} = require('../../controllers/Admin/Admin.Controller.js');
const authMiddleware = require("../../middleware/Auth.token.js");

router.post("/login",
    [
        body("email")
            .isEmail()
            .withMessage("Valid email required")
            .normalizeEmail(),
        body("password")
            .isString()
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters"),
    ],
    adminLogin
);
router.get("/dashboard/kpis", authMiddleware, getDashboardKpis);
router.get("/dashboard/alerts", authMiddleware, getDashboardAlerts);
router.get("/dashboard/charts", authMiddleware, getDashboardCharts);
router.get("/dashboard/live-rides", authMiddleware, getDashboardLiveRides);
router.get("/dashboard/recent-cancellations", authMiddleware, getDashboardRecentCancellations);
router.get("/dashboard/overview", authMiddleware, getDashboardOverview);


module.exports = router;