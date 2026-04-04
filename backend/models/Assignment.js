const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileUrl: {
      type: String,
      default: null,
      trim: true,
    },
    fileName: {
      type: String,
      default: null,
      trim: true,
    },
    textAnswer: {
      type: String,
      default: null,
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    grade: {
      type: Number,
      default: null,
      min: 0,
    },
    feedback: {
      type: String,
      default: null,
      trim: true,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["submitted", "graded", "returned"],
      default: "submitted",
    },
  },
  { _id: true }
);

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Assignment title is required."],
      trim: true,
      maxlength: [200, "Assignment title cannot exceed 200 characters."],
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    maxMarks: {
      type: Number,
      default: 100,
      min: [1, "Maximum marks must be at least 1."],
    },
    attachmentUrl: {
      type: String,
      default: null,
      trim: true,
    },
    attachmentName: {
      type: String,
      default: null,
      trim: true,
    },
    allowTextAnswer: {
      type: Boolean,
      default: true,
    },
    allowFileUpload: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    submissions: [submissionSchema],
  },
  { timestamps: true }
);

assignmentSchema.index({ organizationId: 1, createdAt: -1 });
assignmentSchema.index({ organizationId: 1, courseId: 1, createdAt: -1 });

module.exports = mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);
