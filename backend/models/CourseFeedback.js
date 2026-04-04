const mongoose = require("mongoose");

const courseFeedbackSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    reaction: {
      type: String,
      enum: ["like", "dislike", null],
      default: null,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
  },
  { timestamps: true }
);

courseFeedbackSchema.index({ organizationId: 1, courseId: 1 });
courseFeedbackSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.models.CourseFeedback || mongoose.model("CourseFeedback", courseFeedbackSchema);
