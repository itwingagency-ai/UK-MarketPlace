const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const deleteFileFromS3 = async (fileUrl) => {
  if (!fileUrl) return;
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    // Extract the key from the URL. S3 URLs look like:
    // https://bucket-name.s3.region.amazonaws.com/key
    const urlPattern = new RegExp(`https://${bucketName}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/(.+)`);
    const match = fileUrl.match(urlPattern);
    
    if (match && match[1]) {
      const key = decodeURIComponent(match[1]);
      await s3.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      }));
      console.log(`Deleted orphaned S3 file: ${key}`);
    }
  } catch (error) {
    console.error(`Failed to delete S3 file ${fileUrl}:`, error);
  }
};

module.exports = {
  deleteFileFromS3
};
