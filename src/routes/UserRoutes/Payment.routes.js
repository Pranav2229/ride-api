const express = require('express');
const router = express.Router();
const {
    body,
} = require("express-validator");
const {
    createPaymentOrder,
    verifyPayment,
    markPaymentFailed,
    getPaymentHistory,
    createWalletTopupOrder,
    verifyWalletTopup
} = require('../../controllers/UserAuthentication/Payment.Controller.js');
const authMiddleware = require("../../middleware/Auth.token.js");
const verifySession = require('../../middleware/SessionHandling/VarifyingSession.js')

router.post("/rides/:rideId/payment/create-order", authMiddleware, verifySession, createPaymentOrder);
router.post("/rides/:rideId/payment/verify", authMiddleware, verifySession, verifyPayment);
router.post("/rides/:rideId/payment/failed", authMiddleware, verifySession, markPaymentFailed);
router.get("/payments", authMiddleware, verifySession, getPaymentHistory);

router.post("/wallet/create-topup-order", authMiddleware, verifySession, createWalletTopupOrder);
router.post("/wallet/verify-topup", authMiddleware, verifySession, verifyWalletTopup);

module.exports = router;