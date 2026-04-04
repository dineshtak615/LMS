const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads folders if they don't exist
const createDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };
createDir("uploads/videos");
createDir("uploads/pdfs");
createDir("uploads/library");
createDir("uploads/thumbnails");
createDir("uploads/assignments");
createDir("uploads/submissions");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "video") cb(null, "uploads/videos");
    else if (file.fieldname === "pdf") cb(null, "uploads/pdfs");
    else if (file.fieldname === "bookFile") cb(null, "uploads/library");
    else if (file.fieldname === "thumbnail") cb(null, "uploads/thumbnails");
    else if (file.fieldname === "attachment") cb(null, "uploads/assignments");
    else if (file.fieldname === "file") cb(null, "uploads/submissions");
    else cb(new Error("Invalid field"), null);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    const allowed = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only video files are allowed (MP4, MOV, AVI, WebM)"), false);
  } else if (file.fieldname === "pdf") {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  } else if (file.fieldname === "bookFile") {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF books are allowed"), false);
  } else if (file.fieldname === "thumbnail") {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, or WEBP images are allowed for thumbnail"), false);
  } else if (file.fieldname === "attachment" || file.fieldname === "file") {
    cb(null, true);
  } else {
    cb(new Error("Unexpected field"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max for videos
  },
});

// Middleware to handle video + pdf upload together
const uploadCourseFiles = upload.fields([
  { name: "video", maxCount: 1 },
  { name: "pdf",   maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

const uploadLibraryBook = upload.single("bookFile");
const uploadSingleFile = upload.single("file");
const uploadAttachment = upload.single("attachment");

module.exports = { uploadCourseFiles, uploadLibraryBook, uploadSingleFile, uploadAttachment };
