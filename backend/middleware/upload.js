const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const SIZE_LIMIT_MB = 8;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `receipt_${ts}_${rand}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, HEIC`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: SIZE_LIMIT_MB * 1024 * 1024 },
  fileFilter
});

module.exports = upload;
