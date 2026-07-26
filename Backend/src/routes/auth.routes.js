const express = require("express");
const {
  login,
  logout,
  refresh,
  register,
  verifySignup,
  resendSignupOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleLogin,
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", register);
router.post("/verify-signup", verifySignup);
router.post("/resend-signup-otp", resendSignupOtp);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
router.post("/refresh", refresh);
router.post("/logout", logout);

module.exports = router;
