const Student = require("../models/Student");
const User = require("../models/User");
const { logActivity } = require("../middlewares/activityLogger");

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

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeNullable = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const validateStudentUser = ({ user, organizationId }) => {
  if (!user) return null;
  if (String(user.organizationId) !== String(organizationId)) {
    return "A user with this email belongs to another organization.";
  }
  if (user.role !== "student") {
    return `A user with this email already exists with role "${user.role}". Use a student role account.`;
  }
  return null;
};

const syncStudentUser = async ({ user, student }) => {
  user.name = student.name;
  user.email = student.email;
  user.isActive = student.isActive;
  if (user.role !== "student") user.role = "student";
  if (!user.organizationId || String(user.organizationId) !== String(student.organizationId)) {
    user.organizationId = student.organizationId;
  }
  await user.save({ validateBeforeSave: false });
};

const getStudents = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "", isActive } = req.query;
    const orgId = req.user.organizationId;

    const filter = { organizationId: orgId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate("userId", "name email role isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Student.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .populate("enrolledCourses", "title duration fee")
      .populate("userId", "name email role isActive");

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    res.status(200).json({ success: true, data: { student } });
  } catch (error) {
    next(error);
  }
};

const createStudent = async (req, res, next) => {
  try {
    const { name, email, phone, address, dateOfBirth, gender } = req.body;
    const orgId = req.user.organizationId;
    const normalizedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedName || !normalizedEmail) {
      return res.status(400).json({ success: false, message: "Name and email are required." });
    }

    const exists = await Student.findOne({ email: normalizedEmail, organizationId: orgId });
    if (exists) {
      return res.status(409).json({ success: false, message: "A student with this email already exists." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    const userValidationError = validateStudentUser({ user, organizationId: orgId });
    if (userValidationError) {
      return res.status(409).json({ success: false, message: userValidationError });
    }

    if (user?._id) {
      const linkedElsewhere = await Student.findOne({ organizationId: orgId, userId: user._id });
      if (linkedElsewhere) {
        return res.status(409).json({ success: false, message: "This student login is already linked to another student profile." });
      }
    }

    const student = await Student.create({
      organizationId: orgId,
      userId: user?._id || null,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizeNullable(phone),
      address: normalizeNullable(address),
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      isActive: user ? Boolean(user.isActive) : true,
    });

    if (user) {
      await syncStudentUser({ user, student });
    }

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "CREATE_STUDENT",
      module: "student",
      description: `Student created: ${student.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: "Student created successfully.", data: { student } });
  } catch (error) {
    next(error);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const { name, email, phone, address, dateOfBirth, gender, isActive } = req.body;
    const orgId = req.user.organizationId;

    const student = await Student.findOne({
      _id: req.params.id,
      organizationId: orgId,
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (name !== undefined) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: "Student name cannot be empty." });
      }
      student.name = normalizedName;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ success: false, message: "Student email cannot be empty." });
      }

      if (normalizedEmail !== student.email) {
        const existingStudent = await Student.findOne({
          organizationId: orgId,
          email: normalizedEmail,
          _id: { $ne: student._id },
        });
        if (existingStudent) {
          return res.status(409).json({ success: false, message: "Another student profile already uses this email." });
        }
        student.email = normalizedEmail;
      }
    }

    if (phone !== undefined) student.phone = normalizeNullable(phone);
    if (address !== undefined) student.address = normalizeNullable(address);
    if (dateOfBirth !== undefined) student.dateOfBirth = dateOfBirth || null;
    if (gender !== undefined) student.gender = gender || null;
    if (isActive !== undefined) student.isActive = toBoolean(isActive, student.isActive);

    let linkedUser = null;
    if (student.userId) {
      linkedUser = await User.findById(student.userId);
    }

    const userWithStudentEmail = await User.findOne({ email: student.email });
    if (linkedUser && userWithStudentEmail && String(linkedUser._id) !== String(userWithStudentEmail._id)) {
      return res.status(409).json({
        success: false,
        message: "This email is already used by another user account.",
      });
    }

    if (!linkedUser && userWithStudentEmail) linkedUser = userWithStudentEmail;

    if (linkedUser) {
      const userValidationError = validateStudentUser({ user: linkedUser, organizationId: orgId });
      if (userValidationError) {
        return res.status(409).json({ success: false, message: userValidationError });
      }
      student.userId = linkedUser._id;
    } else {
      student.userId = null;
    }

    await student.save();

    if (linkedUser) {
      await syncStudentUser({ user: linkedUser, student });
    }

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "UPDATE_STUDENT",
      module: "student",
      description: `Student updated: ${student.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Student updated successfully.", data: { student } });
  } catch (error) {
    next(error);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    student.isActive = false;
    await student.save();

    if (student.userId) {
      await User.findOneAndUpdate(
        { _id: student.userId, organizationId: req.user.organizationId, role: "student" },
        { isActive: false }
      );
    } else {
      await User.findOneAndUpdate(
        { email: student.email, organizationId: req.user.organizationId, role: "student" },
        { isActive: false }
      );
    }

    await logActivity({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      action: "DELETE_STUDENT",
      module: "student",
      description: `Student deactivated: ${student.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Student deactivated successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStudents, getStudentById, createStudent, updateStudent, deleteStudent };
