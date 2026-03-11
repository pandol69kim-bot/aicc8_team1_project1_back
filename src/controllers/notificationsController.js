import { getUserNotifications, markNotificationAsRead, updateNotificationSettings, getNotificationSettings } from '../models/notificationsModel.js';

/**
 * [GET] /api/notifications
 * 유저의 알림 목록 조회
 */
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id; // 인증 미들웨어(requireAuth)를 통해 주입됨 

        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        const notifications = await getUserNotifications(userId);

        return res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error("getNotifications 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

/**
 * [PATCH] /api/notifications/:id/read
 * 특정 알림 읽음 처리
 */
export const readNotification = async (req, res) => {
    try {
        const userId = req.user?.id;
        const notificationId = req.params.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        const marked = await markNotificationAsRead(notificationId, userId);

        if (!marked) {
            return res.status(404).json({ success: false, message: "해당 알림을 찾을 수 없거나 권한이 없습니다." });
        }

        return res.status(200).json({
            success: true,
            message: "알림 읽음 처리 완료"
        });
    } catch (error) {
        console.error("readNotification 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

/**
 * [GET] /api/users/me/notification-settings
 * 알림 설정 조회
 */
export const getSettings = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        const settings = await getNotificationSettings(userId);

        if (!settings) {
            return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
        }

        return res.status(200).json({
            success: true,
            data: {
                receiveNotifications: settings.receive_notifications
            }
        });

    } catch (error) {
        console.error("getSettings 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

/**
 * [PUT] /api/users/me/notification-settings
 * 알림 설정 업데이트
 */
export const updateSettings = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { receiveNotifications } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        // receiveNotifications 값을 명확히 boolean으로 취급
        const isReceiving = receiveNotifications === true || receiveNotifications === "true";

        const updated = await updateNotificationSettings(userId, isReceiving);

        if (!updated) {
            return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
        }

        return res.status(200).json({
            success: true,
            message: "알림 설정이 변경되었습니다.",
            data: {
                receiveNotifications: updated.receive_notifications
            }
        });

    } catch (error) {
        console.error("updateSettings 에러:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};
