const express = require("express");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const planRoutes = require("./routes/plans.routes");
const subscriptionRoutes = require("./routes/subscription.route");
const fileUploadRoutes = require("./routes/fileupload.routes");
const emailAccountRoutes = require("./routes/emailaccount.routes");
const exportRoutes = require("./routes/export.route");
const paymentRoutes = require("./routes/paypal.route");
const adminRoutes = require("./routes/admin.route");
const promoCodeRoutes = require("./routes/promocode.route");
require("./config/passport");
require("dotenv").config();

const agenda = require("./jobs/agenda");
require("../src/jobs/emailverification.job")(agenda);
require("../src/jobs/verifyandInsertEmail.job")(agenda);

const app = express();

// Middlewares
// Enable CORS for all origins
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

(async function () {
  await agenda.start();

  // Run every day at 9 AM
  await agenda.every("0 9 * * *", "notify_expiring_subscriptions");
  await agenda.every("0 9 * * *", "notify_expired_subscriptions");
})();

// Routes

app.use("/emailFinder/api/auth", authRoutes);
app.use("/emailFinder/api/users", userRoutes);
app.use("/emailFinder/api/plans", planRoutes);
app.use("/emailFinder/api/subscriptions", subscriptionRoutes);

app.use("/emailFinder/api/upload", fileUploadRoutes);
app.use("/emailFinder/api/emailaccounts", emailAccountRoutes);

app.use("/emailFinder/api/export", exportRoutes);

app.use("/emailFinder/api/payment", paymentRoutes);

app.use("/emailFinder/api/admin", adminRoutes);
app.use("/emailFinder/api/promocodes", promoCodeRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to Email Finder");
});

module.exports = app;
