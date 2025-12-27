const app = require("./src/app");
const { connectMongoDB, connectPostgres } = require("./src/config/db");
require("dotenv").config();

// Connect to databases
(async () => {
  try {
    await connectMongoDB();       // Connect MongoDB

    // Initialize PostgreSQL pool and get the instance
    const pgPool = connectPostgres();  
    console.log("Databases initialized successfully");

    // Log total email count from PostgreSQL
    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
})();
