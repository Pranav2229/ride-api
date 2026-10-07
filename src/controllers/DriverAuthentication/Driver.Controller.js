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
    emitDriverLocation,
    emitDriverArrived
} = require("../../sockets/RideSocket/ride.socket.js");
const { generateOTP } = require("../../middleware/otp.js")


// const loginDriver = async (req, res) => {
//     try {
//         // Check Validation Errors
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({
//                 success: false,
//                 errors: errors.array()
//             });
//         }
//         const { email, password } = req.body;

//         // Execute Stored Procedure
//         const result = await pool.query(
//             `CALL public.Login_Driver($1, $2, NULL)`,
//             [email, password]
//         );

//         if (result.rows.length === 0) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid email or password"
//             });
//         }
//         const Driver = result.rows[0].p_response;

//         if (!Driver.success) {
//             return res.status(401).json({
//                 success: false,
//                 message: Driver.message
//             });
//         }
//         // // Access Token
//         const accessToken = jwt.sign(
//             {
//                 userId: Driver.data.driver_id,
//                 fullName: Driver.data.full_name
//             },
//             process.env.JWT_ACCESS_SECRET,
//             {
//                 expiresIn: "15m"
//             }
//         );
//         // // Refresh Token
//         const refreshToken = jwt.sign(
//             {
//                 userId: Driver.data.driver_id
//             },
//             process.env.JWT_REFRESH_SECRET,
//             {
//                 expiresIn: "7d"
//             }
//         );

//         if (Driver.data.verification_status == 'PENDING') {
//             // Get Driver ID
//             const driver_id = Driver.data.driver_id;


//             // Generate OTP
//             const otp = generateOTP();


//             // OTP valid for 10 minutes
//             const expiresAt = new Date(
//                 Date.now() + 10 * 60 * 1000
//             );


//             // Store OTP
//             await pool.query(
//                 `
//       INSERT INTO public.driver_otps
//       (
//         driver_id,
//         otp,
//         expires_at
//       )
//       VALUES
//       (
//         $1,
//         $2,
//         $3
//       )
//       `,
//                 [
//                     driver_id,
//                     otp,
//                     expiresAt
//                 ]
//             );
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Login successful",
//             data: {
//                 role: "DRIVER",
//                 Driver,
//                 accessToken,
//                 refreshToken
//             }
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal Server Error"
//         });

//     }
// };

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

        // ✅ Fetch driver's vehicle and attach vehicle_id
        try {
            const vehicleRes = await pool.query(
                `SELECT id, vehicle_type, vehicle_number, vehicle_model, vehicle_color
         FROM public.vehicles
         WHERE driver_id = $1
         LIMIT 1`,
                [Driver.data.driver_id]
            );

            if (vehicleRes.rows.length > 0) {
                Driver.data.vehicle_id = vehicleRes.rows[0].id;
                Driver.data.vehicle = {
                    id: vehicleRes.rows[0].id,
                    vehicle_type: vehicleRes.rows[0].vehicle_type,
                    vehicle_number: vehicleRes.rows[0].vehicle_number,
                    vehicle_model: vehicleRes.rows[0].vehicle_model,
                    vehicle_color: vehicleRes.rows[0].vehicle_color,
                };
            } else {
                Driver.data.vehicle_id = null;
                Driver.data.vehicle = null;
            }
        } catch (vehicleErr) {
            console.log("Vehicle fetch during login failed:", vehicleErr.message);
            Driver.data.vehicle_id = null;
            Driver.data.vehicle = null;
        }

        // Access Token
        const accessToken = jwt.sign(
            {
                userId: Driver.data.driver_id,
                fullName: Driver.data.full_name
            },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "15m" }
        );

        // Refresh Token
        const refreshToken = jwt.sign(
            { userId: Driver.data.driver_id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        if (Driver.data.verification_status === 'PENDING') {
            const driver_id = Driver.data.driver_id;

            const otp = generateOTP();

            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await pool.query(
                `
        INSERT INTO public.driver_otps
        (driver_id, otp, expires_at)
        VALUES ($1, $2, $3)
        `,
                [driver_id, otp, expiresAt]
            );
        }

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



// const registerDriver = async (req, res) => {
//     try {

//         // Check Validation Errors
//         const errors = validationResult(req);

//         if (!errors.isEmpty()) {
//             return res.status(400).json({
//                 success: false,
//                 errors: errors.array()
//             });
//         }

//         const {
//             full_name,
//             email,
//             phone,
//             password,
//             profile_image,
//             license_number,
//             aadhaar_number,
//             pan_number
//         } = req.body;

//         // Execute Stored Procedure
//         const result = await pool.query(
//             `
//             CALL public.register_driver(
//                 $1,  -- full_name
//                 $2,  -- email
//                 $3,  -- phone
//                 $4,  -- password
//                 $5,  -- profile_image
//                 $6,  -- license_number
//                 $7,  -- aadhaar_number
//                 $8,  -- pan_number
//                 NULL
//             )
//             `,
//             [
//                 full_name,
//                 email,
//                 phone,
//                 password,
//                 profile_image || null,
//                 license_number,
//                 aadhaar_number || null,
//                 pan_number || null
//             ]
//         );

//         // Check Procedure Response
//         if (
//             !result.rows ||
//             result.rows.length === 0
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Unable to register driver"
//             });
//         }

//         const response =
//             result.rows[0].p_response;

//         // Procedure Failed
//         if (!response.success) {
//             return res.status(400).json({
//                 success: false,
//                 message: response.message
//             });
//         }

//         // Registration Successful
//         return res.status(201).json({
//             success: true,
//             message: response.message,
//             data: response.data
//         });

//     } catch (error) {

//         console.error("Register Driver Error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Internal Server Error"
//         });

//     }
// };

// changed at 9-4-2026 for otp 

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


        const response = result.rows[0].p_response;


        // Procedure Failed
        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }


        // Get Driver ID
        const driver_id = response.data.driver_id;


        // Generate OTP
        const otp = generateOTP();


        // OTP valid for 10 minutes
        const expiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );


        // Store OTP
        await pool.query(
            `
      INSERT INTO public.driver_otps
      (
        driver_id,
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
                driver_id,
                otp,
                expiresAt
            ]
        );


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

// const startRide = async (req, res) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({
//                 success: false,
//                 errors: errors.array()
//             });
//         }

//         const { ride_id } = req.body;
//         const result = await pool.query(
//             `
//       CALL public.start_ride(
//         $1,
//         NULL
//       )
//       `,
//             [ride_id]
//         );

//         if (
//             !result.rows ||
//             result.rows.length === 0
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Unable to start ride"
//             });
//         }

//         const response = result.rows[0].p_response;

//         if (!response.success) {
//             return res.status(400).json({
//                 success: false,
//                 message: response.message
//             });
//         }

//         emitRideStarted(
//             response.data.user_id,
//             response.data
//         );


//         return res.status(200).json({
//             success: true,
//             message: response.message,
//             data: {
//                 ride_id: response.data.ride_id,
//                 ride_status: response.data.ride_status,
//                 started_at: response.data.started_at
//             }
//         });


//     } catch (error) {

//         console.error(error);

//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });

//     }
// };

const startRide = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { ride_id, otp } = req.body;
        const driver_id = req.user.userId;

        // =====================================================
        // 1. Fetch ride + verify ownership + OTP
        // =====================================================
        const rideRes = await pool.query(
            `SELECT id, user_id, driver_id, ride_status, ride_otp
       FROM public.rides
       WHERE id = $1`,
            [ride_id]
        );

        if (rideRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Ride not found"
            });
        }

        const ride = rideRes.rows[0];

        // Ride must be assigned to this driver
        if (ride.driver_id !== driver_id) {
            return res.status(403).json({
                success: false,
                message: "This ride is not assigned to you"
            });
        }

        // Ride must be in ARRIVED state
        if (ride.ride_status !== "ARRIVED") {
            return res.status(400).json({
                success: false,
                message: `Cannot start ride. Current status is ${ride.ride_status}`
            });
        }

        // OTP must match
        if (!otp || String(ride.ride_otp) !== String(otp).trim()) {
            return res.status(400).json({
                success: false,
                message: "Incorrect OTP. Please check with the customer."
            });
        }

        // =====================================================
        // 2. Call the SP to actually start the ride
        // =====================================================
        const result = await pool.query(
            `CALL public.start_ride($1, NULL)`,
            [ride_id]
        );

        if (!result.rows || result.rows.length === 0) {
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

        // =====================================================
        // 3. Emit socket event to customer
        // =====================================================
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

const verifyDriverOTP = async (req, res) => {
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
            driver_id,
            otp
        } = req.body;

        // Execute Stored Procedure
        const result = await pool.query(
            `
      CALL public.verify_driver_otp(
        $1,  -- driver_id
        $2,  -- otp
        NULL
      )
      `,
            [
                driver_id,
                otp
            ]
        );

        // No response from SP
        if (!result.rows || result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Unable to verify driver OTP"
            });
        }

        const response = result.rows[0].p_response;


        // SP returned failure
        if (!response.success) {
            return res.status(400).json({
                success: false,
                message: response.message
            });
        }

        // // Access Token
        const accessToken = jwt.sign(
            {
                userId: response.data.driver_id,
                fullName: response.data.full_name
            },
            process.env.JWT_ACCESS_SECRET,
            {
                expiresIn: "15m"
            }
        );
        // // Refresh Token
        const refreshToken = jwt.sign(
            {
                userId: response.data.driver_id
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
                response,
                accessToken,
                refreshToken
            }
        });

    } catch (error) {

        console.error("Verify Driver OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }
};

const uploadDriverDocument = async (req, res) => {
    try {
        // const driverId = req.user.userId;
        const driverId = req.user.userId;
        console.log("driverIddriverId", driverId);

        const { document_type } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Document file is required",
            });
        }

        const allowedDocuments = {
            DRIVER_PHOTO: "driver_photo",
            DRIVING_LICENSE: "driving_license",
            ADDRESS_PROOF: "address_proof",
            PAN_CARD: "pan_card",
            EPIC_CARD: "epic_card",
            VEHICLE_RC: "vehicle_rc",
            VEHICLE_FITNESS_CERTIFICATE: "vehicle_fitness_certificate",
            TAXI_PERMIT: "taxi_permit",
        };

        const column = allowedDocuments[document_type];

        if (!column) {
            return res.status(400).json({
                success: false,
                message: "Invalid document type",
            });
        }

        const fileUrl = `/uploads/driver-documents/${req.file.filename}`;

        const query = `
      INSERT INTO public.driver_documents
      (
        driver_id,
        ${column},
        verification_status,
        rejection_reason,
        updated_at
      )
      VALUES
      ($1, $2, 'PENDING', NULL, CURRENT_TIMESTAMP)

      ON CONFLICT (driver_id)
      DO UPDATE SET
        ${column} = EXCLUDED.${column},
        verification_status = 'PENDING',
        rejection_reason = NULL,
        verified_by = NULL,
        verified_at = NULL,
        updated_at = CURRENT_TIMESTAMP

      RETURNING *;
    `;

        const result = await pool.query(query, [
            driverId,
            fileUrl,
        ]);


        return res.status(200).json({
            success: true,
            message: "Document uploaded successfully",
            data: {
                driver_id: driverId,
                document_type,
                file_name: req.file.originalname,
                mime_type: req.file.mimetype,
                file_size: req.file.size,
                file_url: fileUrl,
                verification_status: "PENDING",
            },
        });

    } catch (error) {
        console.error("Upload Driver Document Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to upload document",
            error: error.message,
        });
    }
};

const getDriverDocumentStatus = async (req, res) => {
    try {
        const driverId = req.user.userId;

        const query = `
            SELECT
                driver_id,
                driver_photo,
                driving_license,
                address_proof,
                pan_card,
                epic_card,
                vehicle_rc,
                vehicle_fitness_certificate,
                taxi_permit,
                verification_status
            FROM public.driver_documents
            WHERE driver_id = $1
        `;

        const result = await pool.query(query, [driverId]);
        // Driver has never uploaded any document
        if (result.rows.length === 0) {

            return res.status(200).json({
                success: true,
                documentsUploaded: false,
                allDocumentsUploaded: false,
                message: "Please upload your documents.",
                data: {
                    driver_id: driverId,
                    uploaded: [],
                    missing: [
                        "DRIVER_PHOTO",
                        "DRIVING_LICENSE",
                        "ADDRESS_PROOF",
                        "PAN_CARD",
                        "EPIC_CARD",
                        "VEHICLE_RC",
                        "VEHICLE_FITNESS_CERTIFICATE",
                        "TAXI_PERMIT"
                    ]
                }
            });
        }

        const documents = result.rows[0];

        const documentMap = {
            DRIVER_PHOTO: documents.driver_photo,
            DRIVING_LICENSE: documents.driving_license,
            ADDRESS_PROOF: documents.address_proof,
            PAN_CARD: documents.pan_card,
            EPIC_CARD: documents.epic_card,
            VEHICLE_RC: documents.vehicle_rc,
            VEHICLE_FITNESS_CERTIFICATE:
                documents.vehicle_fitness_certificate,
            TAXI_PERMIT: documents.taxi_permit
        };

        const uploaded = [];
        const missing = [];

        Object.entries(documentMap).forEach(([type, file]) => {
            if (
                file !== null &&
                file !== undefined &&
                file !== ""
            ) {
                uploaded.push(type);
            } else {
                missing.push(type);
            }
        });


        return res.status(200).json({
            success: true,

            // At least one document is uploaded
            documentsUploaded: uploaded.length > 0,

            // Every required document is uploaded
            allDocumentsUploaded: missing.length === 0,

            message:
                missing.length === 0
                    ? "All documents uploaded."
                    : "Please upload the remaining documents.",

            data: {
                driver_id: driverId,
                uploaded,
                missing,
                verification_status:
                    documents.verification_status
            }
        });

    } catch (error) {
        console.error(
            "❌ Get Driver Document Status Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to check document status"
        });
    }
};

const upsertVehicleDetails = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const {
            vehicle_type,
            vehicle_brand,
            vehicle_model,
            vehicle_number,
            vehicle_color,
            seating_capacity,
            manufacturing_year,
        } = req.body;

        if (!vehicle_number || !vehicle_type) {
            return res.status(400).json({
                success: false,
                message: "vehicle_number and vehicle_type are required",
            });
        }

        const normalizedNumber = vehicle_number.replace(/\s+/g, "").toUpperCase();

        const query = `
      INSERT INTO public.vehicles
        (driver_id, vehicle_type, vehicle_brand, vehicle_model, vehicle_number,
         vehicle_color, seating_capacity, manufacturing_year,
         is_verified, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false, CURRENT_TIMESTAMP)
      ON CONFLICT (driver_id)
      DO UPDATE SET
        vehicle_type       = EXCLUDED.vehicle_type,
        vehicle_brand      = EXCLUDED.vehicle_brand,
        vehicle_model      = EXCLUDED.vehicle_model,
        vehicle_number     = EXCLUDED.vehicle_number,
        vehicle_color      = EXCLUDED.vehicle_color,
        seating_capacity   = EXCLUDED.seating_capacity,
        manufacturing_year = EXCLUDED.manufacturing_year,
        is_verified        = false
      RETURNING *;
    `;

        const values = [
            driverId,
            vehicle_type,
            vehicle_brand || null,
            vehicle_model || null,
            normalizedNumber,
            vehicle_color || null,
            seating_capacity ? parseInt(seating_capacity, 10) : null,
            manufacturing_year ? parseInt(manufacturing_year, 10) : null,
        ];

        const result = await pool.query(query, values);

        return res.status(200).json({
            success: true,
            message: "Vehicle details saved successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Upsert Vehicle Error:", error);

        if (error.code === "23505" && error.constraint?.includes("vehicle_number")) {
            return res.status(409).json({
                success: false,
                message: "This vehicle number is already registered",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to save vehicle details",
            error: error.message,
        });
    }
};

const getVehicleDetails = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const result = await pool.query(
            `SELECT * FROM public.vehicles WHERE driver_id = $1`,
            [driverId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "No vehicle details found",
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Get Vehicle Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch vehicle details",
        });
    }
};

const upsertBankDetails = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const {
            account_holder_name,
            bank_name,
            account_number,
            ifsc_code,
            branch_name,
            upi_id,
        } = req.body;

        const cleanAccount = String(account_number).trim();
        const cleanIfsc = ifsc_code.trim().toUpperCase();
        const cleanUpi = upi_id && upi_id.trim() ? upi_id.trim() : null;
        const cleanBranch =
            branch_name && branch_name.trim() ? branch_name.trim() : null;

        // 1. Duplicate account number across other drivers
        const dupAccount = await pool.query(
            `SELECT driver_id FROM public.driver_bank_details
       WHERE account_number = $1 AND driver_id <> $2
       LIMIT 1`,
            [cleanAccount, driverId]
        );
        if (dupAccount.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This account number is already linked to another driver",
                field: "account_number",
            });
        }

        // 2. Duplicate UPI across other drivers (if provided)
        if (cleanUpi) {
            const dupUpi = await pool.query(
                `SELECT driver_id FROM public.driver_bank_details
         WHERE upi_id = $1 AND driver_id <> $2
         LIMIT 1`,
                [cleanUpi, driverId]
            );
            if (dupUpi.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "This UPI ID is already linked to another driver",
                    field: "upi_id",
                });
            }
        }

        // 3. Upsert
        const query = `
      INSERT INTO public.driver_bank_details
        (driver_id, account_holder_name, bank_name, account_number,
         ifsc_code, branch_name, upi_id, verification_status,
         created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (driver_id)
      DO UPDATE SET
        account_holder_name = EXCLUDED.account_holder_name,
        bank_name           = EXCLUDED.bank_name,
        account_number      = EXCLUDED.account_number,
        ifsc_code           = EXCLUDED.ifsc_code,
        branch_name         = EXCLUDED.branch_name,
        upi_id              = EXCLUDED.upi_id,
        verification_status = 'PENDING',
        rejection_reason    = NULL,
        verified_by         = NULL,
        verified_at         = NULL,
        updated_at          = CURRENT_TIMESTAMP
      RETURNING *;
    `;

        const values = [
            driverId,
            account_holder_name.trim(),
            bank_name.trim(),
            cleanAccount,
            cleanIfsc,
            cleanBranch,
            cleanUpi,
        ];

        const result = await pool.query(query, values);

        return res.status(200).json({
            success: true,
            message: "Bank details saved successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Upsert Bank Details Error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Bank details already exist for this driver",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to save bank details",
            error: error.message,
        });
    }
};

const getBankDetails = async (req, res) => {
    try {
        const driverId = req.user.userId;
        const result = await pool.query(
            `SELECT * FROM public.driver_bank_details WHERE driver_id = $1`,
            [driverId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "No bank details found",
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Get Bank Details Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch bank details",
        });
    }
};

const toggleOnline = async (req, res) => {
    try {
        const driver_id = req.user.userId;
        const { is_online } = req.body;

        if (typeof is_online !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_online must be a boolean",
            });
        }

        const result = await pool.query(
            `UPDATE public.drivers
       SET is_online = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, is_online`,
            [is_online, driver_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: is_online ? "You are now online" : "You are now offline",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Toggle Online Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getDriverStatus = async (req, res) => {
    try {
        const driver_id = req.user.userId;

        const result = await pool.query(
            `SELECT id, full_name, is_online, is_available, is_blocked,
              rating, total_rides, current_latitude, current_longitude
       FROM public.drivers
       WHERE id = $1`,
            [driver_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Get Driver Status Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /driver/current_ride
const getCurrentRide = async (req, res) => {
    try {
        const driver_id = req.user.userId;

        const result = await pool.query(
            `CALL public.get_current_ride_for_driver($1, NULL)`,
            [driver_id]
        );

        if (!result.rows || result.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Unable to fetch ride" });
        }

        const response = result.rows[0].p_response;

        if (!response.success) {
            return res.status(400).json({ success: false, message: response.message });
        }

        return res.status(200).json({
            success: true,
            data: response.data,
            message: response.message,
        });
    } catch (error) {
        console.error("Get Current Ride Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /driver/arrived_at_pickup
const markArrived = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { ride_id } = req.body;
        const driver_id = req.user.userId;

        const result = await pool.query(
            `CALL public.arrived_at_pickup($1, $2, NULL)`,
            [ride_id, driver_id]
        );

        if (!result.rows || result.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Unable to mark arrived" });
        }

        const response = result.rows[0].p_response;

        if (!response.success) {
            return res.status(400).json({ success: false, message: response.message });
        }

        // ✅ Notify customer
        emitDriverArrived(response.data.user_id, {
            ride_id: response.data.ride_id,
            driver_id: response.data.driver_id,
            ride_status: "ARRIVED",
            arrived_at: response.data.arrived_at,
        });

        return res.status(200).json({
            success: true,
            message: response.message,
            data: response.data,
        });
    } catch (error) {
        console.error("Mark Arrived Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// const payForRide = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const { id } = req.params;
//     const { payment_method } = req.body;  // optional: "CASH" | "WALLET" | "UPI" | "CARD"

//     // 1. Fetch ride + verify ownership + must be COMPLETED
//     const rideRes = await pool.query(
//       `SELECT id, ride_status, payment_status, payment_method, final_amount
//        FROM public.rides
//        WHERE id = $1 AND user_id = $2
//        LIMIT 1`,
//       [id, userId]
//     );

//     if (rideRes.rows.length === 0) {
//       return res.status(404).json({ success: false, message: "Ride not found" });
//     }

//     const ride = rideRes.rows[0];

//     if (ride.ride_status !== "COMPLETED") {
//       return res.status(400).json({
//         success: false,
//         message: "Ride is not completed yet",
//       });
//     }

//     if (ride.payment_status === "PAID" || ride.payment_status === "COMPLETED") {
//       return res.status(400).json({
//         success: false,
//         message: "This ride has already been paid for",
//       });
//     }

//     // 2. Mark as paid
//     const updateRes = await pool.query(
//       `UPDATE public.rides
//        SET
//          payment_status = 'PAID',
//          payment_method = COALESCE($1, payment_method),
//          updated_at = CURRENT_TIMESTAMP
//        WHERE id = $2 AND user_id = $3
//        RETURNING id, ride_status, payment_status, payment_method, final_amount`,
//       [payment_method || null, id, userId]
//     );

//     // 3. Notify driver (optional but nice)
//     const driverRes = await pool.query(
//       `SELECT driver_id FROM public.rides WHERE id = $1`,
//       [id]
//     );

//     if (driverRes.rows[0]?.driver_id) {
//       try {
//         const { emitRidePaid } = require("../../sockets/RideSocket/ride.socket.js");
//         emitRidePaid(driverRes.rows[0].driver_id, {
//           ride_id: Number(id),
//           payment_status: "PAID",
//           final_amount: ride.final_amount,
//         });
//       } catch (emitErr) {
//         console.log("Emit ride_paid error:", emitErr.message);
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Payment successful",
//       data: updateRes.rows[0],
//     });
//   } catch (error) {
//     console.error("Pay Ride Error:", error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

const markRidePaid = async (req, res) => {
    try {
        const driver_id = req.user.userId;
        const { id } = req.params;
        const { payment_method } = req.body; // optional

        // 1. Verify ride belongs to this driver + is COMPLETED
        const rideRes = await pool.query(
            `SELECT id, user_id, driver_id, ride_status, payment_status, final_amount, payment_method
       FROM public.rides
       WHERE id = $1 AND driver_id = $2
       LIMIT 1`,
            [id, driver_id]
        );

        if (rideRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Ride not found or not assigned to you",
            });
        }

        const ride = rideRes.rows[0];

        if (ride.ride_status !== "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Ride is not completed yet",
            });
        }

        if (ride.payment_status === "PAID") {
            return res.status(400).json({
                success: false,
                message: "This ride is already marked as paid",
            });
        }

        // 2. Mark paid
        const updateRes = await pool.query(
            `UPDATE public.rides
       SET
         payment_status = 'PAID',
         payment_method = COALESCE($1, payment_method),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, ride_status, payment_status, payment_method, final_amount`,
            [payment_method || null, id]
        );

        // 3. Notify customer via socket
        try {
            const { emitRidePaid } = require("../../sockets/RideSocket/ride.socket.js");

            // emit to customer (userId)
            emitRidePaid(ride.user_id, {
                ride_id: Number(id),
                payment_status: "PAID",
                final_amount: ride.final_amount,
            }, "USER");
        } catch (emitErr) {
            console.log("Emit ride_paid error:", emitErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "Payment marked as received",
            data: updateRes.rows[0],
        });
    } catch (error) {
        console.error("Mark Ride Paid Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const reportPaymentIssue = async (req, res) => {
    try {
        const driver_id = req.user.userId;
        const { id } = req.params;
        const { reason, note } = req.body;

        const validReasons = [
            "CUSTOMER_DIDNT_PAY",
            "CUSTOMER_PAID_LESS",
            "CUSTOMER_LEFT_WITHOUT_PAYING",
            "PAYMENT_APP_ISSUE",
            "OTHER",
        ];

        if (!reason || !validReasons.includes(reason)) {
            return res.status(400).json({
                success: false,
                message: "Valid reason is required",
            });
        }

        // Verify ride belongs to driver + completed
        const rideRes = await pool.query(
            `SELECT id, user_id, driver_id, ride_status, payment_status, final_amount
       FROM public.rides
       WHERE id = $1 AND driver_id = $2
       LIMIT 1`,
            [id, driver_id]
        );

        if (rideRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Ride not found or not assigned to you",
            });
        }

        const ride = rideRes.rows[0];

        if (ride.ride_status !== "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Ride is not completed",
            });
        }

        if (ride.payment_status === "PAID") {
            return res.status(400).json({
                success: false,
                message: "Ride is already paid",
            });
        }

        // Update payment status to FAILED with reason
        const updateRes = await pool.query(
            `UPDATE public.rides
       SET
         payment_status = 'FAILED',
         payment_failure_reason = $1,
         payment_failure_note = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, ride_status, payment_status, final_amount`,
            [reason, note || null, id]
        );

        // Optional: notify admin via a notification row or socket
        // Optional: emit to customer (rare) — skip for now

        return res.status(200).json({
            success: true,
            message: "Payment issue reported",
            data: updateRes.rows[0],
        });
    } catch (error) {
        console.error("Report Payment Issue Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getDriverRides = async (req, res) => {
    try {
        const driver_id = req.user.userId;

        const result = await pool.query(
            `CALL public.get_driver_rides($1, NULL)`,
            [driver_id]
        );

        if (!result.rows || result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Unable to fetch rides",
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
            data: response,
        });
    } catch (error) {
        console.error("Get Driver Rides Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getDriverWallet = async (req, res) => {
    try {
        const driver_id = req.user.userId;

        const result = await pool.query(
            `CALL public.get_driver_wallet($1, NULL)`,
            [driver_id]
        );

        if (!result.rows || result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Unable to fetch wallet",
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
        console.error("Get Driver Wallet Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getDriverNotifications = async (req, res) => {
    try {
        const driver_id = req.user.userId;

        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        const unreadOnly = req.query.unreadOnly === "true";

        const whereClause = unreadOnly
            ? "WHERE driver_id = $1 AND is_read = false"
            : "WHERE driver_id = $1";

        const result = await pool.query(
            `SELECT id, title, message, type, is_read, created_at
       FROM public.driver_notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
            [driver_id, limit, offset]
        );

        const unreadRes = await pool.query(
            `SELECT COUNT(*)::int AS count
       FROM public.driver_notifications
       WHERE driver_id = $1 AND is_read = false`,
            [driver_id]
        );

        return res.status(200).json({
            success: true,
            data: {
                notifications: result.rows,
                unreadCount: unreadRes.rows[0].count,
            },
        });
    } catch (error) {
        console.error("Get Driver Notifications Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch notifications",
        });
    }
};

// ============================================================
// POST /driver/notifications/:id/read
// ============================================================
const markDriverNotificationRead = async (req, res) => {
    try {
        const driver_id = req.user.userId;
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE public.driver_notifications
       SET is_read = true
       WHERE id = $1 AND driver_id = $2
       RETURNING id, is_read`,
            [id, driver_id]
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
        console.error("Mark Driver Notif Read Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to mark as read",
        });
    }
};

// ============================================================
// POST /driver/notifications/read_all
// ============================================================
const markAllDriverNotificationsRead = async (req, res) => {
    try {
        const driver_id = req.user.userId;

        const result = await pool.query(
            `UPDATE public.driver_notifications
       SET is_read = true
       WHERE driver_id = $1 AND is_read = false`,
            [driver_id]
        );

        return res.status(200).json({
            success: true,
            message: "All marked as read",
            data: { updated: result.rowCount },
        });
    } catch (error) {
        console.error("Mark All Driver Notif Read Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to mark all as read",
        });
    }
};

// ============================================================
// Internal helper — create a driver notification
// Call from other controllers when something happens
// ============================================================
const createDriverNotification = async (client, driverId, { title, message, type }) => {
    try {
        const result = await client.query(
            `INSERT INTO public.driver_notifications
         (driver_id, title, message, type, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)
       RETURNING *`,
            [driverId, title, message, type]
        );
        return result.rows[0];
    } catch (error) {
        console.error("Create Driver Notification Error:", error);
        return null;
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
    getDriverEarnings,
    verifyDriverOTP,
    uploadDriverDocument,
    getDriverDocumentStatus,
    upsertVehicleDetails,
    getVehicleDetails,
    getBankDetails,
    upsertBankDetails,
    toggleOnline,
    getDriverStatus,
    getCurrentRide,
    markArrived,
    // payForRide
    markRidePaid,
    reportPaymentIssue,
    getDriverRides,
    getDriverWallet,
    getDriverNotifications,
  markDriverNotificationRead,
  markAllDriverNotificationsRead,
  createDriverNotification,
};