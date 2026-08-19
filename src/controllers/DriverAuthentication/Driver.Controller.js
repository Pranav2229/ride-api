const pool = require("../../middleware/db.connection.js");
const jwt = require("jsonwebtoken");
const {
    checkSchema,
    body,
    validationResult
} = require("express-validator");
const {
    emitRideAccepted,
    emitRideStarted,
    emitRideCompleted,
    emitDriverLocation
} = require("../../sockets/RideSocket/ride.socket.js");

const loginDriver = async (req, res) => {
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
            `CALL public.Login_Driver($1, $2, NULL)`,
            [email, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }
        const Driver = result.rows[0].p_response;

        if (!Driver.success) {
            return res.status(401).json({
                success: false,
                message: Driver.message
            });
        }
        // // Access Token
        const accessToken = jwt.sign(
            {
                userId: Driver.data.driver_id,
                fullName: Driver.data.full_name
            },
            process.env.JWT_ACCESS_SECRET,
            {
                expiresIn: "15m"
            }
        );
        // // Refresh Token
        const refreshToken = jwt.sign(
            {
                userId: Driver.data.driver_id
            },
            process.env.JWT_REFRESH_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                role: "DRIVER",
                Driver,
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

const registerDriver = async (req, res) => {
    try {

        // Check Validation Errors
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
            profile_image,
            license_number,
            aadhaar_number,
            pan_number
        } = req.body;

        // Execute Stored Procedure
        const result = await pool.query(
            `
            CALL public.register_driver(
                $1,  -- full_name
                $2,  -- email
                $3,  -- phone
                $4,  -- password
                $5,  -- profile_image
                $6,  -- license_number
                $7,  -- aadhaar_number
                $8,  -- pan_number
                NULL
            )
            `,
            [
                full_name,
                email,
                phone,
                password,
                profile_image || null,
                license_number,
                aadhaar_number || null,
                pan_number || null
            ]
        );

        // Check Procedure Response
        if (
            !result.rows ||
            result.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Unable to register driver"
            });
        }

        const response =
            result.rows[0].p_response;

        // Procedure Failed
        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }

        // Registration Successful
        return res.status(201).json({
            success: true,
            message: response.message,
            data: response.data
        });

    } catch (error) {

        console.error("Register Driver Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }
};

const updateDriverProfile = async (req, res) => {
    try {

        // Check Validation Errors
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        // Driver ID from JWT
        const driverId = req.user.userId;

        const {
            full_name,
            email,
            phone,
            profile_image,
            license_number,
            aadhaar_number,
            pan_number
        } = req.body;

        // Execute Stored Procedure
        const result = await pool.query(
            `
            CALL public.update_driver_profile(
                $1,  -- driver_id
                $2,  -- full_name
                $3,  -- email
                $4,  -- phone
                $5,  -- profile_image
                $6,  -- license_number
                $7,  -- aadhaar_number
                $8,  -- pan_number
                NULL
            )
            `,
            [
                driverId,
                full_name,
                email,
                phone,
                profile_image || null,
                license_number,
                aadhaar_number || null,
                pan_number || null
            ]
        );

        // Check Procedure Response
        if (
            !result.rows ||
            result.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Unable to update driver profile"
            });
        }

        const response = result.rows[0].p_response;

        // Procedure Failed
        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }

        // Success
        return res.status(200).json({
            success: true,
            message: response.message,
            data: response.data
        });

    } catch (error) {

        console.error(
            "Update Driver Profile Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }
};

const acceptRide = async (req, res) => {
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
            vehicle_id
        } = req.body;

        // From JWT token
        const driver_id = req.user.userId;

        const result = await pool.query(`CALL public.accept_ride($1,$2,$3,NULL)`,
            [
                ride_id,
                driver_id,
                vehicle_id
            ]
        );

        if (
            !result.rows ||
            result.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Unable to accept ride"
            });
        }

        const response = result.rows[0].p_response;

        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }

        emitRideAccepted(
            response.data.user_id,
            {
                ride_id,
                driver_id,
                vehicle_id
            }
        );

        return res.status(200).json({
            success: true,
            message: response.message
        });



    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }
};

const startRide = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { ride_id } = req.body;
        const result = await pool.query(
            `
      CALL public.start_ride(
        $1,
        NULL
      )
      `,
            [ride_id]
        );

        if (
            !result.rows ||
            result.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Unable to start ride"
            });
        }

        const response = result.rows[0].p_response;

        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }

        emitRideStarted(
            response.data.user_id,
            response.data
        );


        return res.status(200).json({
            success: true,
            message: response.message,
            data: {
                ride_id: response.data.ride_id,
                ride_status: response.data.ride_status,
                started_at: response.data.started_at
            }
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

const completeRide = async (req, res) => {
    try {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { ride_id } = req.body;

        const result = await pool.query(
            `
      CALL public.complete_ride(
        $1,
        NULL
      )
      `,
            [ride_id]
        );

        if (
            !result.rows ||
            result.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Unable to complete ride"
            });
        }

        const response = result.rows[0].p_response;

        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }

        emitRideCompleted(
            response.data.user_id,
            response.data
        );

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

const updateDriverLocation = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        const driver_id = req.user.userId;
        const {
            latitude,
            longitude,
            heading = 0,
            speed = 0
        } = req.body;

        const result = await pool.query(
            `
      CALL public.update_driver_location(
        $1,
        $2,
        $3,
        $4,
        $5,
        NULL
      )
      `,
            [
                driver_id,
                latitude,
                longitude,
                heading,
                speed
            ]
        );

        if (
            !result.rows ||
            result.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Unable to update driver location"
            });
        }

        const response = result.rows[0].p_response;

        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }

        emitDriverLocation(
            response.data.user_id,
            {
                latitude,
                longitude,
                heading,
                speed
            }
        );

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

const getDriverEarnings = async (req, res) => {
    try {

        const driver_id = req.user.userId;

        const result = await pool.query(
            `
      CALL public.get_driver_earnings(
        $1,
        NULL
      )
      `,
            [driver_id]
        );

        if (
            !result.rows ||
            result.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Unable to fetch earnings"
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

module.exports = {
    loginDriver,
    registerDriver,
    updateDriverProfile,
    acceptRide,
    startRide,
    completeRide,
    updateDriverLocation,
    getDriverEarnings
};