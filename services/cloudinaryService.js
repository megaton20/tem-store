const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file buffer (from multer's memory storage) to Cloudinary and
 * returns the hosted URL. Used anywhere an admin uploads a product photo,
 * team member photo, etc. - replaces pasting in a raw image URL.
 */
function uploadImageBuffer(buffer, folder = 'tem-store') {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return reject(new Error('Cloudinary is not configured - set CLOUDINARY_* env vars.'));
    }
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { uploadImageBuffer };
