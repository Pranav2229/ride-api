const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(client => {
    console.log("✅ PostgreSQL Database connected successfully");
    client.release();
  })
  .catch(err => {
    console.error("❌ Database connection failed:", err);
  });

module.exports = pool;


// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   database: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
// });

// pool.connect()
//   .then(client => {
//     console.log("✅ PostgreSQL Database connected successfully");
//     client.release();
//   })
//   .catch(err => {
//     console.error("❌ Database connection failed:");
//     console.error(err);
//   });

// module.exports = pool;

