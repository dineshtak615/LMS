const express = require("express");
const router = express.Router();
const { getMyOrganization, updateMyOrganization, getOrganizationUsers, createOrganizationUser, toggleUserStatus } = require("../controllers/organizationController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/me", roleMiddleware("admin"), getMyOrganization);
router.put("/me", roleMiddleware("admin"), updateMyOrganization);
router.get("/users", roleMiddleware("admin"), getOrganizationUsers);
router.post("/users", roleMiddleware("admin"), createOrganizationUser);
router.patch("/users/:id/toggle", roleMiddleware("admin"), toggleUserStatus);

module.exports = router;