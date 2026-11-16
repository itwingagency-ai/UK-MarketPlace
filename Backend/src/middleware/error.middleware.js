const env = require("../config/env");
const { reportError } = require("../lib/monitoring");

const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
};

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: "Each image must be 5 MB or smaller",
  LIMIT_FILE_COUNT: "Too many images in one upload",
  LIMIT_UNEXPECTED_FILE: "Too many images in one upload",
};

const errorHandler = (err, req, res, next) => {
  const isUploadError = err.name === "MulterError";
  const statusCode = err.statusCode || (isUploadError ? 400 : 500);
  const message =
    (isUploadError && MULTER_MESSAGES[err.code]) ||
    err.message ||
    "Internal server error";

  if (env.nodeEnv !== "test") {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  if (statusCode >= 500) reportError(err, req);

  res.status(statusCode).json({
    message,
    ...(env.nodeEnv === "development" && { stack: err.stack }),
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
