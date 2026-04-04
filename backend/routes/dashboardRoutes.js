const express = require("express");
const router = express.Router();
const { getAdminDashboard, getStudentDashboard, getTrainerDashboard, getFinanceDashboard } = require("../controllers/dashboardController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/admin", roleMiddleware("admin"), getAdminDashboard);
router.get("/student", roleMiddleware("student"), getStudentDashboard);
router.get("/trainer", roleMiddleware("trainer"), getTrainerDashboard);
router.get("/finance", roleMiddleware("finance"), getFinanceDashboard);

module.exports = router;