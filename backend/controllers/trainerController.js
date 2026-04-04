const Trainer = require("../models/Trainer");
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

const validateTrainerUser = ({ user, organizationId }) => {
  if (!user) return null;
  if (String(user.organizationId) !== String(organizationId)) {
    return "A user with this email belongs to another organization.";
  }
  if (user.role !== "trainer") {
    return `A user with this email already exists with role "${user.role}". Use a trainer role account.`;
  }
  return null;
};

const syncTrainerUser = async ({ user, trainer }) => {
  user.name = trainer.name;
  user.email = trainer.email;
  user.isActive = trainer.isActive;
  if (user.role !== "trainer") user.role = "trainer";
  if (!user.organizationId || String(user.organizationId) !== String(trainer.organizationId)) {
    user.organizationId = trainer.organizationId;
  }
  await user.save({ validateBeforeSave: false });
};

const getTrainers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "", isActive } = req.query;
    const orgId = req.user.organizationId;

    const filter = { organizationId: orgId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [trainers, total] = await Promise.all([
      Trainer.find(filter)
        .populate("assignedCourses", "title")
        .populate("userId", "name email role isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Trainer.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        trainers,
        pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTrainerById = async (req, res, next) => {
  try {
    const trainer = await Trainer.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .populate("assignedCourses", "title duration fee")
      .populate("userId", "name email role isActive");

    if (!trainer) return res.status(404).json({ success: false, message: "Trainer not found." });

    res.status(200).json({ success: true, data: { trainer } });
  } catch (error) {
    next(error);
  }
};

const createTrainer = async (req, res, next) => {
  try {
    const { name, email, phone, specialization, qualifications } = req.body;
    const orgId = req.user.organizationId;
    const normalizedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedName || !normalizedEmail) {
      return res.status(400).json({ success: false, message: "Name and email are required." });
    }

    const exists = await Trainer.findOne({ email: normalizedEmail, organizationId: orgId });
    if (exists) {
      return res.status(409).json({ success: false, message: "A trainer with this email already exists." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    const userValidationError = validateTrainerUser({ user, organizationId: orgId });
    if (userValidationError) {
      return res.status(409).json({ success: false, message: userValidationError });
    }

    if (user?._id) {
      const linkedElsewhere = await Trainer.findOne({ organizationId: orgId, userId: user._id });
      if (linkedElsewhere) {
        return res.status(409).json({ success: false, message: "This trainer login is already linked to another trainer profile." });
      }
    }

    const trainer = await Trainer.create({
      organizationId: orgId,
      userId: user?._id || null,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizeNullable(phone),
      specialization: normalizeNullable(specialization),
      qualifications: normalizeNullable(qualifications),
      isActive: user ? Boolean(user.isActive) : true,
    });

    if (user) {
      await syncTrainerUser({ user, trainer });
    }

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "CREATE_TRAINER",
      module: "trainer",
      description: `Trainer created: ${trainer.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: "Trainer created successfully.", data: { trainer } });
  } catch (error) {
    next(error);
  }
};

const updateTrainer = async (req, res, next) => {
  try {
    const { name, email, phone, specialization, qualifications, isActive } = req.body;
    const orgId = req.user.organizationId;

    const trainer = await Trainer.findOne({
      _id: req.params.id,
      organizationId: orgId,
    });

    if (!trainer) return res.status(404).json({ success: false, message: "Trainer not found." });

    if (name !== undefined) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: "Trainer name cannot be empty." });
      }
      trainer.name = normalizedName;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ success: false, message: "Trainer email cannot be empty." });
      }

      if (normalizedEmail !== trainer.email) {
        const existingTrainer = await Trainer.findOne({
          organizationId: orgId,
          email: normalizedEmail,
          _id: { $ne: trainer._id },
        });
        if (existingTrainer) {
          return res.status(409).json({ success: false, message: "Another trainer profile already uses this email." });
        }
        trainer.email = normalizedEmail;
      }
    }

    if (phone !== undefined) trainer.phone = normalizeNullable(phone);
    if (specialization !== undefined) trainer.specialization = normalizeNullable(specialization);
    if (qualifications !== undefined) trainer.qualifications = normalizeNullable(qualifications);
    if (isActive !== undefined) trainer.isActive = toBoolean(isActive, trainer.isActive);

    let linkedUser = null;
    if (trainer.userId) {
      linkedUser = await User.findById(trainer.userId);
    }

    const userWithTrainerEmail = await User.findOne({ email: trainer.email });
    if (linkedUser && userWithTrainerEmail && String(linkedUser._id) !== String(userWithTrainerEmail._id)) {
      return res.status(409).json({
        success: false,
        message: "This email is already used by another user account.",
      });
    }

    if (!linkedUser && userWithTrainerEmail) linkedUser = userWithTrainerEmail;

    if (linkedUser) {
      const userValidationError = validateTrainerUser({ user: linkedUser, organizationId: orgId });
      if (userValidationError) {
        return res.status(409).json({ success: false, message: userValidationError });
      }
      trainer.userId = linkedUser._id;
    } else {
      trainer.userId = null;
    }

    await trainer.save();

    if (linkedUser) {
      await syncTrainerUser({ user: linkedUser, trainer });
    }

    await logActivity({
      userId: req.user._id,
      organizationId: orgId,
      action: "UPDATE_TRAINER",
      module: "trainer",
      description: `Trainer updated: ${trainer.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Trainer updated successfully.", data: { trainer } });
  } catch (error) {
    next(error);
  }
};

const deleteTrainer = async (req, res, next) => {
  try {
    const trainer = await Trainer.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!trainer) return res.status(404).json({ success: false, message: "Trainer not found." });

    trainer.isActive = false;
    await trainer.save();

    if (trainer.userId) {
      await User.findOneAndUpdate(
        { _id: trainer.userId, organizationId: req.user.organizationId, role: "trainer" },
        { isActive: false }
      );
    } else {
      await User.findOneAndUpdate(
        { email: trainer.email, organizationId: req.user.organizationId, role: "trainer" },
        { isActive: false }
      );
    }

    await logActivity({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      action: "DELETE_TRAINER",
      module: "trainer",
      description: `Trainer deactivated: ${trainer.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: "Trainer deactivated successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTrainers, getTrainerById, createTrainer, updateTrainer, deleteTrainer };
