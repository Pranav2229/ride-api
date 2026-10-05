const pool = require("../../middleware/db.connection.js");
const jwt = require("jsonwebtoken");
const {
  checkSchema,
  body,
  validationResult
} = require("express-validator");
const crypto = require("crypto");
const { getIO } = require("../../sockets/index.js");
const { generateOTP } = require("../../middleware/otp.js")
// const { emitRideRequest } = require("../../sockets/RideSocket/ride.socket.js");
const {
  emitNewRide,
} = require("../../sockets/RideSocket/ride.socket.js");
const { getNearbyDriversForSocket } = require("../../services/driver.service.js")
const { emitRideToDrivers } = require("../../sockets/RideSocket/ride.socket.js")
const { searchPlaces } = require("../../middleware/nominatim.service.js");
const { getRoute } = require("../../middleware/osrm.service.js");

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

    if (!user.data.is_varified) {
      const otp = generateOTP();


      // OTP valid for 10 minutes
      const expiresAt = new Date(
        Date.now() + 10 * 60 * 1000
      );

      // Store OTP
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
          user.data.user_id,
          otp,
          expiresAt
        ]
      );
    }
    return res.status(200).json({
      success: true,
      message: "Login successful",
      role: "CUSTOMER",
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

const registerUser = async (req, res) => {
  try {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      full_name,
      email,
      phone,
      password,
      gender
    } = req.body;

    const result = await pool.query(
      `
      CALL public.register_user(
        $1,  -- full_name
        $2,  -- email
        $3,  -- phone
        $4,  -- password
        $5,  -- gender
        NULL
      )
      `,
      [
        full_name,
        email,
        phone,
        password,
        gender
      ]
    );

    if (
      !result.rows ||
      result.rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to register user"
      });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message
      });
    }



    const user_id = response.data.user_id;
    const otp = generateOTP();


    // OTP valid for 10 minutes
    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // Store OTP
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

const updateUserProfile = async (req, res) => {
  try {

    // VALIDATION
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // GET USER ID FROM JWT
    const user_id = req.user.userId;

    const {
      full_name,
      email,
      phone,
      profile_image,
      gender
    } = req.body;


    // CALL STORED PROCEDURE
    const result = await pool.query(
      `
      CALL public.update_user_profile(
        $1,  -- user_id
        $2,  -- full_name
        $3,  -- email
        $4,  -- phone
        $5,  -- profile_image
        $6,  -- gender
        NULL
      )
      `,
      [
        user_id,
        full_name,
        email,
        phone,
        profile_image,
        gender
      ]
    );


    // CHECK RESPONSE
    if (
      !result.rows ||
      result.rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to update user profile"
      });
    }


    const response = result.rows[0].p_response;


    // SP ERROR
    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message
      });
    }


    // SUCCESS
    return res.status(200).json({
      success: true,
      message: response.message,
      data: response.data
    });

  } catch (error) {

    console.error("Update User Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// const createRide = async (req, res) => {
//   try {

//     const errors = validationResult(req);

//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         success: false,
//         errors: errors.array()
//       });
//     }

//     const user_id = req.user.userId;

//     const {
//       pickup_address,
//       pickup_latitude,
//       pickup_longitude,

//       drop_address,
//       drop_latitude,
//       drop_longitude,

//       distance,
//       estimated_time,

//       fare_amount,
//       discount_amount,
//       tax_amount,
//       final_amount,

//       payment_method
//     } = req.body;

//     const ride_unique_id =
//       `RID-${Date.now()}-${crypto.randomBytes(3)
//         .toString("hex")
//         .toUpperCase()}`;

//     const result = await pool.query(
//       `
//       CALL public.create_ride(
//         $1,  -- ride_unique_id
//         $2,  -- user_id

//         $3,  -- pickup_address
//         $4,  -- pickup_latitude
//         $5,  -- pickup_longitude

//         $6,  -- drop_address
//         $7,  -- drop_latitude
//         $8,  -- drop_longitude

//         $9,  -- distance
//         $10, -- estimated_time

//         $11, -- fare_amount
//         $12, -- discount_amount
//         $13, -- tax_amount
//         $14, -- final_amount

//         $15, -- payment_method

//         NULL
//       )
//       `,
//       [
//         ride_unique_id,
//         user_id,

//         pickup_address,
//         pickup_latitude,
//         pickup_longitude,

//         drop_address,
//         drop_latitude,
//         drop_longitude,

//         distance,
//         estimated_time,

//         fare_amount,
//         discount_amount,
//         tax_amount,
//         final_amount,

//         payment_method
//       ]
//     );

//     if (!result.rows || result.rows.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Unable to create ride"
//       });
//     }

//     const response = result.rows[0].p_response;

//     if (!response.success) {
//       return res.status(400).json({
//         success: false,
//         message: response.message
//       });
//     }

//     const nearbyDrivers =
//       await getNearbyDriversForSocket(
//         pickup_latitude,
//         pickup_longitude
//       );

//     emitRideToDrivers(
//       nearbyDrivers,
//       response.data
//     );

//     return res.status(201).json({
//       success: true,
//       message: response.message,
//       data: response.data
//     });

//   } catch (error) {

//     console.error(error);

//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });

//   }
// };

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

    // ✅ Generate ride OTP (4-digit)
    const ride_otp = generateOTP(4);

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
        $16, -- ride_otp

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

        payment_method,
        ride_otp
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

const verifyUserOTP = async (req, res) => {
  try {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { user_id, otp } = req.body;

    const result = await pool.query(
      `
            CALL public.verify_user_otp(
                $1,
                $2,
                NULL
            )
            `,
      [
        user_id,
        otp
      ]
    );

    if (
      !result.rows ||
      result.rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to verify OTP"
      });
    }
    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message
      });
    }

    const response_user = response.data


    // Access Token
    const accessToken = jwt.sign(
      {
        userId: response_user.user_id,
        fullname: response_user.full_name
      },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: "15m"
      }
    );
    // Refresh Token
    const refreshToken = jwt.sign(
      {
        userId: response_user.user_id
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.status(200).json({
      success: true,
      message: response.message,
      role: "CUSTOMER",
      data: {
        response_user,
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

const getActiveRide = async (req, res) => {
  try {
    const user_id = req.user.userId;

    const result = await pool.query(
      `CALL public.get_active_ride($1, NULL)`,
      [user_id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to fetch active ride",
      });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
      message: response.message,
    });

  } catch (error) {
    console.error("Get Active Ride Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ---------------------------------------------------------
// GET /api/general/user/wallet
// Returns balance + recent transactions
// ---------------------------------------------------------
const getWallet = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Balance from users table
    const balanceRes = await pool.query(
      `SELECT wallet_balance FROM public.users WHERE id = $1`,
      [userId]
    );

    if (balanceRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const balance = Number(balanceRes.rows[0].wallet_balance || 0);

    // 2. Recent transactions (last 50)
    const txRes = await pool.query(
      `SELECT id, type, amount, description, created_at
       FROM public.wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        balance,
        transactions: txRes.rows.map((row) => ({
          id: row.id,
          type: row.type,                     // "credit" | "debit"
          amount: Number(row.amount),
          description: row.description,
          created_at: row.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Get Wallet Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch wallet",
    });
  }
};

// ---------------------------------------------------------
// POST /api/general/user/wallet/add_money
// Adds money to wallet (mock recharge for now)
// Body: { amount }
// ---------------------------------------------------------
const addMoneyToWallet = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    // Validate amount (in rupees; multiply by 100 if using paise)
    const numericAmount = Number(amount);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > 100000
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount must be between 1 and 100000",
        field: "amount",
      });
    }

    await client.query("BEGIN");

    // 1. Lock user row to prevent race conditions
    const userRes = await client.query(
      `SELECT wallet_balance FROM public.users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentBalance = Number(userRes.rows[0].wallet_balance || 0);
    const newBalance = currentBalance + numericAmount;

    // 2. Insert transaction
    const txRes = await client.query(
      `INSERT INTO public.wallet_transactions
         (user_id, type, amount, description, created_at)
       VALUES ($1, 'CREDIT', $2, $3, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, numericAmount, "Wallet Recharge"]
    );

    // 3. Update balance
    await client.query(
      `UPDATE public.users SET wallet_balance = $1 WHERE id = $2`,
      [newBalance, userId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Money added to wallet",
      data: {
        balance: newBalance,
        transaction: {
          id: txRes.rows[0].id,
          type: "CREDIT",
          amount: numericAmount,
          description: "Wallet Recharge",
          created_at: txRes.rows[0].created_at,
        },
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Add Money Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add money",
    });
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------
// Internal helper — call this from ride completion to debit wallet
// Not exposed as a route; used by other controllers
// ---------------------------------------------------------
const debitWallet = async (client, userId, amount, description) => {
  const userRes = await client.query(
    `SELECT wallet_balance FROM public.users WHERE id = $1 FOR UPDATE`,
    [userId]
  );

  const currentBalance = Number(userRes.rows[0]?.wallet_balance || 0);

  if (currentBalance < amount) {
    throw new Error("INSUFFICIENT_BALANCE");
  }

  const newBalance = currentBalance - amount;

  await client.query(
    `INSERT INTO public.wallet_transactions
       (user_id, type, amount, description, created_at)
     VALUES ($1, 'debit', $2, $3, CURRENT_TIMESTAMP)`,
    [userId, amount, description]
  );

  await client.query(
    `UPDATE public.users SET wallet_balance = $1 WHERE id = $2`,
    [newBalance, userId]
  );

  return newBalance;
};

// ---------------------------------------------------------
// GET /api/general/user/notifications
// Returns list of user's notifications (newest first)
// Query params: ?limit=50&offset=0&unreadOnly=true
// ---------------------------------------------------------
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const unreadOnly = req.query.unreadOnly === "true";

    const whereClause = unreadOnly
      ? "WHERE user_id = $1 AND is_read = false"
      : "WHERE user_id = $1";

    const result = await pool.query(
      `SELECT id, title, message, type, is_read, created_at
       FROM public.notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Count total unread for badge
    const unreadRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM public.notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: unreadRes.rows[0].count,
      },
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

// ---------------------------------------------------------
// POST /api/general/user/notifications/:id/read
// Mark one notification as read
// ---------------------------------------------------------
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE public.notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Marked as read",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Mark As Read Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark as read",
    });
  }
};

// ---------------------------------------------------------
// POST /api/general/user/notifications/read_all
// Mark all as read
// ---------------------------------------------------------
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE public.notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: "All marked as read",
      data: { updated: result.rowCount },
    });
  } catch (error) {
    console.error("Mark All Read Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all as read",
    });
  }
};

// ---------------------------------------------------------
// DELETE /api/general/user/notifications/:id
// Delete one notification
// ---------------------------------------------------------
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM public.notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Deleted",
    });
  } catch (error) {
    console.error("Delete Notification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

// ---------------------------------------------------------
// Internal helper — call this from other controllers to create
// a notification (e.g. on ride completion, wallet credit, etc.)
// ---------------------------------------------------------
const createNotification = async (client, userId, { title, message, type }) => {
  try {
    const result = await client.query(
      `INSERT INTO public.notifications
         (user_id, title, message, type, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, title, message, type]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Create Notification Error:", error);
    return null;
  }
};

// ---------------------------------------------------------
// GET /api/general/user/offers
// Returns active + expired offers for the current user
// ---------------------------------------------------------
const getOffers = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. All offers (active + expired) with user redemption counts
    const result = await pool.query(
      `SELECT
         o.*,
         COALESCE(r.used_by_user, 0)::int AS used_by_user
       FROM public.offers o
       LEFT JOIN (
         SELECT offer_id, COUNT(*) AS used_by_user
         FROM public.coupon_redemptions
         WHERE user_id = $1
         GROUP BY offer_id
       ) r ON r.offer_id = o.id
       ORDER BY o.valid_until DESC`,
      [userId]
    );

    const now = new Date();

    const active = [];
    const expired = [];

    for (const o of result.rows) {
      const isExpired =
        !o.is_active ||
        new Date(o.valid_until) < now ||
        (o.max_uses !== null && o.current_uses >= o.max_uses) ||
        (o.max_uses_per_user !== null && o.used_by_user >= o.max_uses_per_user);

      const mapped = {
        id: o.id,
        code: o.code,
        title: o.title,
        description: o.description,
        savings: o.savings_text,
        icon: o.icon || "ticket-percent",
        color: o.color || "#22C55E",
        discount_type: o.discount_type,
        discount_value: Number(o.discount_value),
        max_discount: o.max_discount ? Number(o.max_discount) : null,
        min_ride_amount: Number(o.min_ride_amount),
        valid_until: o.valid_until,
        expiry: formatExpiry(o.valid_until),
        used_by_user: o.used_by_user,
      };

      if (isExpired) expired.push(mapped);
      else active.push(mapped);
    }

    return res.status(200).json({
      success: true,
      data: { available: active, expired },
    });
  } catch (error) {
    console.error("Get Offers Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch offers",
    });
  }
};

// ---------------------------------------------------------
// POST /api/general/user/coupons/validate
// Body: { code, ride_amount }
// Validates a coupon for the given ride amount and returns
// the discount it would apply. Does NOT redeem it.
// ---------------------------------------------------------
const validateCoupon = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { code, ride_amount } = req.body;

    const rideAmount = Number(ride_amount);
    if (!Number.isFinite(rideAmount) || rideAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid ride amount",
        field: "ride_amount",
      });
    }

    const offerRes = await pool.query(
      `SELECT * FROM public.offers WHERE UPPER(code) = UPPER($1) LIMIT 1`,
      [code]
    );

    if (offerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    const offer = offerRes.rows[0];
    const now = new Date();

    // Expiry / activity checks
    if (!offer.is_active) {
      return res.status(400).json({ success: false, message: "This coupon is no longer active" });
    }
    if (new Date(offer.valid_until) < now) {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }
    if (new Date(offer.valid_from) > now) {
      return res.status(400).json({ success: false, message: "This coupon is not yet valid" });
    }

    // Global max uses
    if (offer.max_uses !== null && offer.current_uses >= offer.max_uses) {
      return res.status(400).json({ success: false, message: "This coupon is no longer available" });
    }

    // Per-user limit
    if (offer.max_uses_per_user !== null) {
      const usedRes = await pool.query(
        `SELECT COUNT(*)::int AS c
         FROM public.coupon_redemptions
         WHERE offer_id = $1 AND user_id = $2`,
        [offer.id, userId]
      );
      if (usedRes.rows[0].c >= offer.max_uses_per_user) {
        return res.status(400).json({
          success: false,
          message: "You have already used this coupon",
        });
      }
    }

    // Min ride amount
    if (rideAmount < Number(offer.min_ride_amount)) {
      return res.status(400).json({
        success: false,
        message: `Minimum ride amount for this coupon is ₹${offer.min_ride_amount}`,
      });
    }

    // Compute discount
    let discount = 0;
    if (offer.discount_type === "FLAT") {
      discount = Number(offer.discount_value);
    } else if (offer.discount_type === "PERCENT") {
      discount = (rideAmount * Number(offer.discount_value)) / 100;
      if (offer.max_discount) {
        discount = Math.min(discount, Number(offer.max_discount));
      }
    }

    // Never discount more than the ride
    discount = Math.min(discount, rideAmount);
    discount = Math.round(discount * 100) / 100;

    return res.status(200).json({
      success: true,
      data: {
        offer_id: offer.id,
        code: offer.code,
        title: offer.title,
        discount,
        original_amount: rideAmount,
        final_amount: Math.round((rideAmount - discount) * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Validate Coupon Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
    });
  }
};

// ---------------------------------------------------------
// Internal helper — call from complete_ride to redeem a coupon
// Must be called inside a DB transaction
// ---------------------------------------------------------
const redeemCoupon = async (client, userId, offerId, rideId, discount) => {
  // Lock the offer row
  const offerRes = await client.query(
    `SELECT current_uses, max_uses FROM public.offers WHERE id = $1 FOR UPDATE`,
    [offerId]
  );
  if (offerRes.rows.length === 0) throw new Error("OFFER_NOT_FOUND");

  const { current_uses, max_uses } = offerRes.rows[0];
  if (max_uses !== null && current_uses >= max_uses) {
    throw new Error("OFFER_EXHAUSTED");
  }

  // Insert redemption
  await client.query(
    `INSERT INTO public.coupon_redemptions (offer_id, user_id, ride_id, discount)
     VALUES ($1, $2, $3, $4)`,
    [offerId, userId, rideId, discount]
  );

  // Increment counter
  await client.query(
    `UPDATE public.offers SET current_uses = current_uses + 1 WHERE id = $1`,
    [offerId]
  );
};

// ---------------------------------------------------------
// Helper: format expiry text like "Valid till 31 Dec 2026"
// ---------------------------------------------------------
function formatExpiry(date) {
  try {
    return `Valid till ${new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  } catch {
    return "";
  }
}

const getRewards = async (req, res) => {
  try {
    const userId = req.user.userId;

    const userRes = await pool.query(
      `SELECT reward_points FROM public.users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const points = Number(userRes.rows[0].reward_points || 0);

    const levelsRes = await pool.query(
      `SELECT name, min_points FROM public.reward_levels ORDER BY sort_order ASC`
    );

    const levels = levelsRes.rows.map((r) => ({
      name: r.name,
      min_points: Number(r.min_points),
    }));

    let currentLevel = levels[0];
    let nextLevel = null;

    for (let i = 0; i < levels.length; i++) {
      if (points >= levels[i].min_points) {
        currentLevel = levels[i];
        nextLevel = levels[i + 1] || null;
      }
    }

    const pointsNeeded = nextLevel ? Math.max(0, nextLevel.min_points - points) : 0;

    let progressPercent = 100;
    if (nextLevel) {
      const range = nextLevel.min_points - currentLevel.min_points;
      const earned = points - currentLevel.min_points;
      progressPercent = Math.min(100, Math.max(0, (earned / range) * 100));
    }

    const historyRes = await pool.query(
      `SELECT id, points, type, title, subtitle, icon, color, created_at
       FROM public.reward_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        points,
        level: currentLevel.name,
        nextLevel: nextLevel?.name || null,
        pointsNeeded,
        progressPercent: Math.round(progressPercent),
        history: historyRes.rows.map((r) => ({
          id: r.id,
          points: Number(r.points),
          type: r.type,
          title: r.title,
          subtitle: r.subtitle,
          icon: r.icon || "star",
          color: r.color || "#F9C74F",
          created_at: r.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Get Rewards Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch rewards" });
  }
};

const awardPoints = async (client, userId, { points, type, title, subtitle, icon, color, rideId, offerId }) => {
  if (!points) return null;

  const txRes = await client.query(
    `INSERT INTO public.reward_transactions
       (user_id, points, type, title, subtitle, icon, color, ride_id, offer_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [userId, points, type, title, subtitle || null, icon || null, color || null, rideId || null, offerId || null]
  );

  await client.query(
    `UPDATE public.users SET reward_points = reward_points + $1 WHERE id = $2`,
    [points, userId]
  );

  return txRes.rows[0];
};

const getAddresses = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, title, icon, address, latitude, longitude, is_default, created_at
       FROM public.saved_addresses
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows.map((r) => ({
        ...r,
        latitude: r.latitude ? Number(r.latitude) : null,
        longitude: r.longitude ? Number(r.longitude) : null,
      })),
    });
  } catch (error) {
    console.error("Get Addresses Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch addresses" });
  }
};

const addAddress = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { title, icon, address, latitude, longitude, is_default } = req.body;

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS c FROM public.saved_addresses WHERE user_id = $1`,
      [userId]
    );
    if (countRes.rows[0].c >= 10) {
      return res.status(400).json({ success: false, message: "Maximum 10 addresses allowed" });
    }

    await client.query("BEGIN");

    const shouldBeDefault = is_default === true || countRes.rows[0].c === 0;

    if (shouldBeDefault) {
      await client.query(
        `UPDATE public.saved_addresses SET is_default = false WHERE user_id = $1`,
        [userId]
      );
    }

    const result = await client.query(
      `INSERT INTO public.saved_addresses
         (user_id, title, icon, address, latitude, longitude, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [userId, title.trim(), icon || "map-marker", address.trim(),
        latitude || null, longitude || null, shouldBeDefault]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Address added",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Add Address Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add address" });
  } finally {
    client.release();
  }
};

const updateAddress = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { title, icon, address, latitude, longitude, is_default } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM public.saved_addresses WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    if (is_default === true) {
      await client.query(
        `UPDATE public.saved_addresses SET is_default = false WHERE user_id = $1`,
        [userId]
      );
    }

    const result = await client.query(
      `UPDATE public.saved_addresses
       SET title = COALESCE($1, title),
           icon = COALESCE($2, icon),
           address = COALESCE($3, address),
           latitude = COALESCE($4, latitude),
           longitude = COALESCE($5, longitude),
           is_default = COALESCE($6, is_default),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [title?.trim() || null, icon || null, address?.trim() || null,
      latitude ?? null, longitude ?? null,
      typeof is_default === "boolean" ? is_default : null,
        id, userId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Address updated",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Address Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update address" });
  } finally {
    client.release();
  }
};

const deleteAddress = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    await client.query("BEGIN");

    const deleted = await client.query(
      `DELETE FROM public.saved_addresses
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_default`,
      [id, userId]
    );

    if (deleted.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    if (deleted.rows[0].is_default) {
      await client.query(
        `UPDATE public.saved_addresses
         SET is_default = true
         WHERE id = (
           SELECT id FROM public.saved_addresses
           WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 1
         )`,
        [userId]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({ success: true, message: "Address deleted" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Address Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete address" });
  } finally {
    client.release();
  }
};

const setDefaultAddress = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM public.saved_addresses WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    await client.query(
      `UPDATE public.saved_addresses SET is_default = false WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `UPDATE public.saved_addresses SET is_default = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    await client.query("COMMIT");

    return res.status(200).json({ success: true, message: "Default updated" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Set Default Error:", error);
    return res.status(500).json({ success: false, message: "Failed to set default" });
  } finally {
    client.release();
  }
};


const getReferralInfo = async (req, res) => {
  try {
    const userId = req.user.userId;

    const userRes = await pool.query(
      `SELECT referral_code FROM public.users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const referralCode = userRes.rows[0].referral_code;

    const statsRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
         COUNT(*)::int AS total_count,
         COALESCE(SUM(reward_amount) FILTER (WHERE status = 'COMPLETED'), 0) AS total_earned
       FROM public.referrals
       WHERE referrer_id = $1`,
      [userId]
    );

    const historyRes = await pool.query(
      `SELECT
         r.id, r.status, r.reward_amount, r.completed_at, r.created_at,
         u.full_name AS referee_name
       FROM public.referrals r
       JOIN public.users u ON u.id = r.referee_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        referralCode,
        totalEarned: Number(statsRes.rows[0].total_earned),
        completedCount: statsRes.rows[0].completed_count,
        totalCount: statsRes.rows[0].total_count,
        history: historyRes.rows.map((r) => ({
          id: r.id,
          name: r.referee_name,
          status: r.status === "COMPLETED" ? "Completed" : "Pending",
          reward: `₹${Number(r.reward_amount)}`,
        })),
      },
    });
  } catch (error) {
    console.error("Get Referral Info Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch referral info" });
  }
};

const applyReferralCode = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { code } = req.body;

    const codeUpper = code.trim().toUpperCase();

    const selfRes = await client.query(
      `SELECT id FROM public.users WHERE id = $1 AND referral_code = $2`,
      [userId, codeUpper]
    );
    if (selfRes.rows.length > 0) {
      return res.status(400).json({ success: false, message: "You cannot use your own referral code" });
    }

    const referrerRes = await client.query(
      `SELECT id FROM public.users WHERE referral_code = $1`,
      [codeUpper]
    );
    if (referrerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Invalid referral code" });
    }

    const referrerId = referrerRes.rows[0].id;

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM public.referrals WHERE referee_id = $1`,
      [userId]
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Referral already applied" });
    }

    await client.query(
      `INSERT INTO public.referrals (referrer_id, referee_id, status, reward_amount)
       VALUES ($1, $2, 'PENDING', 100)`,
      [referrerId, userId]
    );

    await client.query(
      `UPDATE public.users SET referred_by = $1 WHERE id = $2`,
      [referrerId, userId]
    );

    await client.query("COMMIT");

    return res.status(200).json({ success: true, message: "Referral code applied" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Apply Referral Error:", error);
    return res.status(500).json({ success: false, message: "Failed to apply referral code" });
  } finally {
    client.release();
  }
};

const completeReferral = async (client, refereeId) => {
  const refRes = await client.query(
    `SELECT id, referrer_id, reward_amount
     FROM public.referrals
     WHERE referee_id = $1 AND status = 'PENDING'
     LIMIT 1`,
    [refereeId]
  );

  if (refRes.rows.length === 0) return null;

  const { id, referrer_id, reward_amount } = refRes.rows[0];

  await client.query(
    `UPDATE public.referrals
     SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );

  await client.query(
    `UPDATE public.users
     SET wallet_balance = wallet_balance + $1
     WHERE id = $2`,
    [reward_amount, referrer_id]
  );

  await client.query(
    `INSERT INTO public.wallet_transactions (user_id, type, amount, description)
     VALUES ($1, 'credit', $2, $3)`,
    [referrer_id, reward_amount, "Referral bonus"]
  );

  return { referrer_id, reward_amount };
};


const searchPlacesController = async (req, res) => {
  try {
    const { q, lat, lng } = req.query;

    if (!q || String(q).trim().length < 3) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Query too short",
      });
    }

    const results = await searchPlaces(String(q), {
      lat: lat ? parseFloat(String(lat)) : null,
      lng: lng ? parseFloat(String(lng)) : null,
      limit: 10,
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Search Places Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search places",
    });
  }
};
const getRouteController = async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({
        success: false,
        message: "fromLat, fromLng, toLat, toLng are required",
      });
    }

    const route = await getRoute(
      parseFloat(String(fromLat)),
      parseFloat(String(fromLng)),
      parseFloat(String(toLat)),
      parseFloat(String(toLng))
    );

    return res.status(200).json({ success: true, data: route });
  } catch (error) {
    console.error("Get Route Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch route",
    });
  }
};

const estimateFares = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { distance_km, duration_min, is_night, vehicle_type } = req.body;

    const result = await pool.query(
      `CALL public.estimate_fares($1, $2, $3, $4, NULL)`,
      [
        distance_km,
        duration_min,
        is_night === true,
        vehicle_type || null,
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to estimate fares",
      });
    }

    const response = result.rows[0].p_response;

    if (!response.success) {
      return res.status(400).json({
        success: false,
        message: response.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Estimate Fares Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getRideById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         r.id, r.ride_unique_id, r.user_id, r.driver_id, r.vehicle_id,
         r.pickup_address, r.pickup_latitude, r.pickup_longitude,
         r.drop_address, r.drop_latitude, r.drop_longitude,
         r.distance, r.estimated_time, r.actual_time,
         r.ride_status, r.fare_amount, r.discount_amount, r.tax_amount,
         r.final_amount, r.payment_method, r.payment_status,
         r.ride_otp,
         r.ride_started_at, r.ride_completed_at, r.created_at,
         d.full_name  AS driver_name,
         d.phone      AS driver_phone,
         d.profile_image AS driver_image,
         d.rating     AS driver_avg_rating,
         d.current_latitude  AS driver_current_lat,     -- ✅ from drivers
         d.current_longitude AS driver_current_lng,     -- ✅ from drivers
         v.vehicle_type, v.vehicle_number, v.vehicle_model, v.vehicle_color
       FROM public.rides r
       LEFT JOIN public.drivers  d ON d.id = r.driver_id
       LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
       WHERE r.id = $1 AND r.user_id = $2
       LIMIT 1`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    const r = result.rows[0];
    const driver = r.driver_id
      ? {
        driver_id: r.driver_id,
        full_name: r.driver_name,
        phone: r.driver_phone,
        profile_image: r.driver_image,
        rating: r.driver_avg_rating,
        vehicle_type: r.vehicle_type,
        vehicle_number: r.vehicle_number,
        vehicle_model: r.vehicle_model,
        vehicle_color: r.vehicle_color,
      }
      : null;

    return res.status(200).json({
      success: true,
      data: {
        id: r.id,
        ride_unique_id: r.ride_unique_id,
        user_id: r.user_id,
        driver_id: r.driver_id,
        vehicle_id: r.vehicle_id,
        pickup_address: r.pickup_address,
        pickup_latitude: r.pickup_latitude,
        pickup_longitude: r.pickup_longitude,
        drop_address: r.drop_address,
        drop_latitude: r.drop_latitude,
        drop_longitude: r.drop_longitude,
        distance: r.distance,
        estimated_time: r.estimated_time,
        actual_time: r.actual_time,
        ride_status: r.ride_status,
        fare_amount: r.fare_amount,
        discount_amount: r.discount_amount,
        tax_amount: r.tax_amount,
        final_amount: r.final_amount,
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        ride_otp: r.ride_otp,
        ride_started_at: r.ride_started_at,
        ride_completed_at: r.ride_completed_at,
        created_at: r.created_at,
        driver,
        driver_current_lat: r.driver_current_lat,
        driver_current_lng: r.driver_current_lng,
      },
    });
  } catch (error) {
    console.error("Get Ride By Id Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch ride" });
  }
};

const rateRide = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { rating, review } = req.body;

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1–5" });
    }

    await client.query("BEGIN");

    // Fetch the ride to validate + get driver_id
    const rideRes = await client.query(
      `SELECT id, user_id, driver_id, ride_status
       FROM public.rides
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [id, userId]
    );

    if (rideRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    const ride = rideRes.rows[0];

    if (ride.ride_status !== "COMPLETED") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Ride is not completed yet" });
    }

    if (!ride.driver_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "No driver to rate" });
    }

    // ✅ Insert into public.reviews
    const insertRes = await client.query(
      `INSERT INTO public.reviews (ride_id, user_id, driver_id, rating, review)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, rating, review, created_at`,
      [ride.id, userId, ride.driver_id, r, review?.trim() || null]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Rating saved",
      data: insertRes.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Rate Ride Error:", error);

    // Handle duplicate rating (if you add a unique constraint on ride_id)
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "You have already rated this ride",
      });
    }

    return res.status(500).json({ success: false, message: "Failed to save rating" });
  } finally {
    client.release();
  }
};

module.exports = {
  searchPlacesController,
  getRouteController,
  loginUser,
  registerUser,
  updateUserProfile,
  createRide,
  getNearbyDrivers,
  getUserRides,
  verifyUserOTP,
  getActiveRide,
  getWallet,
  addMoneyToWallet,
  debitWallet,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getOffers,
  validateCoupon,
  redeemCoupon,
  getRewards,
  awardPoints,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getReferralInfo,
  applyReferralCode,
  completeReferral,
  estimateFares,
  rateRide,
  getRideById
};