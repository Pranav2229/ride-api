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
                DriverId: Driver.data.driver_id,
                fullname: Driver.data.full_name
            },
            process.env.JWT_ACCESS_SECRET,
            {
                expiresIn: "1m"
            }
        );
        // // Refresh Token
        const refreshToken = jwt.sign(
            {
                DriverId: Driver.data.driver_id
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
                role : "DRIVER",
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
    acceptRide,
    startRide,
    completeRide,
    updateDriverLocation,
    getDriverEarnings
};