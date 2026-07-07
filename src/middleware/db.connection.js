const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Check DB Connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error("❌ Database connection failed:", err.message);
  }

  console.log("✅ PostgreSQL Database connected successfully");

  release(); // release client back to pool
});

module.exports = pool;