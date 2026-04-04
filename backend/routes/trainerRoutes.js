const express = require("express");
const router = express.Router();
const { getTrainers, getTrainerById, createTrainer, updateTrainer, deleteTrainer } = require("../controllers/trainerController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/", roleMiddleware("admin", "finance"), getTrainers);
router.get("/:id", roleMiddleware("admin"), getTrainerById);
router.post("/", roleMiddleware("admin"), createTrainer);
router.put("/:id", roleMiddleware("admin"), updateTrainer);
router.delete("/:id", roleMiddleware("admin"), deleteTrainer);

module.exports = router;