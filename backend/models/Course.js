const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    duration: {
      type: String,
      trim: true,
      default: null, // e.g. "3 months", "40 hours"
    },
    fee: {
      type: Number,
      default: 0,
      min: [0, "Fee cannot be negative"],
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trainer",
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: null,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: null,
    },
    videoUrl: {
      type: String,
      trim: true,
      default: null,
    },
    pdfUrl: {
      type: String,
      trim: true,
      default: null,
    },
    meetingLink: {
      type: String,
      trim: true,
      default: null,
    },
    meetingScheduledAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    maxEnrolments: {
      type: Number,
      default: null,
    },
    modules: [
      {
        title: {
          type: String,
          trim: true,
          default: null,
        },
        lessons: [
          {
            title: {
              type: String,
              trim: true,
              default: null,
            },
            videoUrl: {
              type: String,
              trim: true,
              default: null,
            },
            pdfUrl: {
              type: String,
              trim: true,
              default: null,
            },
            quizTitle: {
              type: String,
              trim: true,
              default: null,
            },
            assignmentTitle: {
              type: String,
              trim: true,
              default: null,
            },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

courseSchema.index({ organizationId: 1 });

module.exports = mongoose.models.Course || mongoose.model("Course", courseSchema);
