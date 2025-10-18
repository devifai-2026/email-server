const express = require("express");
const router = express.Router();
const exportController = require("../controllers/export.controller");

// GET /emailFinder/api/export/emailaccounts?search=&page=&limit=
router.get("/emailaccounts", exportController.exportEmailAccounts);

module.exports = router;
