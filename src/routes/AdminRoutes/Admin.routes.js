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
    getDrivers 
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
router.get("/drivers/kyc-stats", authMiddleware, getKycStats);
router.get("/drivers/kyc-list", authMiddleware, getKycList);
router.get("/drivers/:id/kyc", authMiddleware, getKycDetail);
router.post("/drivers/:id/kyc/approve", authMiddleware, approveKyc);
router.post(
    "/drivers/:id/kyc/reject",
    authMiddleware,
    [
        body("reason")
            .isString()
            .trim()
            .isLength({ min: 5 })
            .withMessage("Rejection reason must be at least 5 characters"),
    ],
    rejectKyc
);
router.get("/drivers/documents-list", authMiddleware, getDocumentsList);
router.get("/drivers/:id/documents", authMiddleware, getDriverDocuments);
router.post("/drivers/:id/documents/:key/status", authMiddleware, updateDocumentStatus);
router.post("/drivers/:id/kyc/section/:section/status", authMiddleware, updateKycSection);
router.get("/customers", authMiddleware, getCustomers);
router.post("/customers/:id/block", authMiddleware, toggleCustomerBlock);
router.get("/drivers", authMiddleware, getDrivers);


module.exports = router;