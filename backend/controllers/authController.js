const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { logActivity } = require("../middlewares/activityLogger");

// ─────────────────────────────────────────────
// Helper: Generate JWT
// ─────────────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      organizationId: user.organizationId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register organization + admin account
// @access  Public
// ─────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { orgName, orgEmail, orgPhone, adminName, adminEmail, adminPassword } = req.body;

    // Validate required fields
    if (!orgName || !orgEmail || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: orgName, orgEmail, adminName, adminEmail, adminPassword",
      });
    }

    // Check if org email already exists
    const orgExists = await Organization.findOne({ email: orgEmail.toLowerCase() });
    if (orgExists) {
      return res.status(409).json({
        success: false,
        message: "An organization with this email already exists.",
      });
    }

    // Check if admin email already exists
    const userExists = await User.findOne({ email: adminEmail.toLowerCase() });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    // Create organization
    const organization = await Organization.create({
      name: orgName.trim(),
      email: orgEmail.trim().toLowerCase(),
      phone: orgPhone || null,
    });

    // Create admin user
    const admin = await User.create({
      name: adminName.trim(),
      email: adminEmail.trim().toLowerCase(),
      password: adminPassword,
      role: "admin",
      organizationId: organization._id,
    });

    // Link admin to organization
    organization.adminId = admin._id;
    await organization.save();

    const token = generateToken(admin);

    await logActivity({
      userId: admin._id,
      organizationId: organization._id,
      action: "REGISTER",
      module: "auth",
      description: `New organization registered: ${organization.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: "Organization and admin account created successfully.",
      data: {
        token,
        user: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          organizationId: organization._id,
        },
        organization: {
          _id: organization._id,
          name: organization.name,
          email: organization.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
// ─────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact your administrator.",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user);

    await logActivity({
      userId: user._id,
      organizationId: user.organizationId,
      action: "LOGIN",
      module: "auth",
      description: `User logged in: ${user.email}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current logged-in user
// @access  Private
// ─────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate("organizationId", "name email plan");

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
// ─────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    const isValid = await user.comparePassword(currentPassword);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = newPassword;
    await user.save();

    await logActivity({
      userId: user._id,
      organizationId: user.organizationId,
      action: "CHANGE_PASSWORD",
      module: "auth",
      description: "User changed their password",
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, changePassword };