const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { register, login, getMe, changePassword } = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  message: { success: false, message: "Too many registration attempts. Please try again later." },
});

const loginAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: "Too many failed login attempts. Please try again later." },
});

router.post("/register", registerLimiter, register);
router.post("/login", loginAttemptLimiter, login);
router.get("/me", authMiddleware, getMe);
router.put("/change-password", authMiddleware, changePassword);

module.exports = router;
