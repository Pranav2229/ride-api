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
  getRideById,
  getUnpaidRides
} = require('../../controllers/UserAuthentication/User.Controller.js');
const authMiddleware = require("../../middleware/Auth.token.js");
const verifySession = require('../../middleware/SessionHandling/VarifyingSession.js')
// router.post("/login_user", [
//   body("email")
//     .notEmpty()
//     .withMessage("Email is required")
//     .isEmail()
//     .withMessage("Invalid email"),

//   body("password")
//     .notEmpty()
//     .withMessage("Password is required")
// ],
//   loginUser
// );

router.post(
  "/login_user",
  [
    body().custom((value, { req }) => {
      const id = String(
        req.body.identifier ||
        req.body.email ||
        req.body.phone ||
        ""
      ).trim();

      if (!id) throw new Error("Email or phone is required");

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
      const isPhone = /^[0-9]{10,15}$/.test(id.replace(/\s+/g, ""));

      if (!isEmail && !isPhone) {
        throw new Error("Enter a valid email or 10-15 digit phone number");
      }
      return true;
    }),

    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isString()
      .trim()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
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
  authMiddleware, verifySession,
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
  authMiddleware, verifySession,
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
  authMiddleware, verifySession,
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
  authMiddleware, verifySession,
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


router.get("/wallet", authMiddleware, verifySession, getWallet);

router.post(
  "/wallet/add_money",
  authMiddleware, verifySession,
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

router.get("/notifications", authMiddleware, verifySession, getNotifications);
router.post("/notifications/read_all", authMiddleware, verifySession, markAllAsRead);
router.post("/notifications/:id/read", authMiddleware, verifySession, markAsRead);
router.delete("/notifications/:id", authMiddleware, verifySession, deleteNotification);
router.get("/offers", authMiddleware, verifySession, getOffers);

router.post(
  "/coupons/validate",
  authMiddleware, verifySession,
  [
    body("code").trim().notEmpty().withMessage("Coupon code is required"),
    body("ride_amount")
      .notEmpty().withMessage("Ride amount is required")
      .isFloat({ min: 1 }).withMessage("Ride amount must be greater than 0"),
  ],
  validateCoupon
);

router.get("/rewards", authMiddleware, verifySession, getRewards);


const addressValidators = [
  body("title").trim().notEmpty().withMessage("Title is required")
    .isLength({ max: 50 }).withMessage("Title too long"),
  body("address").trim().notEmpty().withMessage("Address is required"),
  body("latitude").optional({ nullable: true }).isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude"),
  body("longitude").optional({ nullable: true }).isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),
]
router.get("/addresses", authMiddleware, verifySession, getAddresses);
router.post("/add_addresses", authMiddleware, verifySession, addressValidators, addAddress);
router.put("/update_addresses/:id", authMiddleware, verifySession, updateAddress);
router.delete("/delete_addresses/:id", authMiddleware, verifySession, deleteAddress);
router.post("/addresses/:id/default", authMiddleware, verifySession, setDefaultAddress)

router.get("/referrals", authMiddleware, verifySession, getReferralInfo);

router.post(
  "/referrals/apply",
  authMiddleware, verifySession,
  [body("code").trim().notEmpty().withMessage("Referral code is required")],
  // validate,
  applyReferralCode
);

router.get("/rides/active", authMiddleware, verifySession, getActiveRide);
router.get("/places/search", authMiddleware, verifySession, searchPlacesController);
router.get("/places/route", authMiddleware, verifySession, getRouteController);
router.get("/rides/unpaid", authMiddleware, verifySession, getUnpaidRides);

router.post(
  "/rides/estimate",
  authMiddleware, verifySession,
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

router.get("/rides/:id", authMiddleware, verifySession, getRideById);
router.post(
  "/rides/:id/rate",
  authMiddleware, verifySession,
  [
    body("rating").notEmpty().withMessage("Rating is required").isFloat({ min: 1, max: 5 }).withMessage("Rating must be 1–5"),
    body("review").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }),
  ],
  rateRide
);

module.exports = router;