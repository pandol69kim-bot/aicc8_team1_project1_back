import multer from "multer";
import path from "path";
import fs from "fs";

// 폴더가 없으면 생성
const uploadDir = path.join(process.cwd(), "uploads", "profile");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // req.user.id 가 있을테지만, 확실하지 않으므로 고유 값 생성 (user_123_...)
    const userId = req.user ? req.user.id : "guest";
    const ext = path.extname(file.originalname);
    cb(null, `user_${userId}_${Date.now()}${ext}`);
  },
});

const uploadProfileImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다."));
    }
  },
});

export { uploadProfileImage };
