import express from "express";
import userController from "../controllers/userController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { uploadProfileImage } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and management
 */
// test
/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nickname
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               nickname:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email already exists
 */
router.post("/register", userController.signup);
router.post("/signup", userController.signup);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", userController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post("/refresh", userController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", userController.logout);

/**
 * @swagger
 * /api/auth/forgot-password/send-code:
 *   post:
 *     summary: 비밀번호 찾기 (인증 코드 이메일 발송)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: 코드 발송 성공
 * /api/auth/forgot-password/verify-code:
 *   post:
 *     summary: 인증 코드 검증
 *     tags: [Auth]
 * /api/auth/forgot-password/reset-password:
 *   post:
 *     summary: 새 비밀번호 설정
 *     tags: [Auth]
 * /api/auth/forgot-password/resend-code:
 *   post:
 *     summary: 인증 코드 재발송
 *     tags: [Auth]
 */
router.post("/forgot-password/send-code", userController.sendPasswordResetCode);
router.post("/forgot-password/verify-code", userController.verifyPasswordResetCode);
router.post("/forgot-password/reset-password", userController.resetPassword);
router.post("/forgot-password/resend-code", userController.resendPasswordResetCode);


/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 사용자 정보 조회 (프로필)
 *     tags: [Auth]
 */
router.get("/me", requireAuth, userController.getMyProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: 사용자 정보 수정 (수정하기 버튼)
 *     tags: [Auth]
 */
router.put("/profile", requireAuth, userController.updateMyProfile);

/**
 * @swagger
 * /api/auth/profile/image:
 *   post:
 *     summary: 사용자 프로필 이미지 업로드
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 프로필 이미지 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 profileImage:
 *                   type: string
 *                   example: "/uploads/profile/user_123_1234567890.jpg"
 */
router.post("/profile/image", requireAuth, uploadProfileImage.single("profileImage"), userController.uploadProfileImageHandler);

/**
 * @swagger
 * /api/auth/profile/image:
 *   delete:
 *     summary: 사용자 프로필 이미지 삭제
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 프로필 이미지 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "프로필 이미지가 삭제되었습니다."
 */
router.delete("/profile/image", requireAuth, userController.deleteProfileImageHandler);

/**
 * @swagger
 * /api/auth/withdraw:
 *   delete:
 *     summary: 회원탈퇴 (접속 불가 처리)
 *     tags: [Auth]
 */
router.delete("/withdraw", requireAuth, userController.withdrawUser);

router.get("/login", (req, res) => {
    res.send("login endpoint alive. Use POST.");
});

router.get("/signup", (req, res) => {
    res.send("signup endpoint alive. Use POST.");
});

router.get("/cookie-test", (req, res) => {
    res.json({ cookies: req.cookies });
});

export default router;