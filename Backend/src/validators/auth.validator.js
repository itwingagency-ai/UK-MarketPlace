const ApiError = require("../lib/ApiError");

const validateRegisterInput = (payload) => {
  const { name, email, password, role } = payload;

  if (!name || name.trim().length < 2) {
    throw new ApiError(400, "Name must be at least 2 characters");
  }

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  if (!password || password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  // Basic complexity check to reduce weak password usage.
  const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
  if (!complexityRegex.test(password)) {
    throw new ApiError(
      400,
      "Password must contain upper, lower and numeric characters"
    );
  }

  if (role && role !== "customer") {
    throw new ApiError(
      403,
      "Vendor accounts are created after admin approval; register as customer and submit an application"
    );
  }
};

const validateLoginInput = (payload) => {
  const { email, password } = payload;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
};

module.exports = {
  validateRegisterInput,
  validateLoginInput,
};
