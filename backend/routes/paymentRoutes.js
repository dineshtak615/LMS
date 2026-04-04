const express = require("express");
const router = express.Router();
const {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  createRazorpayOrder,
  verifyRazorpayPaymentAndEnroll,
} = require("../controllers/paymentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.post("/razorpay/order", roleMiddleware("student"), createRazorpayOrder);
router.post("/razorpay/verify-and-enroll", roleMiddleware("student"), verifyRazorpayPaymentAndEnroll);

router.get("/", roleMiddleware("admin", "finance"), getPayments);
router.get("/:id", roleMiddleware("admin", "finance"), getPaymentById);
router.post("/", roleMiddleware("admin", "finance"), createPayment);
router.put("/:id", roleMiddleware("admin", "finance"), updatePayment);
router.delete("/:id", roleMiddleware("admin"), deletePayment);

module.exports = router;
