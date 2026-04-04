const mongoose = require("mongoose");
const Student = require("../models/Student");
const Trainer = require("../models/Trainer");

const syncCollectionIndexes = async (model, label) => {
  try {
    const dropped = await model.syncIndexes();
    const droppedList = Array.isArray(dropped)
      ? dropped
      : Object.keys(dropped || {});

    if (droppedList.length > 0) {
      console.log(`[DB] ${label} indexes synced. Dropped: ${droppedList.join(", ")}`);
    }
  } catch (error) {
    console.error(`[DB] Failed to sync ${label} indexes: ${error.message}`);
  }
};

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    autoIndex: process.env.NODE_ENV !== "production",
  });

  console.log(`[DB] Connected: ${conn.connection.host}`);
  const shouldSyncIndexes =
    process.env.NODE_ENV !== "production" || process.env.SYNC_INDEXES_ON_BOOT === "true";

  if (shouldSyncIndexes) {
    await Promise.all([
      syncCollectionIndexes(Student, "students"),
      syncCollectionIndexes(Trainer, "trainers"),
    ]);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[DB] Disconnected. Mongoose will retry according to its reconnect policy.");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[DB] Reconnected");
  });

  return conn;
};

module.exports = connectDB;
