import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import {
    findUserByEmail, findUserByNickname, createUser,
    savePasswordResetCode, findPasswordResetInfo,
    savePasswordResetToken, updateUserPassword,
    findUserById, updateProfile, updateProfileImage, deleteUser
} from "../models/userModel.js";
import { upsertGoals } from "../models/nutritionGoalsModel.js";
import { calculateDailyNutritionGoals } from "../services/goalCalculationService.js";
import { sendVerificationEmail } from "../services/emailService.js";

// require('dotenv').config(); // Removed for ES module compatibility/redundancy

const signup = async (req, res) => {
    // ... existing code ...
    try {
        const {
            email, password, nickname, profile_image_url,
            gender, age_group, height, weight, goals, dietary_restrictions,
            receive_notifications, eating_habits, allergies
        } = req.body;

        // 필수 값 검증
        if (!email || !password || !nickname) {
            return res.status(400).json({ message: "이메일, 비밀번호, 닉네임은 필수입니다." });
        }

        // 이메일 중복 확인
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: "이미 가입된 이메일입니다." });
        }

        // 비밀번호 해싱
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // UUIDv4 생성
        const userId = uuidv4();

        // 사용자 생성 (DB 저장)
        const newUser = await createUser(
            userId, email, passwordHash, nickname, profile_image_url,
            gender, age_group, height, weight, goals, dietary_restrictions,
            receive_notifications, eating_habits, allergies
        );

        // 비밀번호 해시 제외 후 반환
        res.status(201).json({
            message: "회원가입이 완료되었습니다.",
            user: {
                id: newUser.id,
                email: newUser.email,
                nickname: newUser.nickname,
                profileImageUrl: newUser.profile_image_url,
                gender: newUser.gender,
                ageGroup: newUser.age_group,
                height: newUser.height,
                weight: newUser.weight,
                goals: newUser.goals,
                dietaryRestrictions: newUser.dietary_restrictions,
                receiveNotifications: newUser.receive_notifications,
                eatingHabits: newUser.eating_habits,
                allergies: newUser.allergies,
                createdAt: newUser.created_at
            }
        });
    } catch (error) {
        console.error("signup 에러:", error);
        if (error.code === '23505' && error.constraint === 'users_email_key') {
            return res.status(409).json({ message: "이미 가입되어 있거나 탈퇴 처리되어 재가입이 불가능한 이메일입니다." });
        }
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};

const login = async (req, res) => {

    try {
        const { email, password } = req.body;

        // 필수 값 검증
        if (!email || !password) {
            return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요." });
        }

        // 사용자 조회
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
        }

        // 비밀번호 검증
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
        }
        // JWT 발급 (Access + Refresh)
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, nickname: user.nickname },
            process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '2h' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '30d' }
        );

        // ✅ refreshToken은 쿠키에 저장 (httpOnly)
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,   // HTTPS면 true
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30일
        });

        return res.status(200).json({
            message: "로그인 성공",
            token: accessToken, // ✅ accessToken만 내려줌
            user: {
                id: user.id,
                email: user.email,
                nickname: user.nickname,
                height: user.height,
                weight: user.weight,
                goals: user.goals,
                dietaryRestrictions: user.dietary_restrictions
            }
        });

    } catch (error) {
        console.error("login 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};

const refresh = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) return res.status(401).json({ message: "refreshToken 없음" });

        const decoded = jwt.verify(
            token,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "fallback_secret_key"
        );

        // ✅ userModel에 findUserById 없으면 아래 줄을 email 기반으로 바꿔야 함 (아래 참고)
        const user = await findUserByEmail(decoded.email);
        if (!user) return res.status(401).json({ message: "유저 없음" });

        const newAccessToken = jwt.sign(
            { id: user.id, email: user.email, nickname: user.nickname },
            process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "fallback_secret_key",
            { expiresIn: "2h" }
        );

        return res.status(200).json({ message: "토큰 재발급 성공", token: newAccessToken });
    } catch (e) {
        return res.status(401).json({ message: "refreshToken 만료/위조" });
    }
};

const logout = async (req, res) => {
    res.clearCookie("refreshToken", { httpOnly: true, sameSite: "lax", secure: false });
    return res.status(200).json({ message: "로그아웃 완료" });
};

const getUsers = async (req, res) => {
    try {
        res.status(200).json({ message: "Get users success (placeholder)" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const sendPasswordResetCode = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "이메일을 입력해주세요." });

        const user = await findUserByEmail(email);
        if (!user) return res.status(404).json({ message: "가입되지 않은 이메일입니다." });

        // 6자리 인증 코드 생성
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // 5분 후 만료 시간 설정
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await savePasswordResetCode(email, code, expiresAt);
        await sendVerificationEmail(email, code);

        return res.status(200).json({ message: "인증 코드가 이메일로 발송되었습니다." });
    } catch (error) {
        console.error("sendPasswordResetCode 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};


const verifyPasswordResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ message: "이메일과 인증 코드를 입력해주세요." });

        const info = await findPasswordResetInfo(email);
        if (!info || info.code !== code) {
            return res.status(400).json({ message: "인증 코드가 일치하지 않습니다." });
        }

        if (new Date(info.expires_at) < new Date()) {
            return res.status(400).json({ message: "만료된 인증 코드입니다." });
        }

        // 인증 성공 시 30분 유효한 resetToken 발급
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await savePasswordResetToken(email, resetToken, tokenExpiresAt);

        return res.status(200).json({
            message: "인증이 완료되었습니다.",
            resetToken
        });
    } catch (error) {
        console.error("verifyPasswordResetCode 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};


const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;
        if (!resetToken || !newPassword) {
            return res.status(400).json({ message: "재설정 토큰과 새 비밀번호를 입력해주세요." });
        }

        const poolQuery = await import("../../database/databaseConnect.js");
        const { rows } = await poolQuery.pool.query('SELECT * FROM password_resets WHERE reset_token = $1', [resetToken]);

        if (rows.length === 0) {
            return res.status(400).json({ message: "유효하지 않은 재설정 정보입니다." });
        }

        const info = rows[0];
        if (new Date(info.expires_at) < new Date()) {
            return res.status(400).json({ message: "시간이 초과되었습니다. 처음부터 다시 진행해주세요." });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        await updateUserPassword(info.email, passwordHash);

        return res.status(200).json({ message: "비밀번호가 성공적으로 변경되었습니다." });
    } catch (error) {
        console.error("resetPassword 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};

/**
 * [GET] 사용자 정보 조회
 */
const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id; // 인증 미들웨어(requireAuth)를 통해 주입됨 

        if (!userId) {
            // 인증 미들웨어가 없다면, 쿼리파라미터나 헤더 등에서 임시로 받을 수 있음 (예: req.query.userId)
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
        }

        return res.status(200).json({
            success: true,
            data: {
                nickname: user.nickname,
                profileImageUrl: user.profile_image_url || null,
                gender: user.gender || null,
                ageGroup: user.age_group || null,
                height: user.height || null,
                weight: user.weight || null,
                goals: user.goals ? (typeof user.goals === 'string' ? JSON.parse(user.goals) : user.goals) : [],
                dietaryRestrictions: user.dietary_restrictions ? (typeof user.dietary_restrictions === 'string' ? JSON.parse(user.dietary_restrictions) : user.dietary_restrictions) : []
            }
        });

    } catch (error) {
        console.error("getMyProfile 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

/**
 * [PUT] 사용자 정보 수정
 */
const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id; // 인증 미들웨어를 통해 주입

        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        const {
            nickname,
            profileImageUrl,
            height,
            weight,
            goals,
            dietaryRestrictions
        } = req.body;

        const updatedUser = await updateProfile(userId, {
            nickname,
            profileImageUrl,
            height,
            weight,
            goals,
            dietaryRestrictions
        });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
        }

        // 키/몸무게 변경 시 nutrition_goals 갱신 (Task 3)
        if (height != null || weight != null) {
            try {
                const todayStr = new Date().toISOString().slice(0, 10);
                const goals = calculateDailyNutritionGoals(updatedUser);
                await upsertGoals(userId, todayStr, goals);
            } catch (err) {
                console.error("nutrition_goals 갱신 실패:", err);
            }
        }

        return res.status(200).json({
            success: true,
            message: "수정되었습니다.",
            data: {
                id: updatedUser.id,
                nickname: updatedUser.nickname,
                profileImageUrl: updatedUser.profile_image_url || null,
                height: updatedUser.height || null,
                weight: updatedUser.weight || null,
                goals: updatedUser.goals ? (typeof updatedUser.goals === 'string' ? JSON.parse(updatedUser.goals) : updatedUser.goals) : [],
                dietaryRestrictions: updatedUser.dietary_restrictions ? (typeof updatedUser.dietary_restrictions === 'string' ? JSON.parse(updatedUser.dietary_restrictions) : updatedUser.dietary_restrictions) : []
            }
        });

    } catch (error) {
        console.error("updateMyProfile 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

/**
 * [DELETE] 회원 탈퇴
 */
const withdrawUser = async (req, res) => {
    try {
        const userId = req.user?.id; // 인증 미들웨어를 통해 주입

        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        const result = await deleteUser(userId);
        if (!result) {
            return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
        }

        // 쿠키를 이용해 로그아웃(토큰 삭제) 처리도 병행
        res.clearCookie("refreshToken", { httpOnly: true, sameSite: "lax", secure: false });

        return res.status(200).json({
            success: true,
            message: "회원탈퇴가 완료되었습니다."
        });

    } catch (error) {
        console.error("withdrawUser 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

const uploadProfileImageHandler = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: "이미지 파일이 필요합니다." });
        }

        const profileImageUrl = `/uploads/profile/${req.file.filename}`;
        await updateProfileImage(userId, profileImageUrl);

        return res.status(200).json({
            success: true,
            profileImage: profileImageUrl
        });
    } catch (error) {
        console.error("uploadProfileImageHandler 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

const deleteProfileImageHandler = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }
        
        await updateProfileImage(userId, null);

        return res.status(200).json({
            success: true,
            message: "프로필 이미지가 삭제되었습니다."
        });
    } catch (error) {
        console.error("deleteProfileImageHandler 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};


export default {
    signup,
    login,
    refresh,
    logout,
    getUsers,
    sendPasswordResetCode,
    verifyPasswordResetCode,
    resetPassword,
    resendPasswordResetCode: sendPasswordResetCode,
    getMyProfile,
    updateMyProfile,
    withdrawUser,
    uploadProfileImageHandler,
    deleteProfileImageHandler
};