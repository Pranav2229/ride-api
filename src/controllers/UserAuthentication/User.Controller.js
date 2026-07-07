const pool = require("../../middleware/db.connection.js");
const jwt = require("jsonwebtoken");
const {
  checkSchema,
  body,
  validationResult
} = require("express-validator");
const crypto = require("crypto");
const { getIO } = require("../../sockets/index.js");
// const { emitRideRequest } = require("../../sockets/RideSocket/ride.socket.js");
const {
  emitNewRide,
} = require("../../sockets/RideSocket/ride.socket.js");
const { getNearbyDriversForSocket } = require("../../services/driver.service.js")
const { emitRideToDrivers } = require("../../sockets/RideSocket/ride.socket.js")

const loginUser = async (req, res) => {
  try {
    // Check Validation Errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    console.log("req.body",req.body);
    
    const { email, password } = req.body;

    // Execute Stored Procedure
    const result = await pool.query(
      `CALL public.Login_User($1, $2, NULL)`,
      [email, password]
    );
    // console.log("result",result);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }
    const user = result.rows[0].p_response;
console.log("user",user);

    if (!user.success) {
      return res.status(401).json({
        success: false,
        message: user.message
      });
    }
    // // Access Token
    const accessToken = jwt.sign(
      {
        userId: user.data.user_id,
        fullname: user.data.full_name
      },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: "15m"
      }
    );
    // // Refresh Token
    const refreshToken = jwt.sign(
      {
        userId: user.data.user_id
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d"
      }
    );
    return res.status(200).json({
      success: true,
      message: "Login successful",
      role : "CUSTOMER",
      data: {
        user,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });

  }
};


const createRide = async (req, res) => {
  try {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const user_id = req.user.userId;

    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,

      drop_address,
      drop_latitude,
      drop_longitude,

      distance,
      estimated_time,

      fare_amount,
      discount_amount,
      tax_amount,
      final_amount,

      payment_method
    } = req.body;

    const ride_unique_id =
      `RID-${Date.now()}-${crypto.randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

    const result = await pool.query(
      `
      CALL public.create_ride(
        $1,  -- ride_unique_id
        $2,  -- user_id

        $3,  -- pickup_address
        $4,  -- pickup_latitude
        $5,  -- pickup_longitude

        $6,  -- drop_address
        $7,  -- drop_latitude
        $8,  -- drop_longitude

        $9,  -- distance
        $10, -- estimated_time

        $11, -- fare_amount
        $12, -- discount_amount
        $13, -- tax_amount
        $14, -- final_amount

        $15, -- payment_method

        NULL
      )
      `,
      [
        ride_unique_id,
        user_id,

        pickup_address,
        pickup_latitude,
        pickup_longitude,

        drop_address,
        drop_latitude,
        drop_longitude,

        distance,
        estimated_time,

        fare_amount,
        discount_amount,
        tax_amount,
        final_amount,

        payment_method
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to create ride"
      });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message
      });
    }

    const nearbyDrivers =
      await getNearbyDriversForSocket(
        pickup_latitude,
        pickup_longitude
      );

    emitRideToDrivers(
      nearbyDrivers,
      response.data
    );

    return res.status(201).json({
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

const getNearbyDrivers = async (req, res) => {
  try {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      latitude,
      longitude,
      radius_km = 1
    } = req.body;

    const result = await pool.query(
      `
      CALL public.get_nearby_drivers(
        $1,
        $2,
        $3,
        NULL
      )
      `,
      [
        latitude,
        longitude,
        radius_km
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to fetch nearby drivers"
      });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(404).json({
        success: false,
        message: response.message
      });
    }

    return res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

const getUserRides = async (req, res) => {
  try {

    const user_id = req.user.userId;
    const result = await pool.query(
      `
      CALL public.get_user_rides(
        $1,
        NULL
      )
      `,
      [user_id]
    );

    if (
      !result.rows ||
      result.rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to fetch rides"
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
      data: response
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

module.exports = {
  loginUser,
  createRide,
  getNearbyDrivers,
  getUserRides
};