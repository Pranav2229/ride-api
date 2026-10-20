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


router.post("/rides/:rideId/payment/create-order", authMiddleware, createPaymentOrder);
router.post("/rides/:rideId/payment/verify", authMiddleware, verifyPayment);
router.post("/rides/:rideId/payment/failed", authMiddleware, markPaymentFailed);
router.get("/payments", authMiddleware, getPaymentHistory);

router.post("/wallet/create-topup-order", authMiddleware, createWalletTopupOrder);
router.post("/wallet/verify-topup",       authMiddleware, verifyWalletTopup);

module.exports = router;