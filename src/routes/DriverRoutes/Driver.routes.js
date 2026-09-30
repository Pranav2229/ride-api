const express = require('express');
const router = express.Router();
const {
  body,
  validationResult
} = require("express-validator");
const {
  loginDriver,
  registerDriver,
  updateDriverProfile,
  acceptRide,
  startRide,
  completeRide,
  updateDriverLocation,
  getDriverEarnings,
  verifyDriverOTP,
  uploadDriverDocument,
  getDriverDocumentStatus,
  upsertVehicleDetails,
  getVehicleDetails,
  upsertBankDetails,
  getBankDetails
} = require('../../controllers/DriverAuthentication/Driver.Controller.js');
const uploadDocument = require("../../middleware/uploadDocument.js")
const authMiddleware = require("../../middleware/Auth.token.js");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = {};
    errors.array().forEach((err) => {
      if (!formatted[err.path]) formatted[err.path] = err.msg;
    });

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formatted,
    });
  }
  next();
};

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

router.post(
  "/verify_driver_otp",
  [
    body("driver_id")
      .isInt()
      .withMessage("Valid driver ID is required"),

    body("otp")
      .trim()
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage("OTP must be a valid 6-digit number")
  ],
  verifyDriverOTP
);

router.post(
  "/upload_document",
  authMiddleware,
  uploadDocument.single("file"),
  uploadDriverDocument
);

router.get(
  "/document_status",
  authMiddleware,
  getDriverDocumentStatus
);
router.post(
  "/vehicle_details",
  authMiddleware,
  upsertVehicleDetails);

router.get(
  "/vehicle_details",
  authMiddleware,
  getVehicleDetails);


router.post(
  "/bank_details",
  authMiddleware,
  [
    body("account_holder_name")
      .trim()
      .notEmpty()
      .withMessage("Account holder name is required")
      .isLength({ min: 3, max: 150 })
      .withMessage("Account holder name must be 3–150 characters")
      .matches(/^[A-Za-z .'-]+$/)
      .withMessage("Account holder name contains invalid characters"),

    body("bank_name")
      .trim()
      .notEmpty()
      .withMessage("Bank name is required")
      .isLength({ min: 2, max: 150 })
      .withMessage("Bank name must be 2–150 characters"),

    body("account_number")
      .trim()
      .notEmpty()
      .withMessage("Account number is required")
      .isLength({ min: 9, max: 18 })
      .withMessage("Account number must be 9–18 digits")
      .isNumeric()
      .withMessage("Account number must contain only digits"),

    body("ifsc_code")
      .trim()
      .notEmpty()
      .withMessage("IFSC code is required")
      .toUpperCase()
      .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
      .withMessage("Invalid IFSC code (e.g. SBIN0001234)"),

    body("branch_name")
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 150 })
      .withMessage("Branch name must be at most 150 characters"),

    body("upi_id")
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .matches(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/)
      .withMessage("Invalid UPI ID (e.g. name@bank)"),
  ],
  validate,
  upsertBankDetails
);

router.get(
  "/get_bank_details",
  authMiddleware,
  getBankDetails
);

module.exports = router;