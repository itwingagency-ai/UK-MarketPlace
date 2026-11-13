const path = require("path");
const fs = require("fs");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();

const ApiError = require("../lib/ApiError");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Without AWS credentials (local development) uploads are written to disk and
// served from /uploads, so image flows can still be exercised. Production
// always uses S3.
const S3_CONFIGURED = Boolean(
  process.env.AWS_BUCKET_NAME &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
);
const USE_LOCAL_UPLOADS = !S3_CONFIGURED && process.env.NODE_ENV !== "production";
const LOCAL_UPLOAD_DIR = path.join(__dirname, "../../uploads");

const fileKey = (file) => {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  // Derive the extension from the vetted mimetype, not the client filename
  const extension = file.mimetype.split("/")[1].replace("jpeg", "jpg");
  return `${file.fieldname}-${uniqueSuffix}.${extension}`;
};

let storage;
if (USE_LOCAL_UPLOADS) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  // eslint-disable-next-line no-console
  console.warn(`AWS S3 is not configured; storing uploads locally in ${LOCAL_UPLOAD_DIR}`);
  storage = multer.diskStorage({
    destination: LOCAL_UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, fileKey(file)),
  });
} else {
  // Configure the AWS S3 client
  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  storage = multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, fileKey(file));
    },
  });
}

const multerUpload = multer({
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    return cb(new ApiError(400, "Only JPEG, PNG, WebP or GIF images can be uploaded"));
  },
  storage,
});

// Controllers read `file.location` (set by multer-s3); give local files the
// equivalent public URL so both storage modes look the same downstream.
const addLocalLocations = (req, res, next) => {
  const files = req.file
    ? [req.file]
    : Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();
  for (const file of files) {
    file.location = `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
  }
  next();
};

const withLocations = (middleware) =>
  USE_LOCAL_UPLOADS ? [middleware, addLocalLocations] : middleware;

const upload = {
  array: (...args) => withLocations(multerUpload.array(...args)),
  single: (...args) => withLocations(multerUpload.single(...args)),
  fields: (...args) => withLocations(multerUpload.fields(...args)),
};

module.exports = upload;
module.exports.USE_LOCAL_UPLOADS = USE_LOCAL_UPLOADS;
module.exports.LOCAL_UPLOAD_DIR = LOCAL_UPLOAD_DIR;
