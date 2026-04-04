const mongoose = require("mongoose");

const libraryItemSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    author: {
      type: String,
      trim: true,
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: null,
    },
    type: {
      type: String,
      enum: ["book", "journal", "video", "document", "other"],
      default: "book",
    },
    isbn: {
      type: String,
      trim: true,
      default: null,
    },
    fileUrl: {
      type: String,
      trim: true,
      default: null,
    },
    fileMimeType: {
      type: String,
      trim: true,
      default: null,
    },
    fileOriginalName: {
      type: String,
      trim: true,
      default: null,
    },
    totalCopies: {
      type: Number,
      default: 1,
      min: [0, "Total copies cannot be negative"],
    },
    availableCopies: {
      type: Number,
      default: 1,
      min: [0, "Available copies cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

libraryItemSchema.index({ organizationId: 1 });

module.exports = mongoose.models.LibraryItem || mongoose.model("LibraryItem", libraryItemSchema);
