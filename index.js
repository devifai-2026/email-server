const app = require("./src/app");
const { connectMongoDB, connectPostgres, getPgPool } = require("./src/config/db");
require("dotenv").config();

// Connect to databases
(async () => {
  try {
    await connectMongoDB();       // Connect MongoDB

    // Initialize PostgreSQL pool and get the instance
    const pgPool = connectPostgres();  
    
    // Test the connection
    const testResult = await pgPool.query('SELECT NOW()');
    console.log("PostgreSQL connected successfully at:", testResult.rows[0].now);
    
    // Log total email count from PostgreSQL (optional)
    try {
      const countResult = await pgPool.query('SELECT COUNT(*) as total FROM email_accounts');
      console.log(`Total email accounts in PostgreSQL: ${countResult.rows[0].total}`);
    } catch (countErr) {
      console.log("Note: Could not count email_accounts table - it might not exist yet");
    }
    
    console.log("Databases initialized successfully");

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
})();