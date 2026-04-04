const Organization = require("../models/Organization");
const User = require("../models/User");
const Student = require("../models/Student");
const Trainer = require("../models/Trainer");
const { logActivity } = require("../middlewares/activityLogger");

// @route GET /api/organizations/me — Get own organization
const getMyOrganization = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.user.organizationId).populate("adminId", "name email");
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });
    res.status(200).json({ success: true, data: { organization: org } });
  } catch (error) { next(error); }
};

// @route PUT /api/organizations/me — Update own organization
const updateMyOrganization = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: "Organization name cannot be empty." });
      }
      org.name = normalizedName;
    }
    if (phone !== undefined) org.phone = phone;
    if (address !== undefined) org.address = address;

    await org.save();
    await logActivity({ userId: req.user._id, organizationId: org._id, action: "UPDATE_ORGANIZATION", module: "organization", description: `Organization updated: ${org.name}`, ipAddress: req.ip });

    res.status(200).json({ success: true, message: "Organization updated successfully.", data: { organization: org } });
  } catch (error) { next(error); }
};

// @route GET /api/organizations/users — Get all users in org
const getOrganizationUsers = async (req, res, next) => {
  try {
    const users = await User.find({ organizationId: req.user.organizationId, role: { $ne: "super_admin" } })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const trainerUserIds = users.filter((item) => item.role === "trainer").map((item) => item._id);
    const studentUserIds = users.filter((item) => item.role === "student").map((item) => item._id);

    const [trainerProfiles, studentProfiles] = await Promise.all([
      trainerUserIds.length > 0
        ? Trainer.find({ organizationId: req.user.organizationId, userId: { $in: trainerUserIds } })
            .select("_id userId")
            .lean()
        : [],
      studentUserIds.length > 0
        ? Student.find({ organizationId: req.user.organizationId, userId: { $in: studentUserIds } })
            .select("_id userId")
            .lean()
        : [],
    ]);

    const trainerProfileMap = new Map(trainerProfiles.map((item) => [String(item.userId), String(item._id)]));
    const studentProfileMap = new Map(studentProfiles.map((item) => [String(item.userId), String(item._id)]));

    const usersWithProfileLinks = users.map((user) => {
      if (user.role === "trainer") {
        const profileId = trainerProfileMap.get(String(user._id)) || null;
        return { ...user, profileLinked: Boolean(profileId), profileId };
      }

      if (user.role === "student") {
        const profileId = studentProfileMap.get(String(user._id)) || null;
        return { ...user, profileLinked: Boolean(profileId), profileId };
      }

      return { ...user, profileLinked: null, profileId: null };
    });

    res.status(200).json({ success: true, data: { users: usersWithProfileLinks, total: users.length } });
  } catch (error) { next(error); }
};

// @route POST /api/organizations/users — Create user in org
const createOrganizationUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const orgId = req.user.organizationId;
    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "name, email, password, and role are required." });
    }

    const allowedRoles = ["trainer", "student", "finance"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${allowedRoles.join(", ")}` });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ success: false, message: "A user with this email already exists." });

    const user = await User.create({ name: normalizedName, email: normalizedEmail, password, role, organizationId: orgId });

    try {
      if (role === "student") {
        await Student.findOneAndUpdate(
          { organizationId: orgId, email: normalizedEmail },
          {
            $set: {
              userId: user._id,
              name: normalizedName || "Student",
              email: normalizedEmail,
              isActive: user.isActive,
            },
            $setOnInsert: {
              organizationId: orgId,
              enrolledCourses: [],
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );
      }

      if (role === "trainer") {
        await Trainer.findOneAndUpdate(
          { organizationId: orgId, email: normalizedEmail },
          {
            $set: {
              userId: user._id,
              name: normalizedName || "Trainer",
              email: normalizedEmail,
              isActive: user.isActive,
            },
            $setOnInsert: {
              organizationId: orgId,
              assignedCourses: [],
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );
      }
    } catch (profileError) {
      await User.deleteOne({ _id: user._id, organizationId: orgId });
      throw profileError;
    }

    await logActivity({ userId: req.user._id, organizationId: orgId, action: "CREATE_USER", module: "organization", description: `User created: ${user.name} (${role})`, ipAddress: req.ip });

    res.status(201).json({ success: true, message: "User created successfully.", data: { user } });
  } catch (error) { next(error); }
};

// @route PATCH /api/organizations/users/:id/toggle — Toggle user active status
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot change your own status." });
    }
    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Admin accounts cannot be toggled from this endpoint." });
    }
    if (user.role === "super_admin") {
      return res.status(403).json({ success: false, message: "Super admin accounts cannot be toggled from this endpoint." });
    }

    user.isActive = !user.isActive;
    await user.save();

    if (user.role === "trainer") {
      await Trainer.updateMany(
        {
          organizationId: req.user.organizationId,
          $or: [{ userId: user._id }, { email: user.email }],
        },
        {
          userId: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
        }
      );
    }

    if (user.role === "student") {
      await Student.updateMany(
        {
          organizationId: req.user.organizationId,
          $or: [{ userId: user._id }, { email: user.email }],
        },
        {
          userId: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
        }
      );
    }

    await logActivity({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      action: "TOGGLE_USER_STATUS",
      module: "organization",
      description: `User ${user.email} ${user.isActive ? "activated" : "deactivated"}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: `User ${user.isActive ? "activated" : "deactivated"} successfully.`, data: { user } });
  } catch (error) { next(error); }
};

module.exports = { getMyOrganization, updateMyOrganization, getOrganizationUsers, createOrganizationUser, toggleUserStatus };
