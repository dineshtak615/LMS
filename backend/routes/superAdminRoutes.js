const express = require("express");
const router = express.Router();
const {
  getSuperAdminDashboard,
  getAllOrganizations,
  getOrganizationById,
  toggleOrganizationStatus,
  updateOrganizationPlan,
  getAllUsers,
  getActivityLogs,
} = require("../controllers/superAdminController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware, roleMiddleware("super_admin"));

router.get("/dashboard", getSuperAdminDashboard);
router.get("/organizations", getAllOrganizations);
router.get("/organizations/:id", getOrganizationById);
router.patch("/organizations/:id/toggle", toggleOrganizationStatus);
router.put("/organizations/:id/plan", updateOrganizationPlan);
router.get("/users", getAllUsers);
router.get("/activity-logs", getActivityLogs);

module.exports = router;