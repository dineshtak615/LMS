const Organization = require("../models/Organization");
const User = require("../models/User");
const Student = require("../models/Student");
const Trainer = require("../models/Trainer");
const Course = require("../models/Course");
const ActivityLog = require("../models/ActivityLog");
const { logActivity } = require("../middlewares/activityLogger");

// @route GET /api/super-admin/dashboard
const getSuperAdminDashboard = async (req, res, next) => {
  try {
    const [totalOrgs, activeOrgs, totalUsers, recentOrgs, recentActivity] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ isActive: true }),
      User.countDocuments({ role: { $ne: "super_admin" } }),
      Organization.find().sort({ createdAt: -1 }).limit(5).lean(),
      ActivityLog.find().sort({ createdAt: -1 }).limit(10).populate("userId", "name email").lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: { totalOrganizations: totalOrgs, activeOrganizations: activeOrgs, totalUsers },
        recentOrganizations: recentOrgs,
        recentActivity,
      },
    });
  } catch (error) { next(error); }
};

// @route GET /api/super-admin/organizations
const getAllOrganizations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "", isActive } = req.query;

    const filter = {};
    if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [organizations, total] = await Promise.all([
      Organization.find(filter).populate("adminId", "name email").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Organization.countDocuments(filter),
    ]);

    // Enrich with student/course counts
    const enriched = await Promise.all(
      organizations.map(async (org) => {
        const [students, courses, trainers] = await Promise.all([
          Student.countDocuments({ organizationId: org._id }),
          Course.countDocuments({ organizationId: org._id }),
          Trainer.countDocuments({ organizationId: org._id }),
        ]);
        return { ...org, students, courses, trainers };
      })
    );

    res.status(200).json({
      success: true,
      data: { organizations: enriched, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } },
    });
  } catch (error) { next(error); }
};

// @route GET /api/super-admin/organizations/:id
const getOrganizationById = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id).populate("adminId", "name email");
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    const [students, trainers, courses] = await Promise.all([
      Student.countDocuments({ organizationId: org._id }),
      Trainer.countDocuments({ organizationId: org._id }),
      Course.countDocuments({ organizationId: org._id }),
    ]);

    res.status(200).json({ success: true, data: { organization: { ...org.toObject(), students, trainers, courses } } });
  } catch (error) { next(error); }
};

// @route PATCH /api/super-admin/organizations/:id/toggle
const toggleOrganizationStatus = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    org.isActive = !org.isActive;
    await org.save();

    // Also deactivate/reactivate the admin
    if (org.adminId) {
      await User.findByIdAndUpdate(org.adminId, { isActive: org.isActive });
    }

    await logActivity({ userId: req.user._id, organizationId: null, action: "TOGGLE_ORG_STATUS", module: "super_admin", description: `Organization ${org.name} ${org.isActive ? "activated" : "deactivated"}`, ipAddress: req.ip });

    res.status(200).json({ success: true, message: `Organization ${org.isActive ? "activated" : "deactivated"} successfully.`, data: { organization: org } });
  } catch (error) { next(error); }
};

// @route PUT /api/super-admin/organizations/:id/plan
const updateOrganizationPlan = async (req, res, next) => {
  try {
    const { plan, maxStudents, maxTrainers } = req.body;
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    if (plan !== undefined) {
      org.plan = plan;
    }

    if (maxStudents !== undefined) {
      const parsedMaxStudents = Number(maxStudents);
      if (!Number.isFinite(parsedMaxStudents) || parsedMaxStudents < 0) {
        return res.status(400).json({ success: false, message: "maxStudents must be a non-negative number." });
      }
      org.maxStudents = parsedMaxStudents;
    }

    if (maxTrainers !== undefined) {
      const parsedMaxTrainers = Number(maxTrainers);
      if (!Number.isFinite(parsedMaxTrainers) || parsedMaxTrainers < 0) {
        return res.status(400).json({ success: false, message: "maxTrainers must be a non-negative number." });
      }
      org.maxTrainers = parsedMaxTrainers;
    }

    await org.save();
    res.status(200).json({ success: true, message: "Plan updated successfully.", data: { organization: org } });
  } catch (error) { next(error); }
};

// @route GET /api/super-admin/users
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search = "" } = req.query;

    const filter = { role: { $ne: "super_admin" } };
    if (role) filter.role = role;
    if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).populate("organizationId", "name").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: { users, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } } });
  } catch (error) { next(error); }
};

// @route GET /api/super-admin/activity-logs
const getActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, module, organizationId } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (organizationId) filter.organizationId = organizationId;

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).populate("userId", "name email role").populate("organizationId", "name").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: { logs, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } } });
  } catch (error) { next(error); }
};

module.exports = { getSuperAdminDashboard, getAllOrganizations, getOrganizationById, toggleOrganizationStatus, updateOrganizationPlan, getAllUsers, getActivityLogs };
