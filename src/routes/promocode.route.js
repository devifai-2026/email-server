const express = require("express");
const router = express.Router();
const promoController = require("../controllers/promocode.controller");
const { protect, adminOnly } = require("../middlewares/auth.middleware");

router.post("/", protect, adminOnly, promoController.createPromoCode);
router.get("/", promoController.getAllPromoCodes);
router.get("/:id", promoController.getPromoCode);
router.put("/:id", protect, adminOnly, promoController.updatePromoCode);
router.delete("/:id", promoController.deletePromoCode);

// Validation route (checkout)
router.post("/validate", promoController.validatePromoCode);

module.exports = router;
