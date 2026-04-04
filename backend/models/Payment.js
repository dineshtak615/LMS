const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    method: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "upi", "cheque", "other", "razorpay"],
      default: "cash",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "completed",
    },
    transactionId: {
      type: String,
      trim: true,
      default: null,
    },
    gateway: {
      type: String,
      enum: ["razorpay", null],
      default: null,
    },
    gatewayOrderId: {
      type: String,
      trim: true,
      default: null,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
      default: null,
    },
    gatewaySignature: {
      type: String,
      trim: true,
      default: null,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    receiptNumber: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ organizationId: 1 });
paymentSchema.index({ studentId: 1 });

module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
