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

    pgPool.on("connect", (client) => {
      console.log("PostgreSQL connected - New client acquired");
    });
    
    pgPool.on("error", (err) => {
      console.error("PostgreSQL pool error:", err);
    });
    
    // Test connection immediately
    pgPool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error("PostgreSQL connection test failed:", err.message);
      } else {
        console.log("PostgreSQL connected successfully");
        console.log("Connection test:", res.rows[0]);
      }
    });
  }
  return pgPool;
};

// Get the pool instance (use this in your controllers)
const getPgPool = () => {
  if (!pgPool) {
    throw new Error("PostgreSQL pool not initialized. Call connectPostgres() first.");
  }
  return pgPool;
};

module.exports = {
  connectMongoDB,
  connectPostgres,
  getPgPool,  // Use this instead of directly exporting pgPool
  pgPool,     // Keep for backward compatibility, but use getPgPool()
};