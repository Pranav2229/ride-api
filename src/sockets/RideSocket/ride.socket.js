const { getIO } = require("../index");
const {
    onlineDrivers,
    onlineUsers
} = require("../socketStore");

// const emitRideToDrivers = (
//     drivers,
//     rideData
// ) => {

//     const io = getIO();

//     drivers.forEach(driver => {

//         const socketId =
//             onlineDrivers.get(
//                 Number(driver.driver_id)
//             );

//         if (socketId) {

//             io.to(socketId).emit(
//                 "new_ride",
//                 rideData
//             );
//         }
//     });
// };

const emitRideToDrivers = (drivers, rideData) => {
    const io = getIO();



    drivers.forEach(driver => {
        const socketId = onlineDrivers.get(Number(driver.driver_id));
        if (socketId) {
            io.to(socketId).emit("new_ride", rideData);
            console.log(`✅ new_ride emitted to driver ${driver.driver_id}`);
        } else {
            console.log(`❌ No socketId for driver ${driver.driver_id}`);
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

const emitDriverArrived = (userId, data) => {
    const io = getIO();
    const socketId = onlineUsers.get(Number(userId));
    if (socketId) {
        io.to(socketId).emit("driver_arrived", data);
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

const emitRidePaid = (recipientId, data, recipientType = "USER") => {
    const io = getIO();
    const socketId =
        recipientType === "DRIVER"
            ? onlineDrivers.get(Number(recipientId))
            : onlineUsers.get(Number(recipientId));

    if (socketId) {
        io.to(socketId).emit("ride_paid", data);
    }
};

/**
 * Notify BOTH the customer and the driver that a ride has been paid.
 * Used when a Razorpay payment is verified OR when the driver
 * confirms cash collection.
 */
const emitPaymentCompleted = (userId, driverId, rideId, amount, method) => {
  const io = getIO();

  const payload = {
    rideId,
    amount,
    method,
    paidAt: new Date().toISOString(),
  };

  // Customer
  const userSocket = onlineUsers.get(Number(userId));
  if (userSocket) {
    io.to(userSocket).emit("payment_completed", payload);
    console.log(`✅ payment_completed → user ${userId}`);
  }

  // Driver
  if (driverId) {
    const driverSocket = onlineDrivers.get(Number(driverId));
    if (driverSocket) {
      io.to(driverSocket).emit("payment_completed", payload);
      console.log(`✅ payment_completed → driver ${driverId}`);
    }
  }
};

module.exports = {
    emitRideToDrivers,
    emitRideAccepted,
    emitDriverArrived,
    emitRideStarted,
    emitDriverLocation,
    emitRideCompleted,
    emitRideCancelled,
    emitRidePaid,
    emitPaymentCompleted
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