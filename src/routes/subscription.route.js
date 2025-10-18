const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const { subscribeToPlan } = require("../controllers/subscription.controller");

const router = express.Router();

// USER: subscribe to a plan
router.post("/subscribe", protect, subscribeToPlan);

module.exports = router;
