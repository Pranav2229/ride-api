
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