const express = require('express');
const router = express.Router();
const {
    body,
} = require("express-validator");
const {
    cancelRide,
    refreshToken,
    resendUserOTP
} = require('../../controllers/UserDriverAuthentication/UserDriver.Controller.js');
const authMiddleware = require("../../middleware/Auth.token.js");
const {
    getIO
} = require("../../sockets/index.js");

router.post(
    "/cancel_ride",
    authMiddleware,
    [
        body("ride_id")
            .notEmpty()
            .withMessage("Ride ID is required")
            .isInt()
            .withMessage("Ride ID must be a number"),

        body("cancelled_by")
            .notEmpty()
            .withMessage("Cancelled By is required")
            .isIn(["USER", "DRIVER", "ADMIN"])
            .withMessage("Invalid cancelled_by value"),

        body("reason")
            .notEmpty()
            .withMessage("Cancellation reason is required")
    ],
    cancelRide
);

router.post('/refresh_token', refreshToken);

router.post(
  "/resend_user_otp",
  [
    body("user_id")
     .trim()
      .notEmpty()
      .isInt()
      .withMessage("User ID must be a valid number")
  ],
  resendUserOTP
);

module.exports = router;