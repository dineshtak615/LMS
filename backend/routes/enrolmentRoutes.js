const express = require("express");
const router = express.Router();
const {
  getEnrolments,
  createEnrolment,
  updateEnrolment,
  deleteEnrolment,
  exportEnrolmentsCsv,
  sendEnrolmentReminder,
} = require("../controllers/enrolmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/export/csv", roleMiddleware("admin", "trainer"), exportEnrolmentsCsv);
router.get("/", roleMiddleware("admin", "trainer", "finance", "student"), getEnrolments);
router.post("/", roleMiddleware("admin", "trainer", "student"), createEnrolment);
router.put("/:id", roleMiddleware("admin", "trainer"), updateEnrolment);
router.post("/:id/reminder", roleMiddleware("admin", "trainer"), sendEnrolmentReminder);
router.delete("/:id", roleMiddleware("admin"), deleteEnrolment);

module.exports = router;
