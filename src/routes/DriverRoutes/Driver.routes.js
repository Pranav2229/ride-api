const express = require('express');
const router = express.Router();
const {
  body,
} = require("express-validator");
const {
  loginDriver,
  registerDriver,
  updateDriverProfile,
  acceptRide,
  startRide,
  completeRide,
  updateDriverLocation,
  getDriverEarnings
} = require('../../controllers/DriverAuthentication/Driver.Controller.js');
const authMiddleware = require("../../middleware/Auth.token.js");

router.post(
  "/register_driver",
  [
    body("full_name")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),

    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required"),

    body("phone")
      .trim()
      .isLength({ min: 10, max: 15 })
      .withMessage("Valid phone number is required"),

    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),

    body("license_number")
      .trim()
      .notEmpty()
      .withMessage("License number is required"),

    body("aadhaar_number")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 12, max: 12 })
      .withMessage("Aadhaar number must be 12 digits"),

    body("pan_number")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 10, max: 10 })
      .withMessage("PAN number must be 10 characters")
  ],
  registerDriver
);

router.put(
    "/update_driver_profile",
    
    [
        body("full_name")
            .trim()
            .notEmpty()
            .withMessage("Full name is required"),

        body("email")
            .trim()
            .isEmail()
            .withMessage("Valid email is required"),

        body("phone")
            .trim()
            .isLength({ min: 10, max: 15 })
            .withMessage("Valid phone number is required"),

        body("license_number")
            .trim()
            .notEmpty()
            .withMessage("License number is required"),

        body("aadhaar_number")
            .optional({ nullable: true })
            .trim()
            .isLength({ min: 12, max: 12 })
            .withMessage("Aadhaar number must be 12 digits"),

        body("pan_number")
            .optional({ nullable: true })
            .trim()
            .isLength({ min: 10, max: 10 })
            .withMessage("PAN number must be 10 characters"),

        body("profile_image")
            .optional({ nullable: true })
            .trim()
    ],
    updateDriverProfile
);

router.post(
  "/login_driver",
  [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email"),

    body("password")
      .notEmpty()
      .withMessage("Password is required")
  ],
  loginDriver
);

router.post(
  "/accept_ride",
  authMiddleware,
  [
    body("ride_id")
      .notEmpty()
      .withMessage("Ride ID is required")
      .isInt()
      .withMessage("Ride ID must be a number"),

    body("vehicle_id")
      .notEmpty()
      .withMessage("Vehicle ID is required")
      .isInt()
      .withMessage("Vehicle ID must be a number")
  ],
  acceptRide
);

router.post(
  "/start_ride",
  authMiddleware,
  [
    body("ride_id")
      .notEmpty()
      .withMessage("Ride ID is required")
      .isInt()
      .withMessage("Ride ID must be a number")
  ],
  startRide
);

router.post(
  "/complete_ride",
  authMiddleware,
  [
    body("ride_id")
      .notEmpty()
      .withMessage("Ride ID is required")
      .isInt()
      .withMessage("Ride ID must be a number")
  ],
  completeRide
);


router.post(
  "/update_location",
  authMiddleware,
  [
    body("latitude")
      .notEmpty()
      .withMessage("Latitude is required")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),

    body("longitude")
      .notEmpty()
      .withMessage("Longitude is required")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),

    body("heading")
      .optional()
      .isFloat()
      .withMessage("Heading must be a number"),

    body("speed")
      .optional()
      .isFloat()
      .withMessage("Speed must be a number")
  ],
  updateDriverLocation
);

router.get(
  "/get_driver_arnings",
  authMiddleware,
  getDriverEarnings
);

module.exports = router;