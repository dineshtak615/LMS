
const ActivityLog = require("../models/ActivityLog");

/**
 * Creates an activity log entry
 * Can be used as middleware or called directly from controllers
 */
const logActivity = async ({ userId, organizationId, action, module, description, metadata, ipAddress }) => {
  try {
    await ActivityLog.create({
      userId: userId || null,
      organizationId: organizationId || null,
      action,
      module,
      description: description || null,
      metadata: metadata || null,
      ipAddress: ipAddress || null,
    });
  } catch (error) {
    // Never block the main request due to logging failure
    console.error("[ActivityLogger] Failed to log activity:", error.message);
  }
};

/**
 * Express middleware factory for activity logging
 * Usage: activityLogger("action_name", "module_name", "description")
 */
const activityLogger = (action, module, description) => {
  return async (req, res, next) => {
    // Run after response
    res.on("finish", () => {
      if (res.statusCode < 400) {
        logActivity({
          userId: req.user?._id,
          organizationId: req.user?.organizationId,
          action,
          module,
          description,
          ipAddress: req.ip || req.headers["x-forwarded-for"],
        });
      }
    });
    next();
  };
};

module.exports = { logActivity, activityLogger };
