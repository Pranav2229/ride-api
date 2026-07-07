const express = require('express');
const router = express.Router();
const {
  body,
} = require("express-validator");
const {
  loginUser,
  createRide,
  getNearbyDrivers,
  getUserRides
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


module.exports = router;