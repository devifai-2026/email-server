const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middlewares/auth.middleware");
const {
  getEmailAccounts,
  getEmailAccount,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,

  bulkDeleteEmailAccounts,
  getMaskedAccounts,
  deleteDuplicateEmailAccounts,
  deleteAllEmailAccounts,
} = require("../controllers/emailaccount.controller");

router.get("/maskedEmailAccounts", getMaskedAccounts);

router.get("/", protect, getEmailAccounts);
router.get("/:id", protect, getEmailAccount);
router.post("/", protect, adminOnly, createEmailAccount);
router.put("/:id", protect, adminOnly, updateEmailAccount);
router.delete("/:id", protect, adminOnly, deleteEmailAccount);
router.post("/bulk-delete", protect, adminOnly, bulkDeleteEmailAccounts);
router.post("/prevent-duplicate", deleteDuplicateEmailAccounts);
router.post("/delete-all", deleteAllEmailAccounts);

module.exports = router;
