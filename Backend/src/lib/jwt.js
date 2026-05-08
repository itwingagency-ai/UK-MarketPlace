const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const signAccessToken = (user) =>
  jwt.sign(
    { role: user.role, storeId: user.storeId || null },
    env.jwtAccessSecret,
    {
      expiresIn: env.jwtAccessExpiresIn,
      subject: user._id.toString(),
    }
  );

const signRefreshToken = (user) => {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign({ tokenId }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
    subject: user._id.toString(),
  });

  return { token, tokenId };
};

const verifyAccessToken = (token) => jwt.verify(token, env.jwtAccessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, env.jwtRefreshSecret);

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
