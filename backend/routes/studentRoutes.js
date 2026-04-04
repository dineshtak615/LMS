const express = require("express");
const router = express.Router();
const { getStudents, getStudentById, createStudent, updateStudent, deleteStudent } = require("../controllers/studentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/", roleMiddleware("admin", "trainer", "finance"), getStudents);
router.get("/:id", roleMiddleware("admin", "trainer", "finance"), getStudentById);
router.post("/", roleMiddleware("admin"), createStudent);
router.put("/:id", roleMiddleware("admin"), updateStudent);
router.delete("/:id", roleMiddleware("admin"), deleteStudent);

module.exports = router;