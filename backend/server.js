require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const { getAllowedOrigins, validateEnv } = require("./config/env");

validateEnv();

const app = express();
app.disable("x-powered-by");
app.set("etag", false);

if (process.env.TRUST_PROXY) {
  const trustProxyValue = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isNaN(trustProxyValue) ? process.env.TRUST_PROXY : trustProxyValue);
} else if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const allowedOrigins = getAllowedOrigins();
const allowLocalNetworkOrigins = process.env.NODE_ENV !== "production";

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile apps, curl)
      if (!origin) return callback(null, true);

      const isLocalNetworkOrigin =
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin) ||
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/.test(origin);

      if (allowedOrigins.includes(origin) || (allowLocalNetworkOrigins && isLocalNetworkOrigin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error(`CORS policy blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use(globalLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/organizations", require("./routes/organizationRoutes"));
app.use("/api/super-admin", require("./routes/superAdminRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/trainers", require("./routes/trainerRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/assignments", require("./routes/assignmentRoutes"));
app.use("/api/enrolments", require("./routes/enrolmentRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/library", require("./routes/libraryRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/uploads", express.static("uploads"));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LMS API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

const mapKnownError = (error) => {
  if (error?.statusCode) {
    return { statusCode: error.statusCode, message: error.message || "Request failed." };
  }

  if (error?.name === "ValidationError") {
    const firstValidationError = Object.values(error.errors || {})[0];
    return {
      statusCode: 400,
      message: firstValidationError?.message || "Validation failed.",
    };
  }

  if (error?.name === "CastError") {
    return {
      statusCode: 400,
      message: `Invalid ${error.path || "identifier"} provided.`,
    };
  }

  if (error?.code === 11000) {
    const duplicateField =
      Object.keys(error.keyPattern || {})[0] ||
      Object.keys(error.keyValue || {})[0] ||
      "field";
    return {
      statusCode: 409,
      message: `Duplicate value for ${duplicateField}.`,
    };
  }

  if (error?.name === "MulterError") {
    if (error.code === "LIMIT_FILE_SIZE") {
      return { statusCode: 400, message: "Uploaded file is too large." };
    }
    return { statusCode: 400, message: error.message || "File upload failed." };
  }

  return {
    statusCode: 500,
    message: error?.message || "Internal server error",
  };
};

app.use((err, req, res, next) => {
  const mapped = mapKnownError(err);
  const message =
    process.env.NODE_ENV === "production" && mapped.statusCode === 500
      ? "Internal server error"
      : mapped.message;

  console.error(`[ERROR] ${err.stack || err.message}`);

  res.status(mapped.statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = Number(process.env.PORT) || 5000;
let server;
let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[BOOT] ${signal} received. Starting graceful shutdown...`);
  const forceExitTimer = setTimeout(() => {
    console.error("[BOOT] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error);
          return resolve();
        });
      });
      console.log("[BOOT] HTTP server closed");
    }

    await mongoose.connection.close(false);
    console.log("[DB] Connection closed");
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    console.error(`[BOOT] Shutdown error: ${error.message}`);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    await connectDB();

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`[BOOT] LMS server running on port ${PORT} (${process.env.NODE_ENV})`);
      console.log(`[BOOT] Local URL: http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`[BOOT] Port ${PORT} is already in use.`);
      } else if (error.code === "EACCES") {
        console.error(`[BOOT] Permission denied while binding to port ${PORT}.`);
      } else {
        console.error(`[BOOT] Server error: ${error.message}`);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error(`[BOOT] Startup failed: ${error.message}`);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();

module.exports = app;
