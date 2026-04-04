const LibraryItem = require("../models/LibraryItem");
const LibraryRecord = require("../models/LibraryRecord");
const Student = require("../models/Student");
const { logActivity } = require("../middlewares/activityLogger");

const normalizeUploadPath = (file) => (file ? `/${file.path.replace(/\\/g, "/")}` : null);
const parseNonNegativeInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

const getStudentProfileForUser = async ({ organizationId, user, autoCreate = false }) => {
  const userEmail = String(user?.email || "").trim().toLowerCase();
  const userName = String(user?.name || "").trim() || "Student";

  let student = await Student.findOne({
    organizationId,
    $or: [{ userId: user._id }, { email: userEmail }],
  });

  if (!student && autoCreate && user?.role === "student" && userEmail) {
    try {
      student = await Student.create({
        organizationId,
        userId: user._id,
        name: userName,
        email: userEmail,
        isActive: true,
      });
    } catch (error) {
      if (error?.code === 11000) {
        student = await Student.findOne({ organizationId, email: userEmail });
      } else {
        throw error;
      }
    }
  }

  if (!student) return null;

  if (!student.userId || String(student.userId) !== String(user._id)) {
    student.userId = user._id;
    await student.save({ validateBeforeSave: false });
  }

  return student;
};

// ── Items ────────────────────────────────────
const getItems = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "", type } = req.query;
    const orgId = req.user.organizationId;

    const filter = { organizationId: orgId, isActive: true };
    if (search) filter.$or = [{ title: { $regex: search, $options: "i" } }, { author: { $regex: search, $options: "i" } }];
    if (type) filter.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      LibraryItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      LibraryItem.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: { items, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } } });
  } catch (error) { next(error); }
};

const createItem = async (req, res, next) => {
  try {
    const { title, author, category, type, isbn, totalCopies } = req.body;
    const orgId = req.user.organizationId;
    const bookFile = req.file;

    if (!title) return res.status(400).json({ success: false, message: "Title is required." });

    const copies = totalCopies === undefined || totalCopies === "" ? 1 : parseNonNegativeInteger(totalCopies);
    if (copies === null || copies < 1) {
      return res.status(400).json({ success: false, message: "totalCopies must be an integer greater than or equal to 1." });
    }

    const item = await LibraryItem.create({
      organizationId: orgId,
      title: title.trim(),
      author: author || null,
      category: category || null,
      type: type || "book",
      isbn: isbn || null,
      totalCopies: copies,
      availableCopies: copies,
      fileUrl: normalizeUploadPath(bookFile),
      fileMimeType: bookFile?.mimetype || null,
      fileOriginalName: bookFile?.originalname || null,
    });

    await logActivity({ userId: req.user._id, organizationId: orgId, action: "CREATE_LIBRARY_ITEM", module: "library", description: `Library item added: ${item.title}`, ipAddress: req.ip });
    res.status(201).json({ success: true, message: "Library item created.", data: { item } });
  } catch (error) { next(error); }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await LibraryItem.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!item) return res.status(404).json({ success: false, message: "Library item not found." });

    const fields = ["title", "author", "category", "type", "isbn", "isActive"];
    fields.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });

    if (req.body.totalCopies !== undefined) {
      const nextTotalCopies = parseNonNegativeInteger(req.body.totalCopies);
      if (nextTotalCopies === null) {
        return res.status(400).json({ success: false, message: "totalCopies must be a non-negative integer." });
      }

      const issuedCopies = Math.max(item.totalCopies - item.availableCopies, 0);
      if (nextTotalCopies < issuedCopies) {
        return res.status(400).json({
          success: false,
          message: `totalCopies cannot be less than currently issued copies (${issuedCopies}).`,
        });
      }

      item.totalCopies = nextTotalCopies;
      item.availableCopies = Math.max(nextTotalCopies - issuedCopies, 0);
    }

    if (req.file) {
      item.fileUrl = normalizeUploadPath(req.file);
      item.fileMimeType = req.file.mimetype || null;
      item.fileOriginalName = req.file.originalname || null;
    }

    await item.save();
    res.status(200).json({ success: true, message: "Library item updated.", data: { item } });
  } catch (error) { next(error); }
};

// ── Issue / Return ───────────────────────────
const issueItem = async (req, res, next) => {
  try {
    const { itemId, studentId, dueDate, notes } = req.body;
    const orgId = req.user.organizationId;

    if (!itemId || !studentId || !dueDate) {
      return res.status(400).json({ success: false, message: "itemId, studentId, and dueDate are required." });
    }

    const [item, student] = await Promise.all([
      LibraryItem.findOne({ _id: itemId, organizationId: orgId }),
      Student.findOne({ _id: studentId, organizationId: orgId }),
    ]);

    if (!item) return res.status(404).json({ success: false, message: "Library item not found." });
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    if (item.availableCopies < 1) return res.status(400).json({ success: false, message: "No copies available." });

    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ success: false, message: "dueDate must be a valid date." });
    }

    const record = await LibraryRecord.create({
      organizationId: orgId,
      itemId,
      studentId,
      dueDate: parsedDueDate,
      notes: notes || null,
    });

    item.availableCopies -= 1;
    await item.save();

    await logActivity({ userId: req.user._id, organizationId: orgId, action: "ISSUE_LIBRARY_ITEM", module: "library", description: `${item.title} issued to ${student.name}`, ipAddress: req.ip });

    const populated = await record.populate([
      { path: "itemId", select: "title author type" },
      { path: "studentId", select: "name email" },
    ]);

    res.status(201).json({ success: true, message: "Item issued successfully.", data: { record: populated } });
  } catch (error) { next(error); }
};

const returnItem = async (req, res, next) => {
  try {
    const { fine, notes } = req.body;
    const orgId = req.user.organizationId;
    const filter = { _id: req.params.id, organizationId: orgId };

    if (req.user.role === "student") {
      const studentProfile = await getStudentProfileForUser({
        organizationId: orgId,
        user: req.user,
        autoCreate: true,
      });

      if (!studentProfile?._id) {
        return res.status(404).json({ success: false, message: "Student profile not found." });
      }

      filter.studentId = studentProfile._id;
    }

    const record = await LibraryRecord.findOne(filter);
    if (!record) return res.status(404).json({ success: false, message: "Issue record not found." });
    if (record.status === "returned") return res.status(400).json({ success: false, message: "This item has already been returned." });

    record.status = "returned";
    record.returnDate = new Date();
    record.fine = req.user.role === "admin" ? fine || 0 : record.fine || 0;
    if (notes) record.notes = notes;
    await record.save();

    await LibraryItem.findByIdAndUpdate(record.itemId, { $inc: { availableCopies: 1 } });

    res.status(200).json({ success: true, message: "Item returned successfully.", data: { record } });
  } catch (error) { next(error); }
};

const getRecords = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, studentId } = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (status) filter.status = status;

    if (req.user.role === "student") {
      const studentProfile = await getStudentProfileForUser({
        organizationId: req.user.organizationId,
        user: req.user,
      });

      if (!studentProfile) {
        return res.status(200).json({
          success: true,
          data: { records: [], pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 } },
        });
      }

      filter.studentId = studentProfile._id;
      if (!status) {
        filter.status = { $in: ["issued", "overdue"] };
      }
    } else if (studentId) {
      filter.studentId = studentId;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      LibraryRecord.find(filter)
        .populate("itemId", "title author type fileUrl fileOriginalName")
        .populate("studentId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      LibraryRecord.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: { records, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } } });
  } catch (error) { next(error); }
};

module.exports = { getItems, createItem, updateItem, issueItem, returnItem, getRecords };
