const mongoose = require("mongoose");

const organizationPaymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    plan: {
      type: String,
      enum: ["free", "basic", "pro", "enterprise"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
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
    billingPeriodStart: {
      type: Date,
      default: Date.now,
    },
    billingPeriodEnd: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

organizationPaymentSchema.index({ organizationId: 1 });

module.exports = mongoose.models.OrganizationPayment || mongoose.model("OrganizationPayment", organizationPaymentSchema);