// config/db.js
const mongoose = require("mongoose");
const { Pool } = require("pg");
require("dotenv").config();

let pgPool = null;

// Connect to MongoDB
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

// Initialize PostgreSQL Pool
const connectPostgres = () => {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.PG_HOST,       // Aurora endpoint
      port: process.env.PG_PORT || 5432,
      database: process.env.PG_DATABASE,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      max: 20,                          // max connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pgPool.on("connect", () => console.log("PostgreSQL connected"));
    pgPool.on("error", (err) => console.error("PostgreSQL pool error:", err));
  }
  return pgPool;
};

module.exports = {
  connectMongoDB,
  connectPostgres,
  pgPool, // export the pool instance for query usage
};
