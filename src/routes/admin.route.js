const express = require("express");
const router = express.Router();
const {
  getTransactions,
  getToken,
  createOrUpdateToken,
  createCard,
  getAllCards,
  getCardById,
  updateCard,
  deleteCard,
  getDashboardStats,
} = require("../controllers/admin.controller");
const { protect, adminOnly } = require("../middlewares/auth.middleware");
router.get("/transactions", protect, adminOnly, getTransactions);
router.get("/apitoken", protect, adminOnly, getToken);
router.post("/apitoken", protect, adminOnly, createOrUpdateToken);

router.post("/card", protect, adminOnly, createCard);
router.get("/card", getAllCards);
router.get("/card/:id", protect, adminOnly, getCardById);
router.put("/card/:id", protect, adminOnly, updateCard);
router.delete("/card/:id", protect, adminOnly, deleteCard);

router.get("/dashboard", protect, adminOnly, getDashboardStats);

module.exports = router;
