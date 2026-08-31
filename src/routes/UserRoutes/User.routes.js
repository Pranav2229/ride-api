const express = require('express');
const router = express.Router();
const {
  body,
} = require("express-validator");
const {
  loginUser,
  createRide,
  updateUserProfile,
  getNearbyDrivers,
  getUserRides,
  registerUser,
  verifyUserOTP
} = require('../../controllers/UserAuthentication/User.Controller.js');
const authMiddleware = require("../../middleware/Auth.token.js");

// router.post('/register', registerUser);

router.post("/login_user", [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
],
  loginUser
);

router.post(
  "/register_user",
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

    body("gender")
      .isIn(["Male", "Female", "Other"])
      .withMessage("Gender must be Male, Female or Other")
  ],
  registerUser
);

router.put(
    "/update_user_profile",
    authMiddleware,
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

        body("gender")
            .optional({ nullable: true })
            .trim()
            .isLength({ max: 10 })
            .withMessage("Gender must not exceed 10 characters"),

        body("profile_image")
            .optional({ nullable: true })
            .trim()
    ],
    updateUserProfile
);
router.post(
  "/create_ride",
  authMiddleware,
  [
    body("pickup_address")
      .notEmpty()
      .withMessage("Pickup address is required"),

    body("pickup_latitude")
      .notEmpty()
      .withMessage("Pickup latitude is required"),

    body("pickup_longitude")
      .notEmpty()
      .withMessage("Pickup longitude is required"),

    body("drop_address")
      .notEmpty()
      .withMessage("Drop address is required"),

    body("drop_latitude")
      .notEmpty()
      .withMessage("Drop latitude is required"),

    body("drop_longitude")
      .notEmpty()
      .withMessage("Drop longitude is required"),

    body("payment_method")
      .notEmpty()
      .withMessage("Payment method is required")
  ],
  createRide
);

router.post(
  "/nearby_drivers",
  authMiddleware,
  [
    body("latitude")
      .notEmpty()
      .withMessage("Latitude is required")
      .isNumeric()
      .withMessage("Latitude must be a number"),

    body("longitude")
      .notEmpty()
      .withMessage("Longitude is required")
      .isNumeric()
      .withMessage("Longitude must be a number"),

    body("radius_km")
      .optional()
      .isNumeric()
      .withMessage("Radius must be a number"),
  ],
  getNearbyDrivers
);

router.get(
  "/get_user_rides",
  authMiddleware,
  getUserRides
);

router.post(
    "/verify_user_otp",
    [
        body("user_id")
            .isInt()
            .withMessage("Valid user ID is required"),

        body("otp")
            .trim()
            .isLength({ min: 6, max: 6 })
            .isNumeric()
            .withMessage("OTP must be 6 digits")
    ],

    verifyUserOTP
);


module.exports = router;