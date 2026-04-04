const Enrolment = require("../models/Enrolment");
const Student = require("../models/Student");
const Course = require("../models/Course");
const Trainer = require("../models/Trainer");
const Payment = require("../models/Payment");
const { logActivity } = require("../middlewares/activityLogger");

const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ""));
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  if (isValidEmail(userEmail)) {
    matchConditions.push({ email: userEmail });
  }

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
        trainer = await Trainer.findOne({ organizationId, email: fallbackEmail }).select("_id assignedCourses userId name email");
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

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
};

const formatDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeAttendanceMinutes = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw Object.assign(new Error("attendanceMinutes must be a non-negative number."), { statusCode: 400 });
  }
  return Math.round(parsed * 10) / 10;
};

const syncManualEnrolmentPayment = async ({
  organizationId,
  studentId,
  course,
  actorRole,
  actorId,
  ipAddress,
}) => {
  const courseFee = Number(course?.fee || 0);
  const shouldSync = ["admin", "trainer"].includes(String(actorRole || "").toLowerCase());

  if (!shouldSync || !course?._id || courseFee <= 0) {
    return null;
  }

  const existingPayment = await Payment.findOne({
    organizationId,
    studentId,
    courseId: course._id,
  }).sort({ createdAt: -1 });

  if (existingPayment) {
    let changed = false;

    if (existingPayment.status !== "completed") {
      existingPayment.status = "completed";
      changed = true;
    }
    if (!(Number(existingPayment.amount) > 0)) {
      existingPayment.amount = courseFee;
      changed = true;
    }
    if (!existingPayment.method) {
      existingPayment.method = "cash";
      changed = true;
    }
    if (!existingPayment.paymentDate) {
      existingPayment.paymentDate = new Date();
      changed = true;
    }
    if (!existingPayment.notes) {
      existingPayment.notes = "Auto-updated when admin/trainer created enrollment.";
      changed = true;
    }

    if (changed) {
      await existingPayment.save();
      await logActivity({
        userId: actorId,
        organizationId,
        action: "UPDATE_PAYMENT",
        module: "payment",
        description: `Payment updated for enrollment (${String(existingPayment._id)})`,
        ipAddress,
      });
      return { mode: "updated", paymentId: String(existingPayment._id) };
    }

    return { mode: "unchanged", paymentId: String(existingPayment._id) };
  }

  const createdPayment = await Payment.create({
    organizationId,
    studentId,
    courseId: course._id,
    amount: courseFee,
    method: "cash",
    status: "completed",
    paymentDate: new Date(),
    notes: "Auto-recorded when admin/trainer created enrollment.",
  });

  await logActivity({
    userId: actorId,
    organizationId,
    action: "CREATE_PAYMENT",
    module: "payment",
    description: `Payment auto-recorded for enrollment (${String(createdPayment._id)})`,
    ipAddress,
  });

  return { mode: "created", paymentId: String(createdPayment._id) };
};

const getEnrolments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, studentId, courseId, status, search = "" } = req.query;
    const orgId = req.user.organizationId;

    const filter = { organizationId: orgId };
    if (req.user.role === "student") {
      const studentProfile = await getStudentProfileForUser({
        organizationId: orgId,
        user: req.user,
      });

      if (!studentProfile) {
        return res.status(200).json({
          success: true,
          data: { enrolments: [], pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 } },
        });
      }

      filter.studentId = studentProfile._id;
      if (courseId) filter.courseId = courseId;
    } else if (req.user.role === "trainer") {
      const trainerProfile = await getTrainerProfileForUser({
        organizationId: orgId,
        user: req.user,
        autoCreate: true,
      });

      if (!trainerProfile) {
        return res.status(200).json({
          success: true,
          data: { enrolments: [], pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 } },
        });
      }

      const managedCourseIds = await getManagedCourseIdsForTrainer({
        organizationId: orgId,
        trainer: trainerProfile,
      });

      if (managedCourseIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: { enrolments: [], pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 } },
        });
      }

      if (courseId) {
        if (!managedCourseIds.includes(String(courseId))) {
          return res.status(403).json({
            success: false,
            message: "You can access enrolments only for your assigned courses.",
          });
        }
        filter.courseId = courseId;
      } else {
        filter.courseId = { $in: managedCourseIds };
      }

      if (studentId) filter.studentId = studentId;
    } else {
      if (studentId) filter.studentId = studentId;
      if (courseId) filter.courseId = courseId;
    }

    if (status) filter.status = status;

    const normalizedSearch = String(search || "").trim();
    if (normalizedSearch) {
      const searchRegex = new RegExp(escapeRegex(normalizedSearch), "i");
      const [matchingStudents, matchingCourses] = await Promise.all([
        Student.find({
          organizationId: orgId,
          $or: [{ name: { $regex: searchRegex } }, { email: { $regex: searchRegex } }],
        })
          .select("_id")
          .lean(),
        Course.find({
          organizationId: orgId,
          title: { $regex: searchRegex },
        })
          .select("_id")
          .lean(),
      ]);

      const matchedStudentIds = matchingStudents.map((item) => item._id);
      const matchedCourseIds = matchingCourses.map((item) => item._id);

      if (matchedStudentIds.length === 0 && matchedCourseIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            enrolments: [],
            pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
          },
        });
      }

      filter.$or = [];
      if (matchedStudentIds.length > 0) {
        filter.$or.push({ studentId: { $in: matchedStudentIds } });
      }
      if (matchedCourseIds.length > 0) {
        filter.$or.push({ courseId: { $in: matchedCourseIds } });
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [enrolments, total] = await Promise.all([
      Enrolment.find(filter)
        .populate("studentId", "name email")
        .populate("courseId", "title duration fee category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Enrolment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { enrolments, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } },
    });
  } catch (error) {
    next(error);
  }
};

const createEnrolment = async (req, res, next) => {
  try {
    const { studentId, courseId, notes } = req.body;
    const orgId = req.user.organizationId;
    let resolvedStudentId = studentId;

    if (req.user.role === "student") {
      if (!courseId) {
        return res.status(400).json({ success: false, message: "courseId is required." });
      }

      const selfStudent = await getStudentProfileForUser({
        organizationId: orgId,
        user: req.user,
        autoCreate: true,
      });

      if (!selfStudent) {
        return res.status(404).json({ success: false, message: "Student profile not found for this user." });
      }

      resolvedStudentId = selfStudent._id;
    }

    if (!resolvedStudentId || !courseId) {
      return res.status(400).json({ success: false, message: "studentId and courseId are required." });
    }

    // Verify student and course belong to same org
    const [student, course] = await Promise.all([
      Student.findOne({ _id: resolvedStudentId, organizationId: orgId }),
      Course.findOne({ _id: courseId, organizationId: orgId, isActive: true }),
    ]);

    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    if (req.user.role === "trainer") {
      const trainerProfile = await getTrainerProfileForUser({
        organizationId: orgId,
        user: req.user,
        autoCreate: true,
      });

      if (!trainerProfile?._id) {
        return res.status(403).json({ success: false, message: "Trainer profile not found." });
      }

      const managedCourseIds = await getManagedCourseIdsForTrainer({
        organizationId: orgId,
        trainer: trainerProfile,
      });

      if (!managedCourseIds.includes(String(courseId))) {
        return res.status(403).json({
          success: false,
          message: "You can create enrolments only for your assigned courses.",
        });
      }
    }

    // Check duplicate
    const exists = await Enrolment.findOne({
      organizationId: orgId,
      studentId: resolvedStudentId,
      courseId,
    });
    if (exists) return res.status(409).json({ success: false, message: "Student is already enrolled in this course." });

    // Check max enrolments
    if (course.maxEnrolments) {
      const count = await Enrolment.countDocuments({
        organizationId: orgId,
        courseId,
        status: "active",
      });
      if (count >= course.maxEnrolments) {
        return res.status(400).json({ success: false, message: "This course has reached maximum enrolment capacity." });
      }
    }

    const enrolment = await Enrolment.create({
      organizationId: orgId,
      studentId: resolvedStudentId,
      courseId,
      notes: notes || null,
    });

    // Update student's enrolled courses
    await Student.findByIdAndUpdate(resolvedStudentId, { $addToSet: { enrolledCourses: courseId } });

    const paymentSync = await syncManualEnrolmentPayment({
      organizationId: orgId,
      studentId: resolvedStudentId,
      course,
      actorRole: req.user.role,
      actorId: req.user._id,
      ipAddress: req.ip,
    });

    await logActivity({ userId: req.user._id, organizationId: orgId, action: "CREATE_ENROLMENT", module: "enrolment", description: `Student ${student.name} enrolled in ${course.title}`, ipAddress: req.ip });

    const populated = await enrolment.populate([
      { path: "studentId", select: "name email" },
      { path: "courseId", select: "title duration fee" },
    ]);

    const paymentMessage =
      paymentSync?.mode === "created"
        ? " Payment recorded."
        : paymentSync?.mode === "updated"
          ? " Payment updated."
          : "";

    res.status(201).json({
      success: true,
      message: `Student enrolled successfully.${paymentMessage}`,
      data: { enrolment: populated, paymentSync },
    });
  } catch (error) {
    next(error);
  }
};

const updateEnrolment = async (req, res, next) => {
  try {
    const { status, progress, quizScore, attendanceMinutes, notes, completionDate } = req.body;
    const orgId = req.user.organizationId;

    const enrolment = await Enrolment.findOne({ _id: req.params.id, organizationId: orgId });
    if (!enrolment) return res.status(404).json({ success: false, message: "Enrolment not found." });

    if (req.user.role === "trainer") {
      const trainer = await getTrainerProfileForUser({
        organizationId: orgId,
        user: req.user,
        autoCreate: true,
      });

      if (!trainer?._id) {
        return res.status(403).json({ success: false, message: "Trainer profile not found." });
      }

      const managedCourseIds = await getManagedCourseIdsForTrainer({
        organizationId: orgId,
        trainer,
      });

      if (!managedCourseIds.includes(String(enrolment.courseId))) {
        return res.status(403).json({
          success: false,
          message: "You can update enrolments only for your assigned courses.",
        });
      }
    }

    if (status !== undefined) enrolment.status = status;
    if (progress !== undefined) enrolment.progress = progress;
    if (quizScore !== undefined) enrolment.quizScore = quizScore === "" || quizScore === null ? null : quizScore;
    if (attendanceMinutes !== undefined) {
      enrolment.attendanceMinutes = normalizeAttendanceMinutes(attendanceMinutes, enrolment.attendanceMinutes || 0);
    }
    if (notes !== undefined) enrolment.notes = notes;
    if (completionDate !== undefined) enrolment.completionDate = completionDate || null;
    if (enrolment.status === "completed" && !enrolment.completionDate) enrolment.completionDate = new Date();

    await enrolment.save();

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "UPDATE_ENROLMENT",
      module: "enrolment",
      description: `Enrolment updated: ${String(enrolment._id)}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Enrolment updated successfully.", data: { enrolment } });
  } catch (error) {
    next(error);
  }
};

const deleteEnrolment = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const enrolment = await Enrolment.findOne({ _id: req.params.id, organizationId: orgId });
    if (!enrolment) return res.status(404).json({ success: false, message: "Enrolment not found." });

    await Enrolment.deleteOne({ _id: req.params.id, organizationId: orgId });
    await Student.findByIdAndUpdate(enrolment.studentId, { $pull: { enrolledCourses: enrolment.courseId } });

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "DELETE_ENROLMENT",
      module: "enrolment",
      description: `Enrolment removed: ${String(enrolment._id)}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Enrolment removed successfully." });
  } catch (error) {
    next(error);
  }
};

const exportEnrolmentsCsv = async (req, res, next) => {
  try {
    const { studentId, courseId, status } = req.query;
    const orgId = req.user.organizationId;
    const filter = { organizationId: orgId };

    if (req.user.role === "trainer") {
      const trainerProfile = await getTrainerProfileForUser({
        organizationId: orgId,
        user: req.user,
        autoCreate: true,
      });

      if (!trainerProfile) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="trainer-enrolments-${Date.now()}.csv"`);
        return res.status(200).send("Student Name,Student Email,Course,Enrollment Date,Status,Progress %,Quiz Score,Last Active\n");
      }

      const managedCourseIds = await getManagedCourseIdsForTrainer({
        organizationId: orgId,
        trainer: trainerProfile,
      });

      if (managedCourseIds.length === 0) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="trainer-enrolments-${Date.now()}.csv"`);
        return res.status(200).send("Student Name,Student Email,Course,Enrollment Date,Status,Progress %,Quiz Score,Last Active\n");
      }

      if (courseId) {
        if (!managedCourseIds.includes(String(courseId))) {
          return res.status(403).json({
            success: false,
            message: "You can export enrolments only for your assigned courses.",
          });
        }
        filter.courseId = courseId;
      } else {
        filter.courseId = { $in: managedCourseIds };
      }

      if (studentId) filter.studentId = studentId;
    } else {
      if (studentId) filter.studentId = studentId;
      if (courseId) filter.courseId = courseId;
    }

    if (status) filter.status = status;

    const enrolments = await Enrolment.find(filter)
      .populate("studentId", "name email")
      .populate("courseId", "title")
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      "Student Name",
      "Student Email",
      "Course",
      "Enrollment Date",
      "Status",
      "Progress %",
      "Quiz Score",
      "Meet Attendance Min",
      "Last Active",
    ];

    const rows = enrolments.map((item) => [
      item.studentId?.name || "",
      item.studentId?.email || "",
      item.courseId?.title || "",
      formatDate(item.enrolmentDate),
      item.status || "",
      item.progress ?? 0,
      item.quizScore ?? "",
      item.attendanceMinutes ?? 0,
      formatDate(item.updatedAt || item.enrolmentDate),
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "EXPORT_ENROLMENT_CSV",
      module: "enrolment",
      description: `Enrolment CSV exported (${enrolments.length} rows)`,
      ipAddress: req.ip,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="trainer-enrolments-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

const sendEnrolmentReminder = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const enrolment = await Enrolment.findOne({ _id: req.params.id, organizationId: orgId })
      .populate("studentId", "name email")
      .populate("courseId", "title")
      .lean();

    if (!enrolment) {
      return res.status(404).json({ success: false, message: "Enrolment not found." });
    }

    if (req.user.role === "trainer") {
      const trainer = await getTrainerProfileForUser({
        organizationId: orgId,
        user: req.user,
        autoCreate: true,
      });

      if (!trainer?._id) {
        return res.status(403).json({ success: false, message: "Trainer profile not found." });
      }

      const managedCourseIds = await getManagedCourseIdsForTrainer({
        organizationId: orgId,
        trainer,
      });

      if (!managedCourseIds.includes(String(enrolment.courseId?._id || enrolment.courseId))) {
        return res.status(403).json({
          success: false,
          message: "You can send reminders only for your assigned courses.",
        });
      }
    }

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "SEND_ENROLMENT_REMINDER",
      module: "enrolment",
      description: `Reminder sent to ${enrolment.studentId?.name || "student"} for ${enrolment.courseId?.title || "course"}`,
      metadata: {
        enrolmentId: String(enrolment._id),
        studentId: enrolment.studentId?._id ? String(enrolment.studentId._id) : null,
        courseId: enrolment.courseId?._id ? String(enrolment.courseId._id) : null,
      },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Reminder sent successfully.",
      data: {
        reminder: {
          enrolmentId: enrolment._id,
          student: enrolment.studentId,
          course: enrolment.courseId,
          sentAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEnrolments,
  createEnrolment,
  updateEnrolment,
  deleteEnrolment,
  exportEnrolmentsCsv,
  sendEnrolmentReminder,
};
