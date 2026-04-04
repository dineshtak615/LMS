const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Assignment = require("../models/Assignment");
const Course = require("../models/Course");
const Enrolment = require("../models/Enrolment");
const Student = require("../models/Student");
const Trainer = require("../models/Trainer");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ""));

const toBoolean = (value, defaultValue = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return defaultValue;
};

const normalizeUploadPath = (file) => (file ? `/${String(file.path || "").replace(/\\/g, "/")}` : null);

const deleteLocalFile = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`[ASSIGNMENT] Failed to delete file ${filePath}: ${error.message}`);
  }
};

const deleteAssetByUrl = (assetUrl) => {
  if (!assetUrl) return;

  const relativePath = String(assetUrl).replace(/^\//, "");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");

  // Only allow deleting files under uploads directory.
  if (!absolutePath.startsWith(uploadsRoot)) return;

  deleteLocalFile(absolutePath);
};

const parseDueDate = (value) => {
  if (value === undefined) return { hasValue: false, value: null };
  if (value === null || value === "") return { hasValue: true, value: null };

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error("Invalid dueDate."), { statusCode: 400 });
  }

  return { hasValue: true, value: parsed };
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

const getTrainerProfileForUser = async ({ organizationId, user, autoCreate = false }) => {
  if (!organizationId || !user?._id) return null;

  const userEmail = String(user?.email || "").trim().toLowerCase();
  const userName = String(user?.name || "").trim() || "Trainer";
  const fallbackEmail = isValidEmail(userEmail) ? userEmail : `trainer+${String(user._id)}@autogen.local`;

  const matchConditions = [{ userId: user._id }];
  if (isValidEmail(userEmail)) matchConditions.push({ email: userEmail });

  let trainer = await Trainer.findOne({
    organizationId,
    $or: matchConditions,
  }).select("_id assignedCourses userId name email");

  if (!trainer && autoCreate && user?.role === "trainer" && userName) {
    trainer = await Trainer.findOne({
      organizationId,
      userId: null,
      name: { $regex: `^${escapeRegex(userName)}$`, $options: "i" },
    }).select("_id assignedCourses userId name email");
  }

  if (!trainer && autoCreate && user?.role === "trainer" && fallbackEmail) {
    try {
      trainer = await Trainer.create({
        organizationId,
        userId: user._id,
        name: userName,
        email: fallbackEmail,
        isActive: true,
      });
    } catch (error) {
      if (error?.code === 11000) {
        trainer = await Trainer.findOne({ organizationId, email: fallbackEmail }).select(
          "_id assignedCourses userId name email"
        );
      } else {
        throw error;
      }
    }
  }

  if (trainer && (!trainer.userId || String(trainer.userId) !== String(user._id))) {
    trainer.userId = user._id;
    await trainer.save({ validateBeforeSave: false });
  }

  return trainer || null;
};

const getManagedCourseIdsForTrainer = async ({ organizationId, trainer }) => {
  if (!trainer?._id) return [];

  const assignedIds = Array.isArray(trainer.assignedCourses)
    ? trainer.assignedCourses.map((courseId) => String(courseId))
    : [];

  const ownedCourses = await Course.find({
    organizationId,
    trainerId: trainer._id,
  })
    .select("_id")
    .lean();

  const merged = new Set([...assignedIds, ...ownedCourses.map((course) => String(course._id))]);
  return Array.from(merged);
};

const getAllowedCourseIdsByRole = async (req) => {
  if (req.user.role === "admin") return null;

  if (req.user.role === "trainer") {
    const trainer = await getTrainerProfileForUser({
      organizationId: req.user.organizationId,
      user: req.user,
      autoCreate: true,
    });

    if (!trainer) return [];
    return getManagedCourseIdsForTrainer({
      organizationId: req.user.organizationId,
      trainer,
    });
  }

  if (req.user.role === "student") {
    const student = await getStudentProfileForUser({
      organizationId: req.user.organizationId,
      user: req.user,
      autoCreate: true,
    });
    if (!student?._id) return [];

    const enrolments = await Enrolment.find({
      organizationId: req.user.organizationId,
      studentId: student._id,
      status: { $in: ["active", "completed"] },
    })
      .select("courseId")
      .lean();

    return Array.from(new Set(enrolments.map((item) => String(item.courseId))));
  }

  return [];
};

const canAccessCourse = (allowedCourseIds, courseId) => {
  if (allowedCourseIds === null) return true;
  return allowedCourseIds.includes(String(courseId));
};

const parsePagination = (pageValue, limitValue) => {
  const page = Math.max(1, Number(pageValue) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitValue) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

// Create assignment (admin, trainer)
const createAssignment = async (req, res, next) => {
  try {
    const {
      title,
      description,
      courseId,
      dueDate,
      maxMarks,
      allowTextAnswer,
      allowFileUpload,
    } = req.body;

    if (!title || !courseId) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: "title and courseId are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(String(courseId))) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: "Invalid courseId." });
    }

    const allowedCourseIds = await getAllowedCourseIdsByRole(req);
    if (!canAccessCourse(allowedCourseIds, courseId)) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(403).json({ success: false, message: "You can create assignments only for allowed courses." });
    }

    const course = await Course.findOne({
      _id: courseId,
      organizationId: req.user.organizationId,
      isActive: true,
    }).select("_id title");

    if (!course) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const dueDateParsed = parseDueDate(dueDate);
    const parsedMaxMarks = Number(maxMarks);
    const resolvedMaxMarks = Number.isFinite(parsedMaxMarks) && parsedMaxMarks > 0 ? parsedMaxMarks : 100;
    const resolvedAllowTextAnswer = toBoolean(allowTextAnswer, true);
    const resolvedAllowFileUpload = toBoolean(allowFileUpload, true);

    if (!resolvedAllowTextAnswer && !resolvedAllowFileUpload) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "At least one submission method (text or file) must be enabled.",
      });
    }

    const assignment = await Assignment.create({
      title: String(title).trim(),
      description: description === undefined ? null : String(description || "").trim() || null,
      courseId: course._id,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
      dueDate: dueDateParsed.hasValue ? dueDateParsed.value : null,
      maxMarks: resolvedMaxMarks,
      allowTextAnswer: resolvedAllowTextAnswer,
      allowFileUpload: resolvedAllowFileUpload,
      attachmentUrl: normalizeUploadPath(req.file),
      attachmentName: req.file?.originalname || null,
    });

    await assignment.populate("courseId", "title trainerId");
    await assignment.populate("createdBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Assignment created successfully.",
      data: { assignment },
    });
  } catch (error) {
    if (req.file) deleteLocalFile(req.file.path);
    return next(error);
  }
};

// List assignments (admin, trainer, student)
const getAssignments = async (req, res, next) => {
  try {
    const { courseId, page = 1, limit = 20, search = "" } = req.query;
    const { page: pageNum, limit: limitNum, skip } = parsePagination(page, limit);

    const filter = {
      organizationId: req.user.organizationId,
      isActive: true,
    };

    const allowedCourseIds = await getAllowedCourseIdsByRole(req);
    if (allowedCourseIds !== null) {
      if (allowedCourseIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            assignments: [],
            pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
          },
        });
      }
      filter.courseId = { $in: allowedCourseIds };
    }

    if (courseId) {
      if (!mongoose.Types.ObjectId.isValid(String(courseId))) {
        return res.status(400).json({ success: false, message: "Invalid courseId." });
      }
      if (!canAccessCourse(allowedCourseIds, courseId)) {
        return res.status(403).json({ success: false, message: "You can access assignments only for allowed courses." });
      }
      filter.courseId = courseId;
    }

    const normalizedSearch = String(search || "").trim();
    if (normalizedSearch) {
      const searchRegex = new RegExp(escapeRegex(normalizedSearch), "i");
      filter.$or = [{ title: { $regex: searchRegex } }, { description: { $regex: searchRegex } }];
    }

    const [assignments, total] = await Promise.all([
      Assignment.find(filter)
        .populate("courseId", "title trainerId")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Assignment.countDocuments(filter),
    ]);

    const mapped = assignments.map((assignment) => {
      const asObject = assignment.toObject();
      const mySubmission =
        req.user.role === "student"
          ? assignment.submissions.find((item) => String(item.studentId) === String(req.user._id))
          : null;

      return {
        ...asObject,
        submissionCount: assignment.submissions.length,
        ...(req.user.role === "student"
          ? {
              mySubmission: mySubmission
                ? {
                    status: mySubmission.status,
                    grade: mySubmission.grade,
                    submittedAt: mySubmission.submittedAt,
                  }
                : null,
            }
          : {}),
        submissions: undefined,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        assignments: mapped,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get single assignment
const getAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ success: false, message: "Invalid assignment id." });
    }

    const filter = {
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    };

    const allowedCourseIds = await getAllowedCourseIdsByRole(req);
    if (allowedCourseIds !== null) {
      if (allowedCourseIds.length === 0) {
        return res.status(404).json({ success: false, message: "Assignment not found." });
      }
      filter.courseId = { $in: allowedCourseIds };
    }

    const assignment = await Assignment.findOne(filter)
      .populate("courseId", "title trainerId")
      .populate("createdBy", "name email")
      .populate("submissions.studentId", "name email")
      .populate("submissions.gradedBy", "name email");

    if (!assignment) {
      return res.status(404).json({ success: false, message: "Assignment not found." });
    }

    if (req.user.role === "student") {
      const mySubmission = assignment.submissions.find(
        (item) => String(item.studentId?._id || item.studentId) === String(req.user._id)
      );

      return res.status(200).json({
        success: true,
        data: {
          assignment: {
            ...assignment.toObject(),
            submissions: mySubmission ? [mySubmission] : [],
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { assignment },
    });
  } catch (error) {
    return next(error);
  }
};

// Update assignment (admin, trainer)
const updateAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: "Invalid assignment id." });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!assignment) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(404).json({ success: false, message: "Assignment not found." });
    }

    const allowedCourseIds = await getAllowedCourseIdsByRole(req);
    if (!canAccessCourse(allowedCourseIds, assignment.courseId)) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(403).json({ success: false, message: "You can update only allowed assignments." });
    }

    const {
      title,
      description,
      dueDate,
      maxMarks,
      allowTextAnswer,
      allowFileUpload,
      isActive,
    } = req.body;

    if (title !== undefined) {
      const nextTitle = String(title || "").trim();
      if (!nextTitle) {
        if (req.file) deleteLocalFile(req.file.path);
        return res.status(400).json({ success: false, message: "title cannot be empty." });
      }
      assignment.title = nextTitle;
    }

    if (description !== undefined) {
      assignment.description = String(description || "").trim() || null;
    }

    if (dueDate !== undefined) {
      const parsed = parseDueDate(dueDate);
      assignment.dueDate = parsed.value;
    }

    if (maxMarks !== undefined) {
      const parsedMaxMarks = Number(maxMarks);
      if (!Number.isFinite(parsedMaxMarks) || parsedMaxMarks <= 0) {
        if (req.file) deleteLocalFile(req.file.path);
        return res.status(400).json({ success: false, message: "maxMarks must be a positive number." });
      }
      assignment.maxMarks = parsedMaxMarks;
    }

    if (allowTextAnswer !== undefined) {
      assignment.allowTextAnswer = toBoolean(allowTextAnswer, assignment.allowTextAnswer);
    }

    if (allowFileUpload !== undefined) {
      assignment.allowFileUpload = toBoolean(allowFileUpload, assignment.allowFileUpload);
    }

    if (!assignment.allowTextAnswer && !assignment.allowFileUpload) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "At least one submission method (text or file) must remain enabled.",
      });
    }

    if (isActive !== undefined) {
      assignment.isActive = toBoolean(isActive, assignment.isActive);
    }

    if (req.file) {
      deleteAssetByUrl(assignment.attachmentUrl);
      assignment.attachmentUrl = normalizeUploadPath(req.file);
      assignment.attachmentName = req.file.originalname || null;
    }

    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Assignment updated successfully.",
      data: { assignment },
    });
  } catch (error) {
    if (req.file) deleteLocalFile(req.file.path);
    return next(error);
  }
};

// Soft delete assignment (admin)
const deleteAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ success: false, message: "Invalid assignment id." });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: "Assignment not found." });
    }

    assignment.isActive = false;
    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Assignment deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

// Submit assignment (student)
const submitAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: "Invalid assignment id." });
    }

    const allowedCourseIds = await getAllowedCourseIdsByRole(req);
    if (allowedCourseIds !== null && allowedCourseIds.length === 0) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(404).json({ success: false, message: "Assignment not found." });
    }

    const filter = {
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    };

    if (allowedCourseIds !== null) {
      filter.courseId = { $in: allowedCourseIds };
    }

    const assignment = await Assignment.findOne(filter);
    if (!assignment) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(404).json({ success: false, message: "Assignment not found." });
    }

    if (assignment.dueDate && new Date() > assignment.dueDate) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: "Submission deadline has passed." });
    }

    const textAnswer = String(req.body?.textAnswer || "").trim() || null;
    if (!assignment.allowTextAnswer && textAnswer) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: "Text answers are not allowed for this assignment." });
    }

    if (!assignment.allowFileUpload && req.file) {
      if (req.file) deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: "File uploads are not allowed for this assignment." });
    }

    if (!textAnswer && !req.file) {
      return res.status(400).json({
        success: false,
        message: "Please provide a text answer or file upload.",
      });
    }

    if (!assignment.allowTextAnswer && !req.file) {
      return res.status(400).json({ success: false, message: "This assignment requires file upload." });
    }

    if (!assignment.allowFileUpload && !textAnswer) {
      return res.status(400).json({ success: false, message: "This assignment requires text answer." });
    }

    const existingIndex = assignment.submissions.findIndex(
      (item) => String(item.studentId) === String(req.user._id)
    );

    const submissionData = {
      studentId: req.user._id,
      textAnswer,
      submittedAt: new Date(),
      status: "submitted",
      grade: null,
      feedback: null,
      gradedAt: null,
      gradedBy: null,
    };

    if (req.file) {
      submissionData.fileUrl = normalizeUploadPath(req.file);
      submissionData.fileName = req.file.originalname || null;
    }

    if (existingIndex !== -1) {
      const existing = assignment.submissions[existingIndex];

      if (req.file && existing.fileUrl) {
        deleteAssetByUrl(existing.fileUrl);
      }

      if (!req.file) {
        submissionData.fileUrl = existing.fileUrl || null;
        submissionData.fileName = existing.fileName || null;
      }

      Object.assign(existing, submissionData);
    } else {
      assignment.submissions.push(submissionData);
    }

    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Assignment submitted successfully.",
    });
  } catch (error) {
    if (req.file) deleteLocalFile(req.file.path);
    return next(error);
  }
};

// Grade submission (admin, trainer)
const gradeSubmission = async (req, res, next) => {
  try {
    const { id, submissionId } = req.params;
    const { grade, feedback } = req.body;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: "Invalid assignment id." });
    }

    if (!mongoose.Types.ObjectId.isValid(String(submissionId))) {
      return res.status(400).json({ success: false, message: "Invalid submission id." });
    }

    const allowedCourseIds = await getAllowedCourseIdsByRole(req);
    const filter = {
      _id: id,
      organizationId: req.user.organizationId,
      isActive: true,
    };

    if (allowedCourseIds !== null) {
      if (allowedCourseIds.length === 0) {
        return res.status(404).json({ success: false, message: "Assignment not found." });
      }
      filter.courseId = { $in: allowedCourseIds };
    }

    const assignment = await Assignment.findOne(filter);
    if (!assignment) {
      return res.status(404).json({ success: false, message: "Assignment not found." });
    }

    const submission = assignment.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found." });
    }

    const parsedGrade = Number(grade);
    if (!Number.isFinite(parsedGrade)) {
      return res.status(400).json({ success: false, message: "grade must be a number." });
    }
    if (parsedGrade < 0 || parsedGrade > assignment.maxMarks) {
      return res.status(400).json({
        success: false,
        message: `grade must be between 0 and ${assignment.maxMarks}.`,
      });
    }

    submission.grade = parsedGrade;
    submission.feedback = feedback === undefined ? null : String(feedback || "").trim() || null;
    submission.gradedAt = new Date();
    submission.gradedBy = req.user._id;
    submission.status = "graded";

    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Submission graded successfully.",
      data: { submission },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createAssignment,
  getAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
};
