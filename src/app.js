const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rfs = require("rotating-file-stream");
const morgan = require("morgan");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const compression = require("compression");
const cookieParser = require('cookie-parser')
const fs = require("fs");
const path = require("path");
const pool = require("./middleware/db.connection")
require("dotenv").config();
// const errorHandler = require("./middleware/ErrorHandler.js");
// const sqlInjectionProtection = require("./middleware/sqlInjectionProtection.js");
const app = express();

// Middlewares
app.use(cors({
    origin: "", // Allow multiple domains
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization"
}));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://trusted-scripts.com"],
            styleSrc: ["'self'", "https://trusted-styles.com"],
            imgSrc: ["'self'", "data:", "https://trusted-images.com"],
        }
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));
app.use(express.json()); // Body parsing
app.use(compression()); // Response compression
app.use(morgan("dev")); // Logging
app.use(express.urlencoded({ extended: true }))
app.use('/public', express.static(path.join(__dirname, 'public'), {
    dotfiles: 'deny', // Prevents access to hidden files
    extensions: ['html', 'css', 'js'], // Restrict file types
}));
app.use(cookieParser(process.env.COOKIE_SECRET, {
    httpOnly: true, // Prevents client-side JS access
    secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
    sameSite: "strict", // Prevents CSRF attacks
}));

//Sql Injuction 
// app.use(sqlInjectionProtection);


// Rate Limiting (Prevent DDoS Attacks)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyGenerator: (req) => ipKeyGenerator(req),
});
app.use(limiter);

// Cache-Control
app.use((req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=3600, immutable"); // Cache for 1 hour
    next();
});

const logFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";

const accessLogStream = rfs.createStream("access.log", {
    interval: "1d", // Rotate daily
    path: path.join(__dirname, "logs")
});

app.use(morgan(logFormat, { stream: accessLogStream }));

const Userrouter = require('./routes/UserRoutes/User.routes.js')
const Driverrouter = require('./routes/DriverRoutes/Driver.routes.js')
const Commonrouter = require('./routes/UserDriverRoutes/User_Driver.routes.js')
// User Routes
app.use(`${process.env.BASE_NAVIGATE}user`, Userrouter)


// Driver Routes
app.use(`${process.env.BASE_NAVIGATE}driver`, Driverrouter)

// Common Routes
app.use(`${process.env.BASE_NAVIGATE}user_driver`, Commonrouter)


app.get('/', (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Ride API is running smoothly! 🚀"
    });
});

// 404 Route Handler
app.use((req, res, next) => {
    res.status(404).json({ status: "error", message: "Route not found" });
});

// Global Error Handler (Always at the end)
// app.use(errorHandler);
module.exports = { app }; // Export only the app
