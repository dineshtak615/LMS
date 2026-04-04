const express = require("express");
const router = express.Router();
const { getItems, createItem, updateItem, issueItem, returnItem, getRecords } = require("../controllers/libraryController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { uploadLibraryBook } = require("../middlewares/upload");

router.use(authMiddleware);

// Items
router.get("/items", roleMiddleware("admin", "trainer", "student"), getItems);
router.post("/items", roleMiddleware("admin"), uploadLibraryBook, createItem);
router.put("/items/:id", roleMiddleware("admin"), uploadLibraryBook, updateItem);

// Issue / Return
router.get("/records", roleMiddleware("admin", "finance", "student"), getRecords);
router.post("/issue", roleMiddleware("admin"), issueItem);
router.put("/return/:id", roleMiddleware("admin", "student"), returnItem);

module.exports = router;
