const mongoose = require("mongoose");
const Student = require("../models/Student");
const Trainer = require("../models/Trainer");
const Enrolment = require("../models/Enrolment");
const Payment = require("../models/Payment");
const Course = require("../models/Course");
const { logActivity } = require("../middlewares/activityLogger");

const clampMonths = (value, fallback = 6) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 1) return 1;
  if (parsed > 24) return 24;
  return Math.floor(parsed);
};

const clampLimit = (value, fallback = 10, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 1) return 1;
  if (parsed > max) return max;
  return Math.floor(parsed);
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
};

const normalizeAttendanceScore = (minutes) => {
  const parsed = Number(minutes || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Number(Math.min((parsed / 120) * 100, 100).toFixed(1));
};

const computeOverallPerformanceScore = ({
  averageProgress = 0,
  completionRate = 0,
  averageQuizScore = 0,
  attendanceScore = 0,
}) =>
  Number(
    (
      averageProgress * 0.4 +
      completionRate * 0.3 +
      averageQuizScore * 0.2 +
      attendanceScore * 0.1
    ).toFixed(1)
  );

const getOverviewData = async (orgId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    thisMonthStudents,
    lastMonthStudents,
    thisMonthEnrolments,
    thisMonthRevenue,
    lastMonthRevenue,
    completionRate,
  ] = await Promise.all([
    Student.countDocuments({ organizationId: orgId, createdAt: { $gte: startOfMonth } }),
    Student.countDocuments({ organizationId: orgId, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
    Enrolment.countDocuments({ organizationId: orgId, createdAt: { $gte: startOfMonth } }),
    Payment.aggregate([
      { $match: { organizationId: orgId, status: "completed", paymentDate: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Payment.aggregate([
      { $match: { organizationId: orgId, status: "completed", paymentDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Enrolment.aggregate([
      { $match: { organizationId: orgId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  return {
    students: {
      thisMonth: thisMonthStudents,
      lastMonth: lastMonthStudents,
      growth: lastMonthStudents ? (((thisMonthStudents - lastMonthStudents) / lastMonthStudents) * 100).toFixed(1) : 0,
    },
    enrolments: { thisMonth: thisMonthEnrolments },
    revenue: {
      thisMonth: thisMonthRevenue[0]?.total || 0,
      lastMonth: lastMonthRevenue[0]?.total || 0,
    },
    enrolmentByStatus: completionRate,
  };
};

const getRevenueData = async (orgId, months = 6) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - clampMonths(months, 6));

  return Payment.aggregate([
    { $match: { organizationId: orgId, status: "completed", paymentDate: { $gte: startDate } } },
    {
      $group: {
        _id: { year: { $year: "$paymentDate" }, month: { $month: "$paymentDate" } },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
};

const getCourseStats = async (orgId) =>
  Enrolment.aggregate([
    { $match: { organizationId: orgId } },
    {
      $group: {
        _id: "$courseId",
        totalEnrolments: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        avgProgress: { $avg: "$progress" },
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "_id",
        foreignField: "_id",
        as: "course",
      },
    },
    { $unwind: "$course" },
    { $match: { "course.organizationId": orgId } },
    {
      $project: {
        courseTitle: "$course.title",
        totalEnrolments: 1,
        completed: 1,
        active: 1,
        avgProgress: { $round: ["$avgProgress", 1] },
        completionRate: {
          $round: [{ $multiply: [{ $divide: ["$completed", "$totalEnrolments"] }, 100] }, 1],
        },
      },
    },
    { $sort: { totalEnrolments: -1 } },
  ]);

const getStudentPerformanceStats = async (orgId, { limit = 10, search = "" } = {}) => {
  const normalizedSearch = String(search || "").trim();
  const searchRegex = normalizedSearch ? new RegExp(escapeRegex(normalizedSearch), "i") : null;

  const matchStage = { organizationId: orgId };

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "students",
        localField: "studentId",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $match: { "student.organizationId": orgId } },
  ];

  if (searchRegex) {
    pipeline.push({
      $match: {
        $or: [{ "student.name": { $regex: searchRegex } }, { "student.email": { $regex: searchRegex } }],
      },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: "$studentId",
        studentName: { $first: "$student.name" },
        studentEmail: { $first: "$student.email" },
        totalEnrolments: { $sum: 1 },
        activeEnrolments: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        completedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        droppedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "dropped"] }, 1, 0] } },
        suspendedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] } },
        totalProgress: { $sum: { $ifNull: ["$progress", 0] } },
        quizScoreSum: { $sum: { $ifNull: ["$quizScore", 0] } },
        quizScoreCount: { $sum: { $cond: [{ $ne: ["$quizScore", null] }, 1, 0] } },
        totalAttendanceMinutes: { $sum: { $ifNull: ["$attendanceMinutes", 0] } },
        lastActivityAt: { $max: "$updatedAt" },
      },
    },
    { $sort: { totalEnrolments: -1 } }
  );

  const aggregated = await Enrolment.aggregate(pipeline);

  return aggregated
    .map((entry) => {
      const totalEnrolments = Number(entry.totalEnrolments || 0);
      const averageProgress =
        totalEnrolments > 0 ? Number((Number(entry.totalProgress || 0) / totalEnrolments).toFixed(1)) : 0;
      const completionRate =
        totalEnrolments > 0 ? Number(((Number(entry.completedEnrolments || 0) / totalEnrolments) * 100).toFixed(1)) : 0;
      const averageQuizScore =
        Number(entry.quizScoreCount || 0) > 0
          ? Number((Number(entry.quizScoreSum || 0) / Number(entry.quizScoreCount)).toFixed(1))
          : 0;
      const averageAttendanceMinutes =
        totalEnrolments > 0 ? Number((Number(entry.totalAttendanceMinutes || 0) / totalEnrolments).toFixed(1)) : 0;
      const attendanceScore = normalizeAttendanceScore(averageAttendanceMinutes);
      const overallScore = computeOverallPerformanceScore({
        averageProgress,
        completionRate,
        averageQuizScore,
        attendanceScore,
      });

      return {
        _id: entry._id,
        studentName: entry.studentName || "Student",
        studentEmail: entry.studentEmail || "",
        totalEnrolments,
        activeEnrolments: Number(entry.activeEnrolments || 0),
        completedEnrolments: Number(entry.completedEnrolments || 0),
        droppedEnrolments: Number(entry.droppedEnrolments || 0),
        suspendedEnrolments: Number(entry.suspendedEnrolments || 0),
        averageProgress,
        completionRate,
        averageQuizScore,
        averageAttendanceMinutes,
        attendanceScore,
        overallScore,
        lastActivityAt: entry.lastActivityAt || null,
      };
    })
    .sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
      if (b.totalEnrolments !== a.totalEnrolments) return b.totalEnrolments - a.totalEnrolments;
      return String(a.studentName || "").localeCompare(String(b.studentName || ""));
    })
    .slice(0, clampLimit(limit, 10, 200));
};

const getTrainerPerformanceStats = async (orgId, { limit = 10, search = "" } = {}) => {
  const normalizedSearch = String(search || "").trim();
  const searchRegex = normalizedSearch ? new RegExp(escapeRegex(normalizedSearch), "i") : null;

  const trainerFilter = { organizationId: orgId };
  if (searchRegex) {
    trainerFilter.$or = [{ name: { $regex: searchRegex } }, { email: { $regex: searchRegex } }];
  }

  const trainers = await Trainer.find(trainerFilter)
    .select("_id name email specialization assignedCourses isActive")
    .lean();

  if (trainers.length === 0) return [];

  const trainerIdSet = new Set(trainers.map((item) => String(item._id)));
  const assignedCourseIdSet = new Set();
  trainers.forEach((trainer) => {
    (trainer.assignedCourses || []).forEach((courseId) => {
      if (courseId) assignedCourseIdSet.add(String(courseId));
    });
  });

  const courses = await Course.find({
    organizationId: orgId,
    $or: [{ trainerId: { $in: Array.from(trainerIdSet) } }, { _id: { $in: Array.from(assignedCourseIdSet) } }],
  })
    .select("_id title trainerId isActive isPublished")
    .lean();

  const courseMap = new Map(courses.map((course) => [String(course._id), course]));
  const courseIds = Array.from(courseMap.keys());

  const enrolmentAggregates =
    courseIds.length > 0
      ? await Enrolment.aggregate([
          { $match: { organizationId: orgId, courseId: { $in: courseIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
          {
            $group: {
              _id: "$courseId",
              totalEnrolments: { $sum: 1 },
              activeEnrolments: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
              completedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
              droppedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "dropped"] }, 1, 0] } },
              suspendedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] } },
              totalProgress: { $sum: { $ifNull: ["$progress", 0] } },
              quizScoreSum: { $sum: { $ifNull: ["$quizScore", 0] } },
              quizScoreCount: { $sum: { $cond: [{ $ne: ["$quizScore", null] }, 1, 0] } },
              totalAttendanceMinutes: { $sum: { $ifNull: ["$attendanceMinutes", 0] } },
              uniqueStudents: { $addToSet: "$studentId" },
            },
          },
        ])
      : [];

  const courseStatsMap = new Map(enrolmentAggregates.map((item) => [String(item._id), item]));

  const trainerPerformance = trainers.map((trainer) => {
    const managedCourseIds = new Set();

    courses.forEach((course) => {
      if (course.trainerId && String(course.trainerId) === String(trainer._id)) {
        managedCourseIds.add(String(course._id));
      }
    });

    (trainer.assignedCourses || []).forEach((courseId) => {
      const normalized = String(courseId || "");
      if (courseMap.has(normalized)) {
        managedCourseIds.add(normalized);
      }
    });

    let totalEnrolments = 0;
    let activeEnrolments = 0;
    let completedEnrolments = 0;
    let droppedEnrolments = 0;
    let suspendedEnrolments = 0;
    let totalProgress = 0;
    let quizScoreSum = 0;
    let quizScoreCount = 0;
    let totalAttendanceMinutes = 0;
    const studentIds = new Set();
    let activeCourses = 0;
    let publishedCourses = 0;

    managedCourseIds.forEach((courseId) => {
      const course = courseMap.get(courseId);
      const stats = courseStatsMap.get(courseId);

      if (course?.isActive) activeCourses += 1;
      if (course?.isPublished) publishedCourses += 1;

      if (!stats) return;

      totalEnrolments += Number(stats.totalEnrolments || 0);
      activeEnrolments += Number(stats.activeEnrolments || 0);
      completedEnrolments += Number(stats.completedEnrolments || 0);
      droppedEnrolments += Number(stats.droppedEnrolments || 0);
      suspendedEnrolments += Number(stats.suspendedEnrolments || 0);
      totalProgress += Number(stats.totalProgress || 0);
      quizScoreSum += Number(stats.quizScoreSum || 0);
      quizScoreCount += Number(stats.quizScoreCount || 0);
      totalAttendanceMinutes += Number(stats.totalAttendanceMinutes || 0);

      (stats.uniqueStudents || []).forEach((studentId) => {
        if (studentId) studentIds.add(String(studentId));
      });
    });

    const averageProgress = totalEnrolments > 0 ? Number((totalProgress / totalEnrolments).toFixed(1)) : 0;
    const completionRate = totalEnrolments > 0 ? Number(((completedEnrolments / totalEnrolments) * 100).toFixed(1)) : 0;
    const averageQuizScore = quizScoreCount > 0 ? Number((quizScoreSum / quizScoreCount).toFixed(1)) : 0;
    const averageAttendanceMinutes = totalEnrolments > 0 ? Number((totalAttendanceMinutes / totalEnrolments).toFixed(1)) : 0;
    const attendanceScore = normalizeAttendanceScore(averageAttendanceMinutes);
    const overallScore = computeOverallPerformanceScore({
      averageProgress,
      completionRate,
      averageQuizScore,
      attendanceScore,
    });

    return {
      _id: trainer._id,
      trainerName: trainer.name || "Trainer",
      trainerEmail: trainer.email || "",
      specialization: trainer.specialization || null,
      totalCourses: managedCourseIds.size,
      activeCourses,
      publishedCourses,
      totalStudents: studentIds.size,
      totalEnrolments,
      activeEnrolments,
      completedEnrolments,
      droppedEnrolments,
      suspendedEnrolments,
      averageProgress,
      completionRate,
      averageQuizScore,
      averageAttendanceMinutes,
      attendanceScore,
      overallScore,
    };
  });

  return trainerPerformance
    .sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
      if (b.totalStudents !== a.totalStudents) return b.totalStudents - a.totalStudents;
      return String(a.trainerName || "").localeCompare(String(b.trainerName || ""));
    })
    .slice(0, clampLimit(limit, 10, 200));
};

// @route GET /api/analytics/overview
const getOverview = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const overview = await getOverviewData(orgId);

    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/analytics/revenue — Monthly revenue chart
const getRevenueAnalytics = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const months = clampMonths(req.query.months, 6);
    const revenueData = await getRevenueData(orgId, months);

    res.status(200).json({ success: true, data: { revenueData } });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/analytics/courses — Course performance
const getCourseAnalytics = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const courseStats = await getCourseStats(orgId);

    res.status(200).json({ success: true, data: { courseStats } });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/analytics/students-performance — Student performance leaderboard
const getStudentPerformanceAnalytics = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const limit = clampLimit(req.query.limit, 12, 200);
    const search = String(req.query.search || "");

    const studentStats = await getStudentPerformanceStats(orgId, { limit, search });
    return res.status(200).json({ success: true, data: { studentStats } });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/analytics/trainers-performance — Trainer performance leaderboard
const getTrainerPerformanceAnalytics = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const limit = clampLimit(req.query.limit, 12, 200);
    const search = String(req.query.search || "");

    const trainerStats = await getTrainerPerformanceStats(orgId, { limit, search });
    return res.status(200).json({ success: true, data: { trainerStats } });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/analytics/export/csv
const exportAnalyticsCsv = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const months = clampMonths(req.query.months, 6);

    const [overview, revenueData, courseStats] = await Promise.all([
      getOverviewData(orgId),
      getRevenueData(orgId, months),
      getCourseStats(orgId),
    ]);

    const lines = [];

    lines.push("Overview Metric,Value");
    lines.push(`New Students This Month,${escapeCsv(overview.students.thisMonth)}`);
    lines.push(`New Students Last Month,${escapeCsv(overview.students.lastMonth)}`);
    lines.push(`Student Growth %,${escapeCsv(overview.students.growth)}`);
    lines.push(`New Enrolments This Month,${escapeCsv(overview.enrolments.thisMonth)}`);
    lines.push(`Revenue This Month,${escapeCsv(overview.revenue.thisMonth)}`);
    lines.push(`Revenue Last Month,${escapeCsv(overview.revenue.lastMonth)}`);
    overview.enrolmentByStatus.forEach((statusItem) => {
      lines.push(`Enrolments (${statusItem._id || "unknown"}),${escapeCsv(statusItem.count || 0)}`);
    });

    lines.push("");
    lines.push("Monthly Revenue");
    lines.push("Month,Year,Payments,Revenue");
    revenueData.forEach((item) => {
      lines.push(
        [
          escapeCsv(item?._id?.month || ""),
          escapeCsv(item?._id?.year || ""),
          escapeCsv(item?.count || 0),
          escapeCsv(item?.total || 0),
        ].join(",")
      );
    });

    lines.push("");
    lines.push("Course Performance");
    lines.push("Course,Enrolments,Active,Completed,Completion Rate %,Average Progress %");
    courseStats.forEach((item) => {
      lines.push(
        [
          escapeCsv(item.courseTitle || ""),
          escapeCsv(item.totalEnrolments || 0),
          escapeCsv(item.active || 0),
          escapeCsv(item.completed || 0),
          escapeCsv(item.completionRate || 0),
          escapeCsv(item.avgProgress || 0),
        ].join(",")
      );
    });

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "EXPORT_ANALYTICS_CSV",
      module: "analytics",
      description: `Analytics CSV exported (${courseStats.length} course rows, ${revenueData.length} revenue rows)`,
      ipAddress: req.ip,
    });

    const today = new Date();
    const filenameDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="analytics-${filenameDate}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getRevenueAnalytics,
  getCourseAnalytics,
  getStudentPerformanceAnalytics,
  getTrainerPerformanceAnalytics,
  exportAnalyticsCsv,
};
