const express = require("express");
const router = express.Router();
const {
  createOrder,
  captureOrder,
} = require("../controllers/paypal.controller");
const { protect } = require("../middlewares/auth.middleware");

// POST /api/paypal/create-order
router.post("/create-order", protect, createOrder);

router.post("/capture-order", protect, captureOrder);

module.exports = router;
