const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const pool = require("../middleware/db.connection.js");

const {
    onlineDrivers,
    onlineUsers
} = require("./socketStore");

let io;

const initSocket = (server) => {

    io = new Server(server, {
        cors: {
            origin: "*",
            credentials: true
        }
    });

    io.use((socket, next) => {
        try {

            const token = socket.handshake.auth.token;
            const decoded = jwt.verify(
                token,
                process.env.JWT_ACCESS_SECRET
            );
            socket.user = decoded;

            next();

        } catch (error) {

            console.log("JWT Error:", error.message);

            next(
                new Error("Invalid token")
            );
        }
    });

    io.on("connection", (socket) => {

        console.log(
            "✅ Connected:",
            socket.id
        );

        console.log(
            "Authenticated User:",
            socket.user
        );

        // DRIVER ONLINE
        // socket.on(
        //     "driver_online",
        //     (driverId) => {

        //         onlineDrivers.set(
        //             Number(driverId),
        //             socket.id
        //         );

        //         console.log(
        //             "🚗 Driver Online:",
        //             driverId
        //         );
        //     }
        // );
        socket.on("driver_online", (driverId) => {
            const id = Number(driverId);
            onlineDrivers.set(id, socket.id);
            socket.join(`driver:${id}`);                    // ← ADD THIS LINE
            console.log(`🚗 Driver Online: ${id} → room driver:${id}`);
        });


        socket.on("driver_offline", (driverId) => {
            onlineDrivers.delete(Number(driverId));
            console.log("🚗 Driver Offline:", driverId);
        });

        // USER ONLINE
        // socket.on(
        //     "user_online",
        //     (userId) => {

        //         onlineUsers.set(
        //             Number(userId),
        //             socket.id
        //         );

        //         console.log(
        //             "🙋 User Online:",
        //             userId
        //         );
        //     }
        // );
        socket.on("user_online", (userId) => {
            const id = Number(userId);
            onlineUsers.set(id, socket.id);
            socket.join(`user:${id}`);                      // ← ADD THIS LINE
            console.log(`🙋 User Online: ${id} → room user:${id}`);
        });

        socket.on(
            "disconnect",
            () => {

                for (
                    const [id, socketId]
                    of onlineDrivers.entries()
                ) {

                    if (
                        socketId === socket.id
                    ) {
                        onlineDrivers.delete(id);
                    }
                }

                for (
                    const [id, socketId]
                    of onlineUsers.entries()
                ) {

                    if (
                        socketId === socket.id
                    ) {
                        onlineUsers.delete(id);
                    }
                }

                console.log(
                    "❌ Disconnected:",
                    socket.id
                );
            }
        );

        // ============================================================
        // CHAT — join ride room, send messages, leave
        // ============================================================
        socket.on("chat_join", async ({ rideId }) => {
            try {
                const callerId = socket.user?.userId;
                const rId = Number(rideId);
                if (!callerId || !Number.isFinite(rId)) return;

                // Verify caller belongs to this ride
                const { rows } = await pool.query(
                    `SELECT id, user_id, driver_id FROM public.rides WHERE id = $1 LIMIT 1`,
                    [rId]
                );
                if (rows.length === 0) return;

                const ride = rows[0];
                if (ride.user_id !== callerId && ride.driver_id !== callerId) return;

                socket.join(`ride:${rId}`);
                console.log(`💬 socket ${socket.id} joined ride:${rId}`);
            } catch (e) {
                console.log("chat_join error:", e.message);
            }
        });

        socket.on("chat_leave", ({ rideId }) => {
            const rId = Number(rideId);
            if (Number.isFinite(rId)) {
                socket.leave(`ride:${rId}`);
                console.log(`💬 socket ${socket.id} left ride:${rId}`);
            }
        });

        //     socket.on("chat_send", async ({ rideId, message, tempId }) => {
        //         try {
        //             const callerId = socket.user?.userId;
        //             const rId = Number(rideId);
        //             if (!callerId || !Number.isFinite(rId)) return;

        //             const text = String(message || "").trim();
        //             if (!text || text.length > 1000) return;

        //             // Load ride + determine role + verify chat not locked
        //             const { rows } = await pool.query(
        //                 `SELECT id, user_id, driver_id, ride_status FROM public.rides WHERE id = $1 LIMIT 1`,
        //                 [rId]
        //             );
        //             if (rows.length === 0) return;

        //             const ride = rows[0];
        //             let role = null;
        //             if (ride.user_id === callerId) role = "USER";
        //             else if (ride.driver_id === callerId) role = "DRIVER";
        //             if (!role) return;

        //             if (ride.ride_status === "COMPLETED" || ride.ride_status === "CANCELLED") {
        //                 socket.emit("chat_error", { rideId: rId, message: "Chat locked for this ride" });
        //                 return;
        //             }

        //             const inserted = await pool.query(
        //                 `INSERT INTO public.ride_messages (ride_id, sender_type, sender_id, message)
        //    VALUES ($1, $2, $3, $4)
        //    RETURNING id, sender_type, sender_id, message, created_at`,
        //                 [rId, role, callerId, text]
        //             );

        //             const msg = {
        //                 id: String(inserted.rows[0].id),
        //                 sender_type: inserted.rows[0].sender_type,
        //                 sender_id: inserted.rows[0].sender_id,       // ← ADD THIS
        //                 message: inserted.rows[0].message,
        //                 created_at: inserted.rows[0].created_at,
        //                 tempId: tempId || null,
        //             };

        //             io.to(`ride:${rId}`).emit("chat_message", { rideId: rId, ...msg });
        //         } catch (e) {
        //             console.log("chat_send error:", e.message);
        //             socket.emit("chat_error", { message: "Failed to send message" });
        //         }
        //     });
        socket.on("chat_send", async ({ rideId, message, tempId }) => {
            try {
                const callerId = socket.user?.userId;
                const rId = Number(rideId);
                if (!callerId || !Number.isFinite(rId)) return;

                const text = String(message || "").trim();
                if (!text || text.length > 1000) return;

                const { rows } = await pool.query(
                    `SELECT id, user_id, driver_id, ride_status FROM public.rides WHERE id = $1 LIMIT 1`,
                    [rId]
                );
                if (rows.length === 0) return;

                const ride = rows[0];
                let role = null;
                if (ride.user_id === callerId) role = "USER";
                else if (ride.driver_id === callerId) role = "DRIVER";
                if (!role) return;

                if (ride.ride_status === "COMPLETED" || ride.ride_status === "CANCELLED") {
                    socket.emit("chat_error", { rideId: rId, message: "Chat locked for this ride" });
                    return;
                }

                const inserted = await pool.query(
                    `INSERT INTO public.ride_messages (ride_id, sender_type, sender_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_type, sender_id, message, created_at`,
                    [rId, role, callerId, text]
                );

                const payload = {
                    rideId: rId,
                    id: String(inserted.rows[0].id),
                    sender_type: inserted.rows[0].sender_type,
                    sender_id: inserted.rows[0].sender_id,
                    message: inserted.rows[0].message,
                    created_at: inserted.rows[0].created_at,
                };

                // ✅ Broadcast to OTHER sockets (not the sender)
                io.to(`ride:${rId}`).except(socket.id).emit("chat_message", payload);

                // ✅ Echo to sender only (with tempId for optimistic replace + banner skip)
                socket.emit("chat_message", { ...payload, tempId: tempId || null });
            } catch (e) {
                console.log("chat_send error:", e.message);
                socket.emit("chat_error", { message: "Failed to send message" });
            }
        });

    });
};

const getIO = () => {

    if (!io) {
        throw new Error(
            "Socket.IO not initialized"
        );
    }

    return io;
};

module.exports = {
    initSocket,
    getIO
};

// const { Server } = require("socket.io");
// const {
//     onlineDrivers,
//     onlineUsers
// } = require("./socketStore");

// let io;

// const initSocket = (server) => {

//     io = new Server(server, {
//         cors: {
//             origin: "*",
//             credentials: true
//         }
//     });

//     io.on("connection", (socket) => {

//         console.log("Connected:", socket.id);

//         socket.on(
//             "driver_online",
//             (driverId) => {

//                 onlineDrivers.set(
//                     Number(driverId),
//                     socket.id
//                 );

//                 console.log(
//                     "Driver Online",
//                     driverId
//                 );
//             }
//         );

//         socket.on(
//             "user_online",
//             (userId) => {

//                 onlineUsers.set(
//                     Number(userId),
//                     socket.id
//                 );

//                 console.log(
//                     "User Online",
//                     userId
//                 );
//             }
//         );

//         socket.on(
//             "disconnect",
//             () => {

//                 for (const [id, socketId] of onlineDrivers.entries()) {

//                     if (socketId === socket.id) {
//                         onlineDrivers.delete(id);
//                     }
//                 }

//                 for (const [id, socketId] of onlineUsers.entries()) {

//                     if (socketId === socket.id) {
//                         onlineUsers.delete(id);
//                     }
//                 }

//                 console.log(
//                     "Disconnected:",
//                     socket.id
//                 );
//             }
//         );
//     });
// };

// const getIO = () => io;

// module.exports = {
//     initSocket,
//     getIO
// };
