const express = require("express");
const router = express.Router();
const {
  createOrder,
  captureOrder,
  stripeWebhook,
} = require("../controllers/paypal.controller");
const { protect } = require("../middlewares/auth.middleware");

// POST /api/paypal/create-order
router.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);
router.post("/create-order", protect, createOrder);

router.post("/capture-order", protect, captureOrder);

module.exports = router;
