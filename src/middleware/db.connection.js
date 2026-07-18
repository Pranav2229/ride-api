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


// const { Pool } = require("pg");
// require("dotenv").config();

// console.log("DB_HOST:", process.env.DB_HOST);
// console.log("DB_PORT:", process.env.DB_PORT);
// console.log("DB_USER:", process.env.DB_USER);

// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   database: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

// pool.connect()
//   .then(client => {
//     console.log("✅ PostgreSQL connected");
//     client.release();
//   })
//   .catch(err => {
//     console.error("❌ Database connection failed:");
//     console.error(err);
//   });

// module.exports = pool;








// const { Pool } = require("pg");
// require("dotenv").config();

// const pool = new Pool({
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   database: process.env.DB_NAME,
// });

// // Check DB Connection
// pool.connect((err, client, release) => {
//   if (err) {
//     return console.error("❌ Database connection failed:", err.message);
//   }

//   console.log("✅ PostgreSQL Database connected successfully");

//   release(); // release client back to pool
// });

// module.exports = pool;