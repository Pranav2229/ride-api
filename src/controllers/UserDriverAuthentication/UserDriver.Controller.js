const pool = require("../../middleware/db.connection.js");
const jwt = require("jsonwebtoken");
const { generateOTP } = require("../../middleware/otp.js")
const {
  checkSchema,
  body,
  validationResult
} = require("express-validator");
const crypto = require("crypto");

const cancelRide = async (req, res) => {
  try {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      ride_id,
      cancelled_by,
      reason
    } = req.body;

    const result = await pool.query(
      `
      CALL public.cancel_ride(
        $1,
        $2,
        $3,
        NULL
      )
      `,
      [
        ride_id,
        cancelled_by,
        reason
      ]
    );

    if (
      !result.rows ||
      result.rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to cancel ride"
      });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message,
      data: response.data
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required"
      });
    }
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );



    const accessToken = jwt.sign(
      {
        userId: decoded.userId
      },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: "15m"
      }
    );

    return res.status(200).json({
      success: true,
      accessToken
    });

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Invalid refresh token"
    });

  }
};

const resendUserOTP = async (req, res) => {
  try {

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check user
    const userResult = await pool.query(
      `
      SELECT id, email, is_verified
      FROM public.users
      WHERE id = $1
      `,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Generate new OTP
    const otp = generateOTP();

    // OTP valid for 10 minutes
    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );


    // Store new OTP
    await pool.query(
      `
      INSERT INTO public.user_otps
      (
        user_id,
        otp,
        expires_at
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      `,
      [
        user_id,
        otp,
        expiresAt
      ]
    );

    // TODO: Send OTP to email/SMS here
    console.log("New OTP:", otp);

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully"
    });

  } catch (error) {

    console.error("Resend OTP Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  refreshToken,
  cancelRide,
  resendUserOTP
};