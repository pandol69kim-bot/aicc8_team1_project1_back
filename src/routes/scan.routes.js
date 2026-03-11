import express from 'express';
import multer from 'multer';
import path from 'path';
import * as scanController from '../controllers/scanController.js';

const router = express.Router();

// AI 분석용 (메모리 - base64로 OpenAI 전달)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('JPEG, PNG, WebP만 업로드 가능합니다.'), false);
  },
});

// save-ai용: uploads 폴더에 저장, DB에는 경로만 저장
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'scan-' + uniqueSuffix + ext);
  },
});
const uploadDisk = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('JPEG, PNG, WebP만 업로드 가능합니다.'), false);
  },
});

router.post('/food', uploadMemory.single('image'), scanController.analyzeFood);
router.post('/food/reanalyze', express.json(), scanController.reanalyzeFood);

// AI 분석 결과 저장 - FormData(image, user_id, scan_result) → uploads에 저장, DB에 경로 저장
router.post('/save-ai', uploadDisk.single('image'), scanController.saveAi);
router.post('/save-diary', express.json(), scanController.saveDiary);

export default router;
