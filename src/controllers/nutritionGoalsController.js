import { getOrCreateGoals } from '../models/nutritionGoalsModel.js';

/**
 * GET /api/users/me/nutrition-goals?date=YYYY-MM-DD
 * 사용자별 오늘/특정일 영양 목표 조회 (인증 필요)
 */
export async function getNutritionGoals(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const goals = await getOrCreateGoals(userId, dateStr);

    return res.json({
      success: true,
      data: {
        date: dateStr,
        targetCalories: goals?.target_calories ?? null,
        targetCarbohydrate: goals?.target_carbohydrate ?? null,
        targetProtein: goals?.target_protein ?? null,
        targetFat: goals?.target_fat ?? null,
        targetSugars: goals?.target_sugars ?? null,
      },
    });
  } catch (err) {
    console.error('getNutritionGoals 에러:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
