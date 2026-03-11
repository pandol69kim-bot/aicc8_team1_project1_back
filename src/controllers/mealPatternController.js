import { getMealPattern, updateMealPattern } from '../models/mealPatternModel.js';

/**
 * [GET] /api/users/me/meal-pattern
 * 식사 패턴 조회
 */
export const getPattern = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 없습니다.' });
    }
    const pattern = await getMealPattern(userId);
    if (!pattern) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    return res.status(200).json({ success: true, data: pattern });
  } catch (error) {
    console.error('getPattern 에러:', error);
    res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
  }
};

/**
 * [PUT] /api/users/me/meal-pattern
 * 식사 패턴 업데이트
 * body: { breakfastTime?: "08:00", lunchTime?: "12:30", dinnerTime?: "19:00" }
 */
export const updatePattern = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증 정보가 없습니다.' });
    }
    const { breakfastTime, lunchTime, dinnerTime } = req.body || {};
    const pattern = await updateMealPattern(userId, {
      breakfastTime: breakfastTime || undefined,
      lunchTime: lunchTime || undefined,
      dinnerTime: dinnerTime || undefined,
    });
    if (!pattern) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    return res.status(200).json({ success: true, data: pattern });
  } catch (error) {
    console.error('updatePattern 에러:', error);
    res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
  }
};
