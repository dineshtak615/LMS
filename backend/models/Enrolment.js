const mongoose = require("mongoose");

const enrolmentSchema = new mongoose.Schema(
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
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "dropped", "suspended"],
      default: "active",
    },
    enrolmentDate: {
      type: Date,
      default: Date.now,
    },
    completionDate: {
      type: Date,
      default: null,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    quizScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    attendanceMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate enrolment
enrolmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrolmentSchema.index({ organizationId: 1 });

module.exports = mongoose.models.Enrolment || mongoose.model("Enrolment", enrolmentSchema);
