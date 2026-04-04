const express = require("express");

const {
  createAssignment,
  getAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
} = require("../controllers/assignmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { uploadAttachment, uploadSingleFile } = require("../middlewares/upload");

const router = express.Router();

router.use(authMiddleware);

router.get("/", roleMiddleware("admin", "trainer", "student"), getAssignments);
router.get("/:id", roleMiddleware("admin", "trainer", "student"), getAssignment);

router.post("/", roleMiddleware("admin", "trainer"), uploadAttachment, createAssignment);
router.put("/:id", roleMiddleware("admin", "trainer"), uploadAttachment, updateAssignment);
router.delete("/:id", roleMiddleware("admin"), deleteAssignment);

router.post("/:id/submit", roleMiddleware("student"), uploadSingleFile, submitAssignment);
router.put("/:id/submissions/:submissionId/grade", roleMiddleware("admin", "trainer"), gradeSubmission);

module.exports = router;
