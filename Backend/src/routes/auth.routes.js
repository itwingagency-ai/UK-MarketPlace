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
const { loginLimiter, otpLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.post("/register", otpLimiter, register);
router.post("/verify-signup", otpLimiter, verifySignup);
router.post("/resend-signup-otp", otpLimiter, resendSignupOtp);
router.post("/login", loginLimiter, login);
router.post("/google", googleLogin);
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/verify-reset-otp", otpLimiter, verifyResetOtp);
router.post("/reset-password", otpLimiter, resetPassword);
router.post("/refresh", refresh);
router.post("/logout", logout);

module.exports = router;
