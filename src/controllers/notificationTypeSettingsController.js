import {
  getNotificationTypeSettings,
  updateNotificationTypeSettings,
} from '../models/notificationTypeSettingsModel.js';
import { updateMealPattern } from '../models/mealPatternModel.js';

/**
 * [GET] /api/users/me/notification-type-settings
 * 알림 유형별 설정 조회
 */
export const getSettings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 없습니다.' });
    }
    const settings = await getNotificationTypeSettings(userId);
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('getNotificationTypeSettings 에러:', error);
    res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
  }
};

/**
 * [PUT] /api/users/me/notification-type-settings
 * 알림 유형별 설정 업데이트
 * body: { meal_nudge: { enabled, config: { breakfastTime, lunchTime, dinnerTime } }, ... }
 */
export const updateSettings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 없습니다.' });
    }
    const updates = req.body || {};

    // meal_nudge 설정은 users 테이블(breakfast_time, lunch_time, dinner_time)에 저장
    if (updates.meal_nudge?.config && typeof updates.meal_nudge.config === 'object') {
      const cfg = updates.meal_nudge.config;
      await updateMealPattern(userId, {
        breakfastTime: cfg.breakfastTime ?? undefined,
        lunchTime: cfg.lunchTime ?? undefined,
        dinnerTime: cfg.dinnerTime ?? undefined,
      });
    }

    const settings = await updateNotificationTypeSettings(userId, updates);
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('updateNotificationTypeSettings 에러:', error);
    res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
  }
};
