const express = require("express");
const router = express.Router();
const {
  getOverview,
  getRevenueAnalytics,
  getCourseAnalytics,
  getStudentPerformanceAnalytics,
  getTrainerPerformanceAnalytics,
  exportAnalyticsCsv,
} = require("../controllers/analyticsController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/overview", roleMiddleware("admin", "finance"), getOverview);
router.get("/revenue", roleMiddleware("admin", "finance"), getRevenueAnalytics);
router.get("/courses", roleMiddleware("admin"), getCourseAnalytics);
router.get("/students-performance", roleMiddleware("admin"), getStudentPerformanceAnalytics);
router.get("/trainers-performance", roleMiddleware("admin"), getTrainerPerformanceAnalytics);
router.get("/export/csv", roleMiddleware("admin", "finance"), exportAnalyticsCsv);

module.exports = router;
