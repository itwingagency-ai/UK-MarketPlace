const mongoose = require("mongoose");

/**
 * A lease so only one API process runs a scheduled job at a time (no extra
 * infrastructure: the lock lives in Mongo and expires on its own).
 */
const jobLockSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  lockedUntil: { type: Date, default: null },
  owner: { type: String, default: "" },
});

module.exports = mongoose.model("JobLock", jobLockSchema);
