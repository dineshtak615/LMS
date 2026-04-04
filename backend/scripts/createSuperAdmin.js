const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

const REQUIRED_ENV_VARS = ["SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD", "SUPER_ADMIN_NAME"];

const validateScriptEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for super admin bootstrap: ${missing.join(", ")}`
    );
  }
};

const createSuperAdmin = async () => {
  try {
    validateScriptEnv();
    await connectDB();

    const email = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME.trim();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`[SEED] Super admin already exists: ${email}`);
      return;
    }

    const user = await User.create({
      name,
      email,
      password,
      role: "super_admin",
      organizationId: null,
    });

    console.log("[SEED] Super admin created successfully");
    console.log(`Name:  ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role:  ${user.role}`);
  } catch (error) {
    console.error(`[SEED] Failed to create super admin: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close(false);
  }
};

createSuperAdmin();
