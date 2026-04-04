const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Student = require("../models/Student");
const Course = require("../models/Course");
const Enrolment = require("../models/Enrolment");
const { logActivity } = require("../middlewares/activityLogger");

const parseAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ""));

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

const getRazorpayCredentials = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
};

const razorpayApiRequest = async ({ credentials, path, method = "GET", payload }) => {
  const authHeader = `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64")}`;
  const endpoint = `https://api.razorpay.com/v1/${path}`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const rawText = await response.text();
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }
  }

  if (!response.ok) {
    const description = data?.error?.description || data?.error?.reason || "Razorpay request failed.";
    throw Object.assign(new Error(description), {
      statusCode: 502,
      gatewayPayload: data,
      gatewayStatus: response.status,
    });
  }

  return data;
};

const ensureCourseAvailableForEnrollment = async ({ organizationId, courseId }) => {
  const course = await Course.findOne({
    _id: courseId,
    organizationId,
    isActive: true,
  });

  if (!course) {
    throw Object.assign(new Error("Course not found."), { statusCode: 404 });
  }

  if (course.maxEnrolments) {
    const count = await Enrolment.countDocuments({
      organizationId,
      courseId: course._id,
      status: "active",
    });

    if (count >= course.maxEnrolments) {
      throw Object.assign(new Error("This course has reached maximum enrolment capacity."), { statusCode: 400 });
    }
  }

  return course;
};

const getPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, studentId, courseId, status, method } = req.query;
    const orgId = req.user.organizationId;

    const filter = { organizationId: orgId };
    if (studentId) filter.studentId = studentId;
    if (courseId) filter.courseId = courseId;
    if (status) filter.status = status;
    if (method) filter.method = method;

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total, totalAmount] = await Promise.all([
      Payment.find(filter)
        .populate("studentId", "name email")
        .populate("courseId", "title")
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([
        { $match: { ...filter, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        summary: { totalRevenue: totalAmount[0]?.total || 0, totalPayments: total },
        pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, organizationId: req.user.organizationId })
      .populate("studentId", "name email phone")
      .populate("courseId", "title fee");

    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });
    res.status(200).json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};

const createPayment = async (req, res, next) => {
  try {
    const { studentId, courseId, amount, method, transactionId, paymentDate, notes, receiptNumber } = req.body;
    const orgId = req.user.organizationId;
    const parsedAmount = parseAmount(amount);
    const parsedPaymentDate = paymentDate ? parseDateOrNull(paymentDate) : new Date();

    if (!studentId || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: "studentId and amount are required." });
    }
    if (parsedAmount === null || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: "amount must be a positive number." });
    }
    if (!parsedPaymentDate) {
      return res.status(400).json({ success: false, message: "paymentDate must be a valid date." });
    }

    const [student, course] = await Promise.all([
      Student.findOne({ _id: studentId, organizationId: orgId }),
      courseId ? Course.findOne({ _id: courseId, organizationId: orgId }) : null,
    ]);

    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    if (courseId && !course) return res.status(404).json({ success: false, message: "Course not found." });

    const payment = await Payment.create({
      organizationId: orgId,
      studentId,
      courseId: courseId || null,
      amount: parsedAmount,
      method: method || "cash",
      transactionId: transactionId ? String(transactionId).trim() : null,
      paymentDate: parsedPaymentDate,
      notes: notes ? String(notes).trim() : null,
      receiptNumber: receiptNumber ? String(receiptNumber).trim() : null,
    });

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "CREATE_PAYMENT",
      module: "payment",
      description: `Payment of INR ${parsedAmount} recorded for ${student.name}`,
      ipAddress: req.ip,
    });

    const populated = await payment.populate([
      { path: "studentId", select: "name email" },
      { path: "courseId", select: "title" },
    ]);

    res.status(201).json({ success: true, message: "Payment recorded successfully.", data: { payment: populated } });
  } catch (error) {
    next(error);
  }
};

const updatePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });

    const fields = ["method", "status", "transactionId", "notes", "receiptNumber"];
    fields.forEach((fieldName) => {
      if (req.body[fieldName] !== undefined) payment[fieldName] = req.body[fieldName];
    });

    if (req.body.amount !== undefined) {
      const parsedAmount = parseAmount(req.body.amount);
      if (parsedAmount === null || parsedAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "amount must be a valid number greater than or equal to 0.",
        });
      }
      payment.amount = parsedAmount;
    }

    if (req.body.paymentDate !== undefined) {
      if (req.body.paymentDate === null || req.body.paymentDate === "") {
        payment.paymentDate = new Date();
      } else {
        const parsedPaymentDate = parseDateOrNull(req.body.paymentDate);
        if (!parsedPaymentDate) {
          return res.status(400).json({ success: false, message: "paymentDate must be a valid date." });
        }
        payment.paymentDate = parsedPaymentDate;
      }
    }

    await payment.save();
    res.status(200).json({ success: true, message: "Payment updated successfully.", data: { payment } });
  } catch (error) {
    next(error);
  }
};

const deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });

    await Payment.deleteOne({ _id: req.params.id, organizationId: req.user.organizationId });
    res.status(200).json({ success: true, message: "Payment deleted successfully." });
  } catch (error) {
    next(error);
  }
};

const createRazorpayOrder = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    const orgId = req.user.organizationId;

    if (!courseId || !mongoose.Types.ObjectId.isValid(String(courseId))) {
      return res.status(400).json({ success: false, message: "Valid courseId is required." });
    }

    const credentials = getRazorpayCredentials();
    if (!credentials) {
      return res.status(503).json({
        success: false,
        message: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend .env.",
      });
    }

    const student = await getStudentProfileForUser({
      organizationId: orgId,
      user: req.user,
      autoCreate: true,
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found." });
    }

    const [course, existingEnrolment] = await Promise.all([
      ensureCourseAvailableForEnrollment({ organizationId: orgId, courseId }),
      Enrolment.findOne({ organizationId: orgId, studentId: student._id, courseId }),
    ]);

    if (existingEnrolment) {
      return res.status(409).json({ success: false, message: "You are already enrolled in this course." });
    }

    const amount = Number(course.fee || 0);
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "This course has no payable fee. Use direct enrollment.",
      });
    }

    const amountInPaise = Math.round(amount * 100);
    if (!Number.isInteger(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({ success: false, message: "Invalid course fee for online payment." });
    }

    const receipt = `rcpt_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`.slice(0, 40);
    const order = await razorpayApiRequest({
      credentials,
      path: "orders",
      method: "POST",
      payload: {
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          organizationId: String(orgId),
          courseId: String(course._id),
          studentId: String(student._id),
        },
      },
    });

    await Payment.create({
      organizationId: orgId,
      studentId: student._id,
      courseId: course._id,
      amount,
      method: "razorpay",
      status: "pending",
      transactionId: order.id,
      paymentDate: new Date(),
      notes: "Razorpay order created for enrollment",
      gateway: "razorpay",
      gatewayOrderId: order.id,
    });

    return res.status(201).json({
      success: true,
      data: {
        keyId: credentials.keyId,
        order,
        course: {
          _id: course._id,
          title: course.title,
          amount,
        },
        student: {
          name: student.name,
          email: isValidEmail(student.email) ? student.email : req.user.email || "",
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const verifyRazorpayPaymentAndEnroll = async (req, res, next) => {
  try {
    const { courseId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const orgId = req.user.organizationId;

    if (!courseId || !mongoose.Types.ObjectId.isValid(String(courseId))) {
      return res.status(400).json({ success: false, message: "Valid courseId is required." });
    }
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required.",
      });
    }

    const credentials = getRazorpayCredentials();
    if (!credentials) {
      return res.status(503).json({
        success: false,
        message: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend .env.",
      });
    }

    const student = await getStudentProfileForUser({
      organizationId: orgId,
      user: req.user,
      autoCreate: true,
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found." });
    }

    const pendingPayment = await Payment.findOne({
      organizationId: orgId,
      studentId: student._id,
      courseId,
      status: "pending",
      gateway: "razorpay",
      gatewayOrderId: razorpayOrderId,
    }).sort({ createdAt: -1 });

    if (!pendingPayment) {
      const alreadyProcessed = await Payment.findOne({
        organizationId: orgId,
        studentId: student._id,
        courseId,
        gateway: "razorpay",
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId,
        status: "completed",
      });

      if (alreadyProcessed) {
        return res.status(200).json({
          success: true,
          message: "Payment already verified.",
          data: { payment: alreadyProcessed },
        });
      }

      return res.status(404).json({ success: false, message: "Pending payment order not found." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", credentials.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      pendingPayment.status = "failed";
      pendingPayment.gatewayPaymentId = razorpayPaymentId;
      pendingPayment.gatewaySignature = razorpaySignature;
      pendingPayment.notes = "Razorpay signature verification failed";
      await pendingPayment.save();

      return res.status(400).json({ success: false, message: "Payment verification failed (signature mismatch)." });
    }

    const paymentDetails = await razorpayApiRequest({
      credentials,
      path: `payments/${razorpayPaymentId}`,
      method: "GET",
    });

    if (paymentDetails.order_id !== razorpayOrderId) {
      pendingPayment.status = "failed";
      pendingPayment.gatewayPaymentId = razorpayPaymentId;
      pendingPayment.gatewaySignature = razorpaySignature;
      pendingPayment.notes = "Razorpay payment belongs to a different order";
      await pendingPayment.save();

      return res.status(400).json({ success: false, message: "Payment verification failed (invalid order mapping)." });
    }

    if (!["captured", "authorized"].includes(String(paymentDetails.status || "").toLowerCase())) {
      pendingPayment.status = "failed";
      pendingPayment.gatewayPaymentId = razorpayPaymentId;
      pendingPayment.gatewaySignature = razorpaySignature;
      pendingPayment.notes = `Razorpay payment status: ${paymentDetails.status || "unknown"}`;
      await pendingPayment.save();

      return res.status(400).json({ success: false, message: "Payment is not captured/authorized yet." });
    }

    const expectedAmountInPaise = Math.round(Number(pendingPayment.amount || 0) * 100);
    if (Number(paymentDetails.amount || 0) !== expectedAmountInPaise) {
      pendingPayment.status = "failed";
      pendingPayment.gatewayPaymentId = razorpayPaymentId;
      pendingPayment.gatewaySignature = razorpaySignature;
      pendingPayment.notes = "Razorpay amount mismatch";
      await pendingPayment.save();

      return res.status(400).json({ success: false, message: "Payment amount mismatch." });
    }

    const [course, existingEnrolment] = await Promise.all([
      ensureCourseAvailableForEnrollment({ organizationId: orgId, courseId }),
      Enrolment.findOne({ organizationId: orgId, studentId: student._id, courseId }),
    ]);

    let enrolment = existingEnrolment;

    if (!enrolment) {
      enrolment = await Enrolment.create({
        organizationId: orgId,
        studentId: student._id,
        courseId: course._id,
      });

      await Student.findByIdAndUpdate(student._id, { $addToSet: { enrolledCourses: course._id } });
    }

    pendingPayment.status = "completed";
    pendingPayment.method = "razorpay";
    pendingPayment.transactionId = razorpayPaymentId;
    pendingPayment.paymentDate = new Date();
    pendingPayment.gatewayPaymentId = razorpayPaymentId;
    pendingPayment.gatewaySignature = razorpaySignature;
    pendingPayment.notes = `Razorpay payment successful for course enrollment (${course.title})`;
    await pendingPayment.save();

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "STUDENT_RAZORPAY_ENROLLMENT",
      module: "payment",
      description: `Student ${student.name} completed Razorpay payment and enrolled in ${course.title}`,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: existingEnrolment
        ? "Payment verified. You are already enrolled in this course."
        : "Payment verified and enrollment completed.",
      data: {
        payment: pendingPayment,
        enrolment,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  createRazorpayOrder,
  verifyRazorpayPaymentAndEnroll,
};
