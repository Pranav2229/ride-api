const express = require('express');
const router = express.Router();
const {
    body,
} = require("express-validator");
const {
    createPaymentOrder,
    verifyPayment,
    markPaymentFailed,
    getPaymentHistory
} = require('../../controllers/UserAuthentication/Payment.Controller.js');
const authMiddleware = require("../../middleware/Auth.token.js");


router.post("/rides/:rideId/payment/create-order", authMiddleware, createPaymentOrder);
router.post("/rides/:rideId/payment/verify", authMiddleware, verifyPayment);
router.post("/rides/:rideId/payment/failed", authMiddleware, markPaymentFailed);
router.get("/payments", authMiddleware, getPaymentHistory);

module.exports = router;