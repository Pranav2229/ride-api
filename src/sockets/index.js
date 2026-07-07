const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

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

    // Socket Authentication Middleware
    // io.use((socket, next) => {

    //     try {

    //         const token =
    //             socket.handshake.auth.token;

    //         if (!token) {
    //             return next(
    //                 new Error("No token provided")
    //             );
    //         }

    //         const decoded = jwt.verify(
    //             token,
    //             process.env.JWT_SECRET
    //         );

    //         socket.user = decoded;

    //         next();

    //     } catch (error) {

    //         next(
    //             new Error("Invalid token")
    //         );
    //     }
    // });

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
        socket.on(
            "driver_online",
            (driverId) => {

                onlineDrivers.set(
                    Number(driverId),
                    socket.id
                );

                console.log(
                    "🚗 Driver Online:",
                    driverId
                );
            }
        );

        // USER ONLINE
        socket.on(
            "user_online",
            (userId) => {

                onlineUsers.set(
                    Number(userId),
                    socket.id
                );

                console.log(
                    "🙋 User Online:",
                    userId
                );
            }
        );

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
