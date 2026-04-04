const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrolment = require("../models/Enrolment");
const Trainer = require("../models/Trainer");
const Student = require("../models/Student");
const CourseFeedback = require("../models/CourseFeedback");
const CourseComment = require("../models/CourseComment");
const { logActivity } = require("../middlewares/activityLogger");

const normalizeUploadPath = (file) => (file ? `/${file.path.replace(/\\/g, "/")}` : null);
const normalizeId = (value) => (value ? String(value).trim() : null);
const parseCommentSort = (value) => (String(value || "").toLowerCase() === "oldest" ? "oldest" : "newest");
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ""));
const isValidGoogleMeetLink = (value) =>
  /^https:\/\/meet\.google\.com\/[a-z0-9-]+(?:[/?#].*)?$/i.test(String(value || "").trim());

const normalizeGoogleMeetLink = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (!isValidGoogleMeetLink(normalized)) {
    throw Object.assign(
      new Error("Meeting link must be a valid Google Meet URL (https://meet.google.com/...)."),
      { statusCode: 400 }
    );
  }
  return normalized;
};

const normalizeMeetingSchedule = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error("Meeting schedule time must be a valid date and time."), { statusCode: 400 });
  }

  return parsed;
};

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

const parseCourseModules = (input) => {
  if (input === undefined || input === null || input === "") return [];

  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      throw Object.assign(new Error("Invalid modules format. Expected valid JSON array."), { statusCode: 400 });
    }
  }

  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error("Invalid modules format. Expected array."), { statusCode: 400 });
  }

  return parsed
    .map((moduleItem) => {
      const title = String(moduleItem?.title || "").trim();
      const lessonsInput = Array.isArray(moduleItem?.lessons) ? moduleItem.lessons : [];

      const lessons = lessonsInput
        .map((lesson) => ({
          title: String(lesson?.title || "").trim() || null,
          videoUrl: String(lesson?.videoUrl || "").trim() || null,
          pdfUrl: String(lesson?.pdfUrl || "").trim() || null,
          quizTitle: String(lesson?.quizTitle || "").trim() || null,
          assignmentTitle: String(lesson?.assignmentTitle || "").trim() || null,
        }))
        .filter((lesson) => lesson.title || lesson.videoUrl || lesson.pdfUrl || lesson.quizTitle || lesson.assignmentTitle);

      return {
        title: title || null,
        lessons,
      };
    })
    .filter((moduleItem) => moduleItem.title || moduleItem.lessons.length > 0);
};

const syncTrainerAssignments = async ({ courseId, previousTrainerId, nextTrainerId }) => {
  const previous = normalizeId(previousTrainerId);
  const next = normalizeId(nextTrainerId);

  if (previous && previous !== next) {
    await Trainer.findByIdAndUpdate(previous, { $pull: { assignedCourses: courseId } });
  }

  if (next && previous !== next) {
    await Trainer.findByIdAndUpdate(next, { $addToSet: { assignedCourses: courseId } });
  }
};

const isCourseManagedByTrainer = (course, trainer) => {
  if (!course || !trainer?._id) return false;

  const ownsCourse = Boolean(course.trainerId && String(course.trainerId) === String(trainer._id));
  const assignedCourseIds = Array.isArray(trainer.assignedCourses)
    ? trainer.assignedCourses.map((courseId) => String(courseId))
    : [];

  return ownsCourse || assignedCourseIds.includes(String(course._id));
};

const getStudentProfileForUser = async (organizationId, user, { autoCreate = false } = {}) => {
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

  return {
    _id: student._id,
    name: student.name,
    email: student.email,
  };
};

const getTrainerProfileForUser = async (organizationId, user, { autoCreate = false, includeAssignedCourses = false } = {}) => {
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
  });

  if (!trainer && autoCreate && user?.role === "trainer" && userName) {
    trainer = await Trainer.findOne({
      organizationId,
      userId: null,
      name: { $regex: `^${escapeRegex(userName)}$`, $options: "i" },
    });
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
        trainer = await Trainer.findOne({ organizationId, email: fallbackEmail });
      } else {
        throw error;
      }
    }
  }

  if (!trainer) return null;

  if (!trainer.userId || String(trainer.userId) !== String(user._id)) {
    trainer.userId = user._id;
    await trainer.save({ validateBeforeSave: false });
  }

  if (includeAssignedCourses) return trainer;

  return {
    _id: trainer._id,
    name: trainer.name,
    email: trainer.email,
  };
};

const isStudentEnrolledInCourse = async ({ organizationId, studentId, courseId }) => {
  if (!studentId) return false;

  const enrolment = await Enrolment.exists({
    organizationId,
    studentId,
    courseId,
    status: { $in: ["active", "completed"] },
  });

  return Boolean(enrolment);
};

const buildCourseVideoEngagementData = async ({ organizationId, courseId, user, commentSort = "newest" }) => {
  const courseObjectId = new mongoose.Types.ObjectId(String(courseId));
  const organizationObjectId = new mongoose.Types.ObjectId(String(organizationId));
  const commentOrder = commentSort === "oldest" ? 1 : -1;

  const [reactionStats, ratingStats, commentsCount, comments] = await Promise.all([
    CourseFeedback.aggregate([
      { $match: { organizationId: organizationObjectId, courseId: courseObjectId, reaction: { $in: ["like", "dislike"] } } },
      { $group: { _id: "$reaction", count: { $sum: 1 } } },
    ]),
    CourseFeedback.aggregate([
      { $match: { organizationId: organizationObjectId, courseId: courseObjectId, rating: { $ne: null } } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]),
    CourseComment.countDocuments({ organizationId, courseId, isActive: true }),
    CourseComment.find({ organizationId, courseId, isActive: true })
      .populate("studentId", "name")
      .sort({ createdAt: commentOrder })
      .limit(30)
      .lean(),
  ]);

  const likes = reactionStats.find((item) => item._id === "like")?.count || 0;
  const dislikes = reactionStats.find((item) => item._id === "dislike")?.count || 0;
  const ratingAverage = ratingStats[0]?.average ? Number(ratingStats[0].average.toFixed(1)) : 0;
  const ratingCount = ratingStats[0]?.count || 0;

  let myFeedback = { reaction: null, rating: null };
  let canInteract = false;
  let isEnrolled = false;
  let studentProfileId = null;

  if (user?.role === "student") {
    const studentProfile = await getStudentProfileForUser(organizationId, user);

    if (studentProfile?._id) {
      studentProfileId = String(studentProfile._id);
      isEnrolled = await isStudentEnrolledInCourse({
        organizationId,
        studentId: studentProfile._id,
        courseId,
      });
      // Demo mode: allow any logged-in student profile to engage,
      // even if not currently enrolled in the course.
      canInteract = true;

      if (canInteract) {
        const feedback = await CourseFeedback.findOne({
          organizationId,
          courseId,
          studentId: studentProfile._id,
        })
          .select("reaction rating")
          .lean();

        myFeedback = {
          reaction: feedback?.reaction || null,
          rating: feedback?.rating || null,
        };
      }
    }
  }

  return {
    summary: {
      likes,
      dislikes,
      ratingAverage,
      ratingCount,
      commentsCount,
    },
    myFeedback,
    canInteract,
    isEnrolled,
    studentProfileId,
    comments: comments.map((comment) => ({
      _id: comment._id,
      comment: comment.comment,
      createdAt: comment.createdAt,
      isMine: Boolean(studentProfileId && comment.studentId && String(comment.studentId._id) === studentProfileId),
      studentId: comment.studentId
        ? {
            _id: comment.studentId._id,
            name: comment.studentId.name,
          }
        : null,
    })),
  };
};

const getCourses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "", isActive } = req.query;
    const orgId = req.user.organizationId;

    const conditions = [{ organizationId: orgId }];

    if (req.user.role === "trainer") {
      const trainer = await getTrainerProfileForUser(orgId, req.user, {
        autoCreate: true,
        includeAssignedCourses: true,
      });

      if (!trainer?._id) {
        return res.status(200).json({
          success: true,
          data: { courses: [], pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 } },
        });
      }

      const assignedIds = Array.isArray(trainer.assignedCourses) ? trainer.assignedCourses : [];
      conditions.push({ $or: [{ trainerId: trainer._id }, { _id: { $in: assignedIds } }] });
    }

    if (search) {
      conditions.push({ $or: [{ title: { $regex: search, $options: "i" } }, { category: { $regex: search, $options: "i" } }] });
    }
    if (isActive !== undefined) conditions.push({ isActive: isActive === "true" });

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const skip = (Number(page) - 1) * Number(limit);
    const [courses, total] = await Promise.all([
      Course.find(filter).populate("trainerId", "name email specialization").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Course.countDocuments(filter),
    ]);

    let enrolmentCountMap = new Map();
    if (courses.length > 0) {
      const counts = await Enrolment.aggregate([
        { $match: { courseId: { $in: courses.map((course) => course._id) } } },
        { $group: { _id: "$courseId", count: { $sum: 1 } } },
      ]);
      enrolmentCountMap = new Map(counts.map((item) => [String(item._id), item.count]));
    }

    const coursesWithCounts = courses.map((course) => ({
      ...course,
      enrolmentCount: enrolmentCountMap.get(String(course._id)) || 0,
    }));

    res.status(200).json({
      success: true,
      data: { courses: coursesWithCounts, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } },
    });
  } catch (error) {
    next(error);
  }
};

const getPublicPopularCourses = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 6);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 12)
      : 6;

    const courses = await Course.find({
      isActive: true,
      isPublished: true,
      title: { $not: /^Smoke Course\b/i },
    })
      .select("title description duration fee category level thumbnailUrl trainerId createdAt")
      .populate("trainerId", "name")
      .lean();

    if (courses.length === 0) {
      return res.status(200).json({ success: true, data: { courses: [] } });
    }

    const courseIds = courses.map((course) => course._id);
    const enrolmentStats = await Enrolment.aggregate([
      {
        $match: {
          courseId: { $in: courseIds },
          status: { $in: ["active", "completed"] },
        },
      },
      {
        $group: {
          _id: "$courseId",
          enrolmentCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
    ]);

    const statsMap = new Map(
      enrolmentStats.map((item) => [String(item._id), item])
    );

    const popularCourses = courses
      .map((course) => {
        const stats = statsMap.get(String(course._id));
        const enrolmentCount = Number(stats?.enrolmentCount || 0);
        const completedCount = Number(stats?.completedCount || 0);
        const completionRate =
          enrolmentCount > 0
            ? Number(((completedCount / enrolmentCount) * 100).toFixed(1))
            : 0;

        return {
          _id: course._id,
          title: course.title,
          description: course.description || null,
          duration: course.duration || null,
          fee: Number(course.fee || 0),
          category: course.category || null,
          level: course.level || "beginner",
          thumbnailUrl: course.thumbnailUrl || null,
          trainerName: course.trainerId?.name || "Trainer",
          enrolmentCount,
          completionRate,
          createdAt: course.createdAt,
        };
      })
      .sort((a, b) => {
        if (b.enrolmentCount !== a.enrolmentCount) {
          return b.enrolmentCount - a.enrolmentCount;
        }
        if (b.completionRate !== a.completionRate) {
          return b.completionRate - a.completionRate;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);

    return res.status(200).json({
      success: true,
      data: { courses: popularCourses },
    });
  } catch (error) {
    next(error);
  }
};

const getCourseById = async (req, res, next) => {
  try {
    const baseFilter = { _id: req.params.id, organizationId: req.user.organizationId };
    const filter = { ...baseFilter };

    if (req.user.role === "trainer") {
      const trainer = await getTrainerProfileForUser(req.user.organizationId, req.user, {
        autoCreate: true,
        includeAssignedCourses: true,
      });

      if (!trainer?._id) {
        return res.status(404).json({ success: false, message: "Course not found." });
      }

      const assignedIds = Array.isArray(trainer.assignedCourses) ? trainer.assignedCourses : [];
      filter.$or = [{ trainerId: trainer._id }, { _id: { $in: assignedIds } }];
    }

    const [course, enrolmentCount] = await Promise.all([
      Course.findOne(filter)
        .populate("trainerId", "name email specialization")
        .lean(),
      Enrolment.countDocuments({ organizationId: req.user.organizationId, courseId: req.params.id }),
    ]);

    if (!course) return res.status(404).json({ success: false, message: "Course not found." });
    res.status(200).json({ success: true, data: { course: { ...course, enrolmentCount } } });
  } catch (error) {
    next(error);
  }
};

const getCourseVideoEngagement = async (req, res, next) => {
  try {
    const commentSort = parseCommentSort(req.query.sort);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid course id." });
    }

    const filter = {
      _id: req.params.id,
      organizationId: req.user.organizationId,
    };

    if (req.user.role === "trainer") {
      const trainer = await getTrainerProfileForUser(req.user.organizationId, req.user, {
        autoCreate: true,
        includeAssignedCourses: true,
      });

      if (!trainer?._id) {
        return res.status(404).json({ success: false, message: "Course not found." });
      }

      const assignedIds = Array.isArray(trainer.assignedCourses) ? trainer.assignedCourses : [];
      filter.$or = [{ trainerId: trainer._id }, { _id: { $in: assignedIds } }];
    }

    const course = await Course.findOne(filter).select("_id");

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const data = await buildCourseVideoEngagementData({
      organizationId: req.user.organizationId,
      courseId: course._id,
      user: req.user,
      commentSort,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createCourse = async (req, res, next) => {
  try {
    const {
      title,
      description,
      duration,
      fee,
      trainerId,
      category,
      startDate,
      endDate,
      maxEnrolments,
      level,
      isPublished,
      modules,
      meetingLink,
      meetingScheduledAt,
    } = req.body;
    const orgId = req.user.organizationId;
    const videoFile = req.files?.video?.[0];
    const pdfFile = req.files?.pdf?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];
    let resolvedTrainerId = trainerId || null;

    if (!title) return res.status(400).json({ success: false, message: "Course title is required." });

    if (req.user.role === "trainer") {
      if (!orgId) {
        return res.status(403).json({
          success: false,
          message: "Your trainer account is not linked to any organization. Contact admin to assign your organization.",
        });
      }
      const selfTrainer = await getTrainerProfileForUser(orgId, req.user, { autoCreate: true });
      if (!selfTrainer?._id) {
        return res.status(403).json({
          success: false,
          message: "Trainer profile could not be resolved for this account. Contact admin to map your trainer account.",
        });
      }
      resolvedTrainerId = selfTrainer?._id || null;
    } else if (resolvedTrainerId) {
      const normalizedTrainerId = normalizeId(resolvedTrainerId);
      if (!mongoose.Types.ObjectId.isValid(normalizedTrainerId)) {
        return res.status(400).json({ success: false, message: "Invalid trainer selected." });
      }

      const trainer = await Trainer.findOne({
        _id: normalizedTrainerId,
        organizationId: orgId,
        isActive: true,
      }).select("_id");

      if (!trainer) {
        return res.status(404).json({ success: false, message: "Selected trainer not found." });
      }

      resolvedTrainerId = trainer._id;
    }

    const parsedModules = parseCourseModules(modules);
    const normalizedLevel = String(level || "").trim().toLowerCase();
    const resolvedLevel = ["beginner", "intermediate", "advanced"].includes(normalizedLevel)
      ? normalizedLevel
      : "beginner";
    const parsedFee = Number(fee);
    const resolvedFee = Number.isFinite(parsedFee) && parsedFee > 0 ? parsedFee : 0;
    const parsedMaxEnrolments = Number(maxEnrolments);
    const resolvedMaxEnrolments =
      Number.isFinite(parsedMaxEnrolments) && parsedMaxEnrolments > 0 ? parsedMaxEnrolments : null;
    const resolvedMeetingLink = normalizeGoogleMeetLink(meetingLink);
    const resolvedMeetingScheduledAt = normalizeMeetingSchedule(meetingScheduledAt);

    if (resolvedMeetingScheduledAt && !resolvedMeetingLink) {
      return res.status(400).json({
        success: false,
        message: "Meeting link is required before setting a meeting schedule time.",
      });
    }

    const course = await Course.create({
      organizationId: orgId,
      title: title.trim(),
      description: description || null,
      duration: duration || null,
      fee: resolvedFee,
      trainerId: resolvedTrainerId,
      category: category || null,
      startDate: startDate || null,
      endDate: endDate || null,
      maxEnrolments: resolvedMaxEnrolments,
      level: resolvedLevel,
      isPublished: toBoolean(isPublished, false),
      modules: parsedModules,
      meetingLink: resolvedMeetingLink,
      meetingScheduledAt: resolvedMeetingLink ? resolvedMeetingScheduledAt : null,
      thumbnailUrl: normalizeUploadPath(thumbnailFile),
      videoUrl: normalizeUploadPath(videoFile),
      pdfUrl: normalizeUploadPath(pdfFile),
    });

    if (resolvedTrainerId) {
      await Trainer.findByIdAndUpdate(resolvedTrainerId, { $addToSet: { assignedCourses: course._id } });
    }

    await logActivity({ userId: req.user._id, organizationId: orgId, action: "CREATE_COURSE", module: "course", description: `Course created: ${course.title}`, ipAddress: req.ip });

    res.status(201).json({ success: true, message: "Course created successfully.", data: { course } });
  } catch (error) {
    next(error);
  }
};

const upsertCourseVideoFeedback = async (req, res, next) => {
  try {
    const commentSort = parseCommentSort(req.query.sort);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid course id." });
    }

    const hasReaction = Object.prototype.hasOwnProperty.call(req.body, "reaction");
    const hasRating = Object.prototype.hasOwnProperty.call(req.body, "rating");

    if (!hasReaction && !hasRating) {
      return res.status(400).json({ success: false, message: "reaction or rating is required." });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    }).select("_id");

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const studentProfile = await getStudentProfileForUser(req.user.organizationId, req.user, { autoCreate: true });
    if (!studentProfile?._id) {
      return res.status(404).json({ success: false, message: "Student profile not found." });
    }

    const updateData = {};

    if (hasReaction) {
      const incomingReaction = req.body.reaction === "" ? null : req.body.reaction;
      if (![null, "like", "dislike"].includes(incomingReaction)) {
        return res.status(400).json({ success: false, message: "reaction must be like, dislike, or null." });
      }
      updateData.reaction = incomingReaction;
    }

    if (hasRating) {
      if (req.body.rating === "" || req.body.rating === null) {
        updateData.rating = null;
      } else {
        const parsedRating = Number(req.body.rating);
        if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
          return res.status(400).json({ success: false, message: "rating must be an integer between 1 and 5." });
        }
        updateData.rating = parsedRating;
      }
    }

    const feedback = await CourseFeedback.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        courseId: course._id,
        studentId: studentProfile._id,
      },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (!feedback.reaction && !feedback.rating) {
      await CourseFeedback.deleteOne({ _id: feedback._id });
    }

    const data = await buildCourseVideoEngagementData({
      organizationId: req.user.organizationId,
      courseId: course._id,
      user: req.user,
      commentSort,
    });

    res.status(200).json({ success: true, message: "Video feedback updated successfully.", data });
  } catch (error) {
    next(error);
  }
};

const createCourseVideoComment = async (req, res, next) => {
  try {
    const commentSort = parseCommentSort(req.query.sort);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid course id." });
    }

    const commentText = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
    if (!commentText) {
      return res.status(400).json({ success: false, message: "Comment is required." });
    }
    if (commentText.length > 1000) {
      return res.status(400).json({ success: false, message: "Comment cannot exceed 1000 characters." });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    }).select("_id");

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const studentProfile = await getStudentProfileForUser(req.user.organizationId, req.user, { autoCreate: true });
    if (!studentProfile?._id) {
      return res.status(404).json({ success: false, message: "Student profile not found." });
    }

    await CourseComment.create({
      organizationId: req.user.organizationId,
      courseId: course._id,
      studentId: studentProfile._id,
      comment: commentText,
    });

    const data = await buildCourseVideoEngagementData({
      organizationId: req.user.organizationId,
      courseId: course._id,
      user: req.user,
      commentSort,
    });

    res.status(201).json({ success: true, message: "Comment posted successfully.", data });
  } catch (error) {
    next(error);
  }
};

const updateCourseVideoComment = async (req, res, next) => {
  try {
    const commentSort = parseCommentSort(req.query.sort);

    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.commentId)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const commentText = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
    if (!commentText) {
      return res.status(400).json({ success: false, message: "Comment is required." });
    }
    if (commentText.length > 1000) {
      return res.status(400).json({ success: false, message: "Comment cannot exceed 1000 characters." });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    }).select("_id");

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const studentProfile = await getStudentProfileForUser(req.user.organizationId, req.user, { autoCreate: true });
    if (!studentProfile?._id) {
      return res.status(404).json({ success: false, message: "Student profile not found." });
    }

    const updatedComment = await CourseComment.findOneAndUpdate(
      {
        _id: req.params.commentId,
        organizationId: req.user.organizationId,
        courseId: course._id,
        studentId: studentProfile._id,
        isActive: true,
      },
      { $set: { comment: commentText } },
      { new: true, runValidators: true }
    );

    if (!updatedComment) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    const data = await buildCourseVideoEngagementData({
      organizationId: req.user.organizationId,
      courseId: course._id,
      user: req.user,
      commentSort,
    });

    res.status(200).json({ success: true, message: "Comment updated successfully.", data });
  } catch (error) {
    next(error);
  }
};

const deleteCourseVideoComment = async (req, res, next) => {
  try {
    const commentSort = parseCommentSort(req.query.sort);

    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.commentId)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    }).select("_id");

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const studentProfile = await getStudentProfileForUser(req.user.organizationId, req.user, { autoCreate: true });
    if (!studentProfile?._id) {
      return res.status(404).json({ success: false, message: "Student profile not found." });
    }

    const deletedComment = await CourseComment.findOneAndUpdate(
      {
        _id: req.params.commentId,
        organizationId: req.user.organizationId,
        courseId: course._id,
        studentId: studentProfile._id,
        isActive: true,
      },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!deletedComment) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    const data = await buildCourseVideoEngagementData({
      organizationId: req.user.organizationId,
      courseId: course._id,
      user: req.user,
      commentSort,
    });

    res.status(200).json({ success: true, message: "Comment deleted successfully.", data });
  } catch (error) {
    next(error);
  }
};

const updateCourse = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const course = await Course.findOne({ _id: req.params.id, organizationId: orgId });
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    if (req.user.role === "trainer") {
      const trainer = await getTrainerProfileForUser(orgId, req.user, {
        autoCreate: true,
        includeAssignedCourses: true,
      });

      if (!trainer || !isCourseManagedByTrainer(course, trainer)) {
        return res.status(403).json({
          success: false,
          message: "You can update only courses assigned to your trainer account.",
        });
      }
    }

    const previousTrainerId = course.trainerId;
    const videoFile = req.files?.video?.[0];
    const pdfFile = req.files?.pdf?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (req.body.title !== undefined) {
      const nextTitle = String(req.body.title || "").trim();
      if (!nextTitle) {
        return res.status(400).json({ success: false, message: "Course title is required." });
      }
      course.title = nextTitle;
    }

    if (req.body.description !== undefined) course.description = String(req.body.description || "").trim() || null;
    if (req.body.duration !== undefined) course.duration = String(req.body.duration || "").trim() || null;
    if (req.body.category !== undefined) course.category = String(req.body.category || "").trim() || null;
    if (req.body.startDate !== undefined) course.startDate = req.body.startDate || null;
    if (req.body.endDate !== undefined) course.endDate = req.body.endDate || null;

    if (req.body.fee !== undefined) {
      const parsedFee = Number(req.body.fee);
      course.fee = Number.isFinite(parsedFee) && parsedFee > 0 ? parsedFee : 0;
    }

    if (req.body.maxEnrolments !== undefined) {
      const parsedMax = Number(req.body.maxEnrolments);
      course.maxEnrolments = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : null;
    }

    if (req.body.level !== undefined) {
      const normalizedLevel = String(req.body.level || "").trim().toLowerCase();
      if (normalizedLevel && !["beginner", "intermediate", "advanced"].includes(normalizedLevel)) {
        return res.status(400).json({
          success: false,
          message: "Course level must be beginner, intermediate, or advanced.",
        });
      }
      course.level = normalizedLevel || "beginner";
    }

    if (req.body.isActive !== undefined) {
      course.isActive = toBoolean(req.body.isActive, Boolean(course.isActive));
    }

    if (req.body.isPublished !== undefined) {
      course.isPublished = toBoolean(req.body.isPublished, Boolean(course.isPublished));
    }

    if (req.body.modules !== undefined) {
      course.modules = parseCourseModules(req.body.modules);
    }
    let nextMeetingLink = course.meetingLink;
    if (req.body.meetingLink !== undefined) {
      nextMeetingLink = normalizeGoogleMeetLink(req.body.meetingLink);
      course.meetingLink = nextMeetingLink;
      if (!nextMeetingLink) {
        course.meetingScheduledAt = null;
      }
    }

    if (req.body.meetingScheduledAt !== undefined) {
      const resolvedMeetingScheduledAt = normalizeMeetingSchedule(req.body.meetingScheduledAt);

      if (resolvedMeetingScheduledAt && !nextMeetingLink) {
        return res.status(400).json({
          success: false,
          message: "Meeting link is required before setting a meeting schedule time.",
        });
      }

      course.meetingScheduledAt = nextMeetingLink ? resolvedMeetingScheduledAt : null;
    }

    if (videoFile) course.videoUrl = normalizeUploadPath(videoFile);
    if (pdfFile) course.pdfUrl = normalizeUploadPath(pdfFile);
    if (thumbnailFile) course.thumbnailUrl = normalizeUploadPath(thumbnailFile);

    if (req.user.role === "admin" && req.body.trainerId !== undefined) {
      const nextTrainerId = normalizeId(req.body.trainerId);

      if (!nextTrainerId) {
        course.trainerId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(nextTrainerId)) {
          return res.status(400).json({ success: false, message: "Invalid trainer selected." });
        }

        const trainer = await Trainer.findOne({
          _id: nextTrainerId,
          organizationId: orgId,
          isActive: true,
        }).select("_id");

        if (!trainer) {
          return res.status(404).json({ success: false, message: "Selected trainer not found." });
        }

        course.trainerId = trainer._id;
      }
    }

    await course.save();
    await syncTrainerAssignments({ courseId: course._id, previousTrainerId, nextTrainerId: course.trainerId });
    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "UPDATE_COURSE",
      module: "course",
      description: `Course updated: ${course.title}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Course updated successfully.", data: { course } });
  } catch (error) {
    next(error);
  }
};

const deleteCourse = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const course = await Course.findOne({ _id: req.params.id, organizationId: orgId });
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    if (req.user.role === "trainer") {
      const trainer = await getTrainerProfileForUser(orgId, req.user, {
        autoCreate: true,
        includeAssignedCourses: true,
      });

      if (!trainer || !isCourseManagedByTrainer(course, trainer)) {
        return res.status(403).json({
          success: false,
          message: "You can delete only courses assigned to your trainer account.",
        });
      }
    }

    course.isActive = false;
    course.isPublished = false;
    await course.save();

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "DELETE_COURSE",
      module: "course",
      description: `Course deactivated: ${course.title}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Course deactivated successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourses,
  getPublicPopularCourses,
  getCourseById,
  getCourseVideoEngagement,
  createCourse,
  upsertCourseVideoFeedback,
  createCourseVideoComment,
  updateCourseVideoComment,
  deleteCourseVideoComment,
  updateCourse,
  deleteCourse,
};
