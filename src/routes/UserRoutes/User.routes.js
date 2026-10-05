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
  verifyUserOTP,
  getActiveRide,
  getWallet,
  addMoneyToWallet,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getOffers,
  validateCoupon,
  getRewards,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getReferralInfo,
  applyReferralCode,
  searchPlacesController,
  getRouteController,
  estimateFares,
  rateRide,
  getRideById
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


router.get("/wallet", authMiddleware, getWallet);

router.post(
  "/wallet/add_money",
  authMiddleware,
  [
    body("amount")
      .notEmpty()
      .withMessage("Amount is required")
      .isFloat({ min: 1, max: 100000 })
      .withMessage("Amount must be between 1 and 100000"),
  ],
  // validate,
  addMoneyToWallet
);

router.get("/notifications", authMiddleware, getNotifications);
router.post("/notifications/read_all", authMiddleware, markAllAsRead);
router.post("/notifications/:id/read", authMiddleware, markAsRead);
router.delete("/notifications/:id", authMiddleware, deleteNotification);
router.get("/offers", authMiddleware, getOffers);

router.post(
  "/coupons/validate",
  authMiddleware,
  [
    body("code").trim().notEmpty().withMessage("Coupon code is required"),
    body("ride_amount")
      .notEmpty().withMessage("Ride amount is required")
      .isFloat({ min: 1 }).withMessage("Ride amount must be greater than 0"),
  ],
  validateCoupon
);

router.get("/rewards", authMiddleware, getRewards);


const addressValidators = [
  body("title").trim().notEmpty().withMessage("Title is required")
    .isLength({ max: 50 }).withMessage("Title too long"),
  body("address").trim().notEmpty().withMessage("Address is required"),
  body("latitude").optional({ nullable: true }).isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude"),
  body("longitude").optional({ nullable: true }).isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),
]
router.get("/addresses", authMiddleware, getAddresses);
router.post("/add_addresses", authMiddleware, addressValidators, addAddress);
router.put("/update_addresses/:id", authMiddleware, updateAddress);
router.delete("/delete_addresses/:id", authMiddleware, deleteAddress);
router.post("/addresses/:id/default", authMiddleware, setDefaultAddress)

router.get("/referrals", authMiddleware, getReferralInfo);

router.post(
  "/referrals/apply",
  authMiddleware,
  [body("code").trim().notEmpty().withMessage("Referral code is required")],
  // validate,
  applyReferralCode
);

router.get("/rides/active", authMiddleware, getActiveRide);
router.get("/places/search", authMiddleware, searchPlacesController);
router.get("/places/route", authMiddleware, getRouteController);
router.post(
  "/rides/estimate",
  authMiddleware,
  [
    body("distance_km")
      .notEmpty().withMessage("distance_km is required")
      .isFloat({ min: 0.1 }).withMessage("distance_km must be > 0"),
    body("duration_min")
      .notEmpty().withMessage("duration_min is required")
      .isInt({ min: 1 }).withMessage("duration_min must be >= 1"),
    body("is_night").optional().isBoolean(),
    body("vehicle_type").optional({ nullable: true, checkFalsy: true }).trim(),
  ],
  // validate,
  estimateFares
);

router.get("/rides/:id", authMiddleware, getRideById);
router.post(
  "/rides/:id/rate",
  authMiddleware,
  [
    body("rating").notEmpty().withMessage("Rating is required").isFloat({ min: 1, max: 5 }).withMessage("Rating must be 1–5"),
    body("review").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }),
  ],
  rateRide
);

module.exports = router;