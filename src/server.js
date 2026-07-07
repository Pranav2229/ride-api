// // require("dotenv").config();

// const {app} = require('./app')

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on ${PORT}`);
// });

// second comment 

// const http = require("http");
// const { app } = require("./app");

// const server = http.createServer(app);

// const {initSocket} = require("./sockets/index.js");
// const { log } = require("console");
// initSocket(server);



// server.listen(
//     process.env.PORT || 5000,
//     () => {
//         console.log(
//             "Server Running"
//         );
//     }
// );

const http = require("http");
const { app } = require("./app");

const server =
    http.createServer(app);

const {
    initSocket
} = require("./sockets");

initSocket(server);

server.listen(
    5000,
    "0.0.0.0",
    () => {
        console.log(
            "🚀 Server Running on 5000"
        );
    }
);