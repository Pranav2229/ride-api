const pool = require("../../middleware/db.connection.js");
const jwt = require("jsonwebtoken");
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
    console.log("refreshTokenrefreshTokenrefreshToken", refreshToken);

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

module.exports = {
  refreshToken,
  cancelRide
};