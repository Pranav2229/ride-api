const { getIO } = require("../index");
const {
    onlineDrivers,
    onlineUsers
} = require("../socketStore");

const emitRideToDrivers = (
    drivers,
    rideData
) => {

    const io = getIO();

    drivers.forEach(driver => {

        const socketId =
            onlineDrivers.get(
                Number(driver.driver_id)
            );

        if (socketId) {

            io.to(socketId).emit(
                "new_ride",
                rideData
            );
        }
    });
};

const emitRideAccepted = (
    userId,
    data
) => {

    const io = getIO();

    const socketId =
        onlineUsers.get(
            Number(userId)
        );

    if (socketId) {

        io.to(socketId).emit(
            "ride_accepted",
            data
        );
    }
};

const emitRideStarted = (
    userId,
    data
) => {

    const io = getIO();

    const socketId =
        onlineUsers.get(
            Number(userId)
        );

    if (socketId) {

        io.to(socketId).emit(
            "ride_started",
            data
        );
    }
};

const emitDriverLocation = (
    userId,
    data
) => {

    const io = getIO();

    const socketId =
        onlineUsers.get(
            Number(userId)
        );

    if (socketId) {

        io.to(socketId).emit(
            "driver_location",
            data
        );
    }
};

const emitRideCompleted = (
    userId,
    data
) => {

    const io = getIO();

    const socketId =
        onlineUsers.get(
            Number(userId)
        );

    if (socketId) {

        io.to(socketId).emit(
            "ride_completed",
            data
        );
    }
};

const emitRideCancelled = (userIdOrDriverId, data, recipientType) => {
  const io = getIO();
  const socketId =
    recipientType === "DRIVER"
      ? onlineDrivers.get(Number(userIdOrDriverId))
      : onlineUsers.get(Number(userIdOrDriverId));

  if (socketId) {
    io.to(socketId).emit("ride_cancelled", data);
  }
};


module.exports = {
    emitRideToDrivers,
    emitRideAccepted,
    emitRideStarted,
    emitDriverLocation,
    emitRideCompleted,
    emitRideCancelled
};

// const { getIO } = require("../index");

// const emitRideToDrivers =
// (
//     drivers,
//     rideData
// ) => {

//     const io = getIO();

//     drivers.forEach(
//         (driver) => {
//             if (
//                 driver.driver_id
//             ) {

//                 io.to(
//                     driver.driver_id
//                 ).emit(
//                     "new_ride",
//                     rideData
//                 );
//             }
//         }
//     );
// };

// module.exports = {
//     emitRideToDrivers
// };