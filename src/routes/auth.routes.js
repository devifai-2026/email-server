const express = require("express");
const passport = require("passport");
const {
  signupRequest,
  verifySignup,
  signin,
  createAdminAccount,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/auth.controlller");
const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/requestotp", signupRequest);
router.post("/verifysignup", verifySignup);
router.post("/signin", signin);
router.post("/createadminaccount", createAdminAccount);

router.post("/logout", protect, logout);

router.post("/forgotpassword", forgotPassword);
router.post("/resetpassword", resetPassword);

module.exports = router;
