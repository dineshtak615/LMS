const express = require("express");
const router = express.Router();
const {
  getCourses,
  getPublicPopularCourses,
  getCourseById,
  getCourseVideoEngagement,
  createCourse,
  upsertCourseVideoFeedback,
  createCourseVideoComment,
  updateCourseVideoComment,
  deleteCourseVideoComment,
  updateCourse,
  deleteCourse,
} = require("../controllers/courseController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { uploadCourseFiles } = require("../middlewares/upload");

router.get("/public/popular", getPublicPopularCourses);

router.use(authMiddleware);

router.get("/", roleMiddleware("admin", "trainer", "student", "finance"), getCourses);
router.get("/:id/video-engagement", roleMiddleware("admin", "trainer", "student", "finance"), getCourseVideoEngagement);
router.put("/:id/video-feedback", roleMiddleware("student"), upsertCourseVideoFeedback);
router.post("/:id/video-comments", roleMiddleware("student"), createCourseVideoComment);
router.put("/:id/video-comments/:commentId", roleMiddleware("student"), updateCourseVideoComment);
router.delete("/:id/video-comments/:commentId", roleMiddleware("student"), deleteCourseVideoComment);
router.get("/:id", roleMiddleware("admin", "trainer", "student", "finance"), getCourseById);
router.post("/", roleMiddleware("admin", "trainer"), uploadCourseFiles, createCourse);
router.put("/:id", roleMiddleware("admin", "trainer"), uploadCourseFiles, updateCourse);
router.delete("/:id", roleMiddleware("admin", "trainer"), deleteCourse);

module.exports = router;
