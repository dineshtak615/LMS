const Student = require("../models/Student");
const Trainer = require("../models/Trainer");
const Course = require("../models/Course");
const Enrolment = require("../models/Enrolment");
const Payment = require("../models/Payment");
const ActivityLog = require("../models/ActivityLog");
const CourseFeedback = require("../models/CourseFeedback");
const CourseComment = require("../models/CourseComment");
const Assignment = require("../models/Assignment");

const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ""));
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  return trainer;
};

const formatMonthLabel = (date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

const buildMonthSeries = (monthsBack = 6) => {
  const months = [];
  const now = new Date();

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      label: formatMonthLabel(monthDate),
      year: monthDate.getFullYear(),
      month: monthDate.getMonth() + 1,
    });
  }

  return months;
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
  averageAssignmentScore = 0,
  attendanceScore = 0,
}) =>
  Number(
    (
      averageProgress * 0.3 +
      completionRate * 0.25 +
      averageQuizScore * 0.2 +
      averageAssignmentScore * 0.15 +
      attendanceScore * 0.1
    ).toFixed(1)
  );

const buildEmptyTrainerDashboardData = (trainer) => ({
  trainer: trainer
    ? {
        _id: trainer._id,
        name: trainer.name,
        email: trainer.email,
        specialization: trainer.specialization,
        qualifications: trainer.qualifications,
        isActive: trainer.isActive,
      }
    : null,
  stats: {
    totalCourses: 0,
    activeCourses: 0,
    publishedCourses: 0,
    totalStudents: 0,
    totalEnrolments: 0,
    activeEnrolments: 0,
    completedEnrolments: 0,
    droppedEnrolments: 0,
    suspendedEnrolments: 0,
    averageProgress: 0,
    averageCompletionRate: 0,
    totalRevenue: 0,
    videosUploaded: 0,
    pdfsUploaded: 0,
  },
  performance: {
    averageProgress: 0,
    completionRate: 0,
    averageQuizScore: 0,
    averageAssignmentScore: 0,
    averageAttendanceMinutes: 0,
    attendanceScore: 0,
    overallScore: 0,
    gradedAssignmentCount: 0,
  },
  analytics: {
    enrolmentsPerCourse: [],
    enrolmentGrowth: [],
    progressTrend: [],
    dropOffByCourse: [],
    engagementTotals: {
      likes: 0,
      dislikes: 0,
      comments: 0,
      ratingAverage: 0,
      ratingCount: 0,
    },
  },
  coursePerformance: [],
  recentEnrolments: [],
  upcomingCourses: [],
});

// @route GET /api/dashboard — Admin dashboard summary
const getAdminDashboard = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;

    const [
      totalStudents,
      activeStudents,
      totalTrainers,
      totalCourses,
      activeCourses,
      totalEnrolments,
      recentPayments,
      revenueResult,
      recentActivity,
    ] = await Promise.all([
      Student.countDocuments({ organizationId: orgId }),
      Student.countDocuments({ organizationId: orgId, isActive: true }),
      Trainer.countDocuments({ organizationId: orgId, isActive: true }),
      Course.countDocuments({ organizationId: orgId }),
      Course.countDocuments({ organizationId: orgId, isActive: true }),
      Enrolment.countDocuments({ organizationId: orgId, status: "active" }),
      Payment.find({ organizationId: orgId, status: "completed" })
        .populate("studentId", "name")
        .sort({ paymentDate: -1 })
        .limit(5)
        .lean(),
      Payment.aggregate([
        { $match: { organizationId: orgId, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      ActivityLog.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalStudents,
          activeStudents,
          totalTrainers,
          totalCourses,
          activeCourses,
          activeEnrolments: totalEnrolments,
          totalRevenue: revenueResult[0]?.total || 0,
        },
        recentPayments,
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/dashboard/student — Student dashboard
const getStudentDashboard = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;
    const userEmail = String(req.user?.email || "").trim().toLowerCase();
    const userName = String(req.user?.name || "").trim() || "Student";

    let student = await Student.findOne({
      organizationId: orgId,
      $or: [{ userId }, { email: userEmail }],
    }).populate("enrolledCourses", "title duration trainer meetingLink meetingScheduledAt");

    if (!student && userEmail) {
      try {
        student = await Student.create({
          organizationId: orgId,
          userId,
          name: userName,
          email: userEmail,
          isActive: true,
        });
        student = await Student.findById(student._id).populate("enrolledCourses", "title duration trainer meetingLink meetingScheduledAt");
      } catch (error) {
        if (error?.code === 11000) {
          student = await Student.findOne({ organizationId: orgId, email: userEmail }).populate("enrolledCourses", "title duration trainer meetingLink meetingScheduledAt");
        } else {
          throw error;
        }
      }
    }

    if (student && (!student.userId || String(student.userId) !== String(userId))) {
      student.userId = userId;
      await student.save({ validateBeforeSave: false });
    }

    const enrolments = await Enrolment.find({ studentId: student?._id, organizationId: orgId })
      .populate("courseId", "title duration category fee meetingLink meetingScheduledAt")
      .lean();

    const enrolledCourseIds = enrolments
      .map((item) => item.courseId?._id || item.courseId)
      .filter(Boolean);

    const [payments, assignmentScoreSummary] = await Promise.all([
      Payment.find({ studentId: student?._id, organizationId: orgId })
        .sort({ paymentDate: -1 })
        .limit(5)
        .lean(),
      enrolledCourseIds.length > 0
        ? Assignment.aggregate([
            {
              $match: {
                organizationId: orgId,
                courseId: { $in: enrolledCourseIds },
                isActive: true,
              },
            },
            { $unwind: "$submissions" },
            { $match: { "submissions.grade": { $ne: null } } },
            { $addFields: { submissionStudentId: { $toString: "$submissions.studentId" } } },
            { $match: { submissionStudentId: String(req.user._id) } },
            {
              $project: {
                normalizedScore: {
                  $multiply: [{ $divide: ["$submissions.grade", "$maxMarks"] }, 100],
                },
              },
            },
            {
              $group: {
                _id: null,
                averageScore: { $avg: "$normalizedScore" },
                gradedCount: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const totalEnrolmentsCount = enrolments.length;
    const completedEnrolments = enrolments.filter((item) => item.status === "completed").length;
    const averageProgress =
      totalEnrolmentsCount > 0
        ? Number(
            (
              enrolments.reduce((sum, item) => sum + Number(item.progress || 0), 0) /
              totalEnrolmentsCount
            ).toFixed(1)
          )
        : 0;
    const completionRate =
      totalEnrolmentsCount > 0 ? Number(((completedEnrolments / totalEnrolmentsCount) * 100).toFixed(1)) : 0;

    const quizValues = enrolments
      .map((item) => (item.quizScore === null || item.quizScore === undefined ? null : Number(item.quizScore)))
      .filter((value) => Number.isFinite(value));
    const averageQuizScore =
      quizValues.length > 0
        ? Number((quizValues.reduce((sum, value) => sum + Number(value), 0) / quizValues.length).toFixed(1))
        : 0;

    const averageAttendanceMinutes =
      totalEnrolmentsCount > 0
        ? Number(
            (
              enrolments.reduce((sum, item) => sum + Number(item.attendanceMinutes || 0), 0) /
              totalEnrolmentsCount
            ).toFixed(1)
          )
        : 0;
    const attendanceScore = normalizeAttendanceScore(averageAttendanceMinutes);
    const averageAssignmentScore = assignmentScoreSummary[0]?.averageScore
      ? Number(assignmentScoreSummary[0].averageScore.toFixed(1))
      : 0;
    const gradedAssignmentCount = assignmentScoreSummary[0]?.gradedCount || 0;
    const overallScore = computeOverallPerformanceScore({
      averageProgress,
      completionRate,
      averageQuizScore,
      averageAssignmentScore,
      attendanceScore,
    });

    res.status(200).json({
      success: true,
      data: {
        student,
        enrolments,
        recentPayments: payments,
        performance: {
          averageProgress,
          completionRate,
          averageQuizScore,
          averageAssignmentScore,
          averageAttendanceMinutes,
          attendanceScore,
          overallScore,
          gradedAssignmentCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/dashboard/trainer — Trainer dashboard
const getTrainerDashboard = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthSeries = buildMonthSeries(6);
    const firstTrendMonth = new Date(monthSeries[0].year, monthSeries[0].month - 1, 1);

    const trainer = await getTrainerProfileForUser({
      organizationId: orgId,
      user: req.user,
      autoCreate: true,
    });

    if (!trainer) {
      return res.status(200).json({
        success: true,
        data: buildEmptyTrainerDashboardData(null),
      });
    }

    const assignedCourseIds = Array.isArray(trainer.assignedCourses) ? trainer.assignedCourses : [];
    const courses = await Course.find({
      organizationId: orgId,
      $or: [{ trainerId: trainer._id }, { _id: { $in: assignedCourseIds } }],
    })
      .select("title description category duration fee isActive isPublished level thumbnailUrl startDate endDate maxEnrolments videoUrl pdfUrl modules createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const courseIds = courses.map((course) => course._id);

    if (courseIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: buildEmptyTrainerDashboardData(trainer),
      });
    }

    const [
      distinctStudents,
      groupedEnrolments,
      recentEnrolments,
      ratingsByCourse,
      reactionsByCourse,
      commentsByCourse,
      paymentsByCourse,
      assignmentScoreRaw,
      enrolmentGrowthRaw,
      progressTrendRaw,
      dropOffRaw,
    ] = await Promise.all([
      Enrolment.distinct("studentId", { organizationId: orgId, courseId: { $in: courseIds } }),
      Enrolment.aggregate([
        { $match: { organizationId: orgId, courseId: { $in: courseIds } } },
        {
          $group: {
            _id: "$courseId",
            totalEnrolments: { $sum: 1 },
            activeEnrolments: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            completedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            droppedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "dropped"] }, 1, 0] } },
            suspendedEnrolments: { $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] } },
            progressSum: { $sum: "$progress" },
            averageProgress: { $avg: "$progress" },
            quizScoreSum: { $sum: { $cond: [{ $ne: ["$quizScore", null] }, "$quizScore", 0] } },
            quizScoreCount: { $sum: { $cond: [{ $ne: ["$quizScore", null] }, 1, 0] } },
            attendanceMinutesSum: { $sum: { $ifNull: ["$attendanceMinutes", 0] } },
          },
        },
      ]),
      Enrolment.find({ organizationId: orgId, courseId: { $in: courseIds } })
        .populate("studentId", "name email")
        .populate("courseId", "title category")
        .sort({ enrolmentDate: -1 })
        .limit(12)
        .lean(),
      CourseFeedback.aggregate([
        {
          $match: {
            organizationId: orgId,
            courseId: { $in: courseIds },
            rating: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$courseId",
            ratingAverage: { $avg: "$rating" },
            ratingCount: { $sum: 1 },
          },
        },
      ]),
      CourseFeedback.aggregate([
        {
          $match: {
            organizationId: orgId,
            courseId: { $in: courseIds },
            reaction: { $in: ["like", "dislike"] },
          },
        },
        {
          $group: {
            _id: { courseId: "$courseId", reaction: "$reaction" },
            count: { $sum: 1 },
          },
        },
      ]),
      CourseComment.aggregate([
        {
          $match: {
            organizationId: orgId,
            courseId: { $in: courseIds },
            isActive: true,
          },
        },
        {
          $group: {
            _id: "$courseId",
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            organizationId: orgId,
            status: "completed",
            courseId: { $in: courseIds },
          },
        },
        {
          $group: {
            _id: "$courseId",
            total: { $sum: "$amount" },
          },
        },
      ]),
      Assignment.aggregate([
        {
          $match: {
            organizationId: orgId,
            courseId: { $in: courseIds },
            isActive: true,
          },
        },
        { $unwind: "$submissions" },
        { $match: { "submissions.grade": { $ne: null } } },
        {
          $project: {
            normalizedScore: {
              $multiply: [{ $divide: ["$submissions.grade", "$maxMarks"] }, 100],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageScore: { $avg: "$normalizedScore" },
            gradedCount: { $sum: 1 },
          },
        },
      ]),
      Enrolment.aggregate([
        {
          $match: {
            organizationId: orgId,
            courseId: { $in: courseIds },
            createdAt: { $gte: firstTrendMonth },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Enrolment.aggregate([
        {
          $match: {
            organizationId: orgId,
            courseId: { $in: courseIds },
            updatedAt: { $gte: firstTrendMonth },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$updatedAt" },
              month: { $month: "$updatedAt" },
            },
            averageProgress: { $avg: "$progress" },
          },
        },
      ]),
      Enrolment.aggregate([
        {
          $match: {
            organizationId: orgId,
            courseId: { $in: courseIds },
            status: { $ne: "completed" },
            progress: { $lt: 40 },
          },
        },
        {
          $group: {
            _id: "$courseId",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const groupedMap = new Map(groupedEnrolments.map((entry) => [String(entry._id), entry]));
    const ratingsMap = new Map(
      ratingsByCourse.map((entry) => [
        String(entry._id),
        {
          ratingAverage: entry.ratingAverage ? Number(entry.ratingAverage.toFixed(1)) : 0,
          ratingCount: entry.ratingCount || 0,
        },
      ])
    );
    const commentsMap = new Map(commentsByCourse.map((entry) => [String(entry._id), entry.count || 0]));
    const paymentsMap = new Map(paymentsByCourse.map((entry) => [String(entry._id), entry.total || 0]));
    const dropOffMap = new Map(dropOffRaw.map((entry) => [String(entry._id), entry.count || 0]));
    const reactionsMap = new Map();
    reactionsByCourse.forEach((entry) => {
      const courseId = String(entry._id?.courseId);
      const reaction = entry._id?.reaction;
      const current = reactionsMap.get(courseId) || { likes: 0, dislikes: 0 };
      if (reaction === "like") current.likes = entry.count || 0;
      if (reaction === "dislike") current.dislikes = entry.count || 0;
      reactionsMap.set(courseId, current);
    });

    const enrolmentGrowthMap = new Map(
      enrolmentGrowthRaw.map((entry) => [`${entry._id.year}-${String(entry._id.month).padStart(2, "0")}`, entry.count || 0])
    );
    const progressTrendMap = new Map(
      progressTrendRaw.map((entry) => [
        `${entry._id.year}-${String(entry._id.month).padStart(2, "0")}`,
        entry.averageProgress ? Number(entry.averageProgress.toFixed(1)) : 0,
      ])
    );

    const coursePerformance = courses
      .map((course) => {
        const courseKey = String(course._id);
        const stat = groupedMap.get(String(course._id));
        const rating = ratingsMap.get(courseKey) || { ratingAverage: 0, ratingCount: 0 };
        const reactions = reactionsMap.get(courseKey) || { likes: 0, dislikes: 0 };
        const commentsCount = commentsMap.get(courseKey) || 0;
        const revenue = paymentsMap.get(courseKey) || 0;
        const totalEnrolments = stat?.totalEnrolments || 0;
        const completedEnrolments = stat?.completedEnrolments || 0;
        const completionRate = totalEnrolments > 0 ? Number(((completedEnrolments / totalEnrolments) * 100).toFixed(1)) : 0;
        const dropOffCount = dropOffMap.get(courseKey) || 0;
        const dropOffRate = totalEnrolments > 0 ? Number(((dropOffCount / totalEnrolments) * 100).toFixed(1)) : 0;
        const quizScoreCount = stat?.quizScoreCount || 0;
        const quizScoreSum = stat?.quizScoreSum || 0;
        const averageQuizScore = quizScoreCount > 0 ? Number((quizScoreSum / quizScoreCount).toFixed(1)) : 0;
        const attendanceMinutesSum = stat?.attendanceMinutesSum || 0;
        const averageAttendanceMinutes = totalEnrolments > 0
          ? Number((attendanceMinutesSum / totalEnrolments).toFixed(1))
          : 0;

        return {
          ...course,
          hasVideo: Boolean(course.videoUrl),
          hasPdf: Boolean(course.pdfUrl),
          hasThumbnail: Boolean(course.thumbnailUrl),
          totalEnrolments,
          activeEnrolments: stat?.activeEnrolments || 0,
          completedEnrolments,
          droppedEnrolments: stat?.droppedEnrolments || 0,
          suspendedEnrolments: stat?.suspendedEnrolments || 0,
          averageProgress: stat?.averageProgress ? Number(stat.averageProgress.toFixed(1)) : 0,
          completionRate,
          ratingAverage: rating.ratingAverage,
          ratingCount: rating.ratingCount,
          likes: reactions.likes,
          dislikes: reactions.dislikes,
          commentsCount,
          revenue,
          averageQuizScore,
          averageAttendanceMinutes,
          dropOffCount,
          dropOffRate,
          progressSum: stat?.progressSum || 0,
          quizScoreSum,
          quizScoreCount,
          attendanceMinutesSum,
        };
      })
      .sort((a, b) => {
        if (b.activeEnrolments !== a.activeEnrolments) return b.activeEnrolments - a.activeEnrolments;
        return b.totalEnrolments - a.totalEnrolments;
      });

    const totals = coursePerformance.reduce(
      (acc, item) => {
        acc.totalEnrolments += item.totalEnrolments;
        acc.activeEnrolments += item.activeEnrolments;
        acc.completedEnrolments += item.completedEnrolments;
        acc.droppedEnrolments += item.droppedEnrolments;
        acc.suspendedEnrolments += item.suspendedEnrolments;
        acc.totalProgress += item.progressSum;
        acc.totalRevenue += item.revenue || 0;
        acc.totalLikes += item.likes || 0;
        acc.totalDislikes += item.dislikes || 0;
        acc.totalComments += item.commentsCount || 0;
        acc.totalRatingCount += item.ratingCount || 0;
        acc.weightedRatingSum += (item.ratingAverage || 0) * (item.ratingCount || 0);
        acc.totalQuizScore += item.quizScoreSum || 0;
        acc.totalQuizCount += item.quizScoreCount || 0;
        acc.totalAttendanceMinutes += item.attendanceMinutesSum || 0;
        return acc;
      },
      {
        totalEnrolments: 0,
        activeEnrolments: 0,
        completedEnrolments: 0,
        droppedEnrolments: 0,
        suspendedEnrolments: 0,
        totalProgress: 0,
        totalRevenue: 0,
        totalLikes: 0,
        totalDislikes: 0,
        totalComments: 0,
        totalRatingCount: 0,
        weightedRatingSum: 0,
        totalQuizScore: 0,
        totalQuizCount: 0,
        totalAttendanceMinutes: 0,
      }
    );

    const payloadCoursePerformance = coursePerformance.map(
      ({ progressSum, quizScoreSum, quizScoreCount, attendanceMinutesSum, ...item }) => item
    );
    const upcomingCourses = payloadCoursePerformance
      .filter((course) => course.startDate && new Date(course.startDate) >= todayStart)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);

    const enrolmentsPerCourse = [...payloadCoursePerformance]
      .sort((a, b) => b.totalEnrolments - a.totalEnrolments)
      .map((course) => ({
        courseId: course._id,
        title: course.title,
        enrolments: course.totalEnrolments,
      }));

    const enrolmentGrowth = monthSeries.map((monthEntry) => ({
      period: monthEntry.label,
      count: enrolmentGrowthMap.get(monthEntry.key) || 0,
    }));

    const progressTrend = monthSeries.map((monthEntry) => ({
      period: monthEntry.label,
      averageProgress: progressTrendMap.get(monthEntry.key) || 0,
    }));

    const dropOffByCourse = [...payloadCoursePerformance]
      .sort((a, b) => b.dropOffRate - a.dropOffRate)
      .map((course) => ({
        courseId: course._id,
        title: course.title,
        dropOffCount: course.dropOffCount || 0,
        dropOffRate: course.dropOffRate || 0,
      }));

    const averageCompletionRate =
      totals.totalEnrolments > 0 ? Number(((totals.completedEnrolments / totals.totalEnrolments) * 100).toFixed(1)) : 0;
    const engagementAverageRating =
      totals.totalRatingCount > 0 ? Number((totals.weightedRatingSum / totals.totalRatingCount).toFixed(1)) : 0;
    const averageQuizScore =
      totals.totalQuizCount > 0 ? Number((totals.totalQuizScore / totals.totalQuizCount).toFixed(1)) : 0;
    const averageAttendanceMinutes =
      totals.totalEnrolments > 0 ? Number((totals.totalAttendanceMinutes / totals.totalEnrolments).toFixed(1)) : 0;
    const attendanceScore = normalizeAttendanceScore(averageAttendanceMinutes);
    const averageAssignmentScore = assignmentScoreRaw[0]?.averageScore
      ? Number(assignmentScoreRaw[0].averageScore.toFixed(1))
      : 0;
    const gradedAssignmentCount = assignmentScoreRaw[0]?.gradedCount || 0;
    const overallPerformanceScore = computeOverallPerformanceScore({
      averageProgress: totals.totalEnrolments > 0 ? Number((totals.totalProgress / totals.totalEnrolments).toFixed(1)) : 0,
      completionRate: averageCompletionRate,
      averageQuizScore,
      averageAssignmentScore,
      attendanceScore,
    });

    res.status(200).json({
      success: true,
      data: {
        trainer: {
          _id: trainer._id,
          name: trainer.name,
          email: trainer.email,
          specialization: trainer.specialization,
          qualifications: trainer.qualifications,
          isActive: trainer.isActive,
        },
        stats: {
          totalCourses: payloadCoursePerformance.length,
          activeCourses: payloadCoursePerformance.filter((course) => course.isActive).length,
          publishedCourses: payloadCoursePerformance.filter((course) => course.isPublished).length,
          totalStudents: distinctStudents.length,
          totalEnrolments: totals.totalEnrolments,
          activeEnrolments: totals.activeEnrolments,
          completedEnrolments: totals.completedEnrolments,
          droppedEnrolments: totals.droppedEnrolments,
          suspendedEnrolments: totals.suspendedEnrolments,
          averageProgress: totals.totalEnrolments > 0 ? Number((totals.totalProgress / totals.totalEnrolments).toFixed(1)) : 0,
          averageCompletionRate,
          totalRevenue: totals.totalRevenue,
          videosUploaded: payloadCoursePerformance.filter((course) => course.hasVideo).length,
          pdfsUploaded: payloadCoursePerformance.filter((course) => course.hasPdf).length,
        },
        performance: {
          averageProgress: totals.totalEnrolments > 0 ? Number((totals.totalProgress / totals.totalEnrolments).toFixed(1)) : 0,
          completionRate: averageCompletionRate,
          averageQuizScore,
          averageAssignmentScore,
          averageAttendanceMinutes,
          attendanceScore,
          overallScore: overallPerformanceScore,
          gradedAssignmentCount,
        },
        analytics: {
          enrolmentsPerCourse,
          enrolmentGrowth,
          progressTrend,
          dropOffByCourse,
          engagementTotals: {
            likes: totals.totalLikes,
            dislikes: totals.totalDislikes,
            comments: totals.totalComments,
            ratingAverage: engagementAverageRating,
            ratingCount: totals.totalRatingCount,
          },
        },
        coursePerformance: payloadCoursePerformance,
        recentEnrolments: recentEnrolments.map((enrolment) => ({
          _id: enrolment._id,
          status: enrolment.status,
          progress: enrolment.progress || 0,
          quizScore: enrolment.quizScore ?? null,
          attendanceMinutes: enrolment.attendanceMinutes || 0,
          enrolmentDate: enrolment.enrolmentDate,
          completionDate: enrolment.completionDate,
          studentId: enrolment.studentId
            ? {
                _id: enrolment.studentId._id,
                name: enrolment.studentId.name,
                email: enrolment.studentId.email,
              }
            : null,
          courseId: enrolment.courseId
            ? {
                _id: enrolment.courseId._id,
                title: enrolment.courseId.title,
                category: enrolment.courseId.category,
              }
            : null,
        })),
        upcomingCourses,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/dashboard/finance — Finance dashboard
const getFinanceDashboard = async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;

    const [totalRevenue, monthlyRevenue, paymentsByMethod, recentPayments] = await Promise.all([
      Payment.aggregate([
        { $match: { organizationId: orgId, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            organizationId: orgId,
            status: "completed",
            paymentDate: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { organizationId: orgId, status: "completed" } },
        { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.find({ organizationId: orgId })
        .populate("studentId", "name email")
        .populate("courseId", "title")
        .sort({ paymentDate: -1 })
        .limit(10)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        paymentsByMethod,
        recentPayments,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminDashboard, getStudentDashboard, getTrainerDashboard, getFinanceDashboard };
