import { pool } from '../../database/databaseConnect.js';
import { getOrCreateGoals } from '../models/nutritionGoalsModel.js';
import { insertDeficiencyAlert } from '../models/deficiencyAlertsModel.js';

/**
 * 특정 사용자의 특정 날짜 영양소 결핍 여부를 체크합니다.
 * diary_entries snap_* 합계 + nutrition_goals 기준
 */
export const checkDeficiency = async (req, res) => {
  try {
    const { userId } = req.body;
    const { date } = req.query;

    if (!userId || !date) {
      return res
        .status(400)
        .json({ success: false, message: 'userId와 date가 필요합니다.' });
    }

    const [nutritionRes, goals] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(snap_calories), 0) AS total_calories,
           COALESCE(SUM(snap_carbohydrate), 0) AS total_carbohydrate,
           COALESCE(SUM(snap_protein), 0) AS total_protein,
           COALESCE(SUM(snap_fat), 0) AS total_fat
         FROM diary_entries
         WHERE user_id = $1
           AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
           AND deleted_at IS NULL`,
        [userId, date]
      ),
      getOrCreateGoals(userId, date),
    ]);
    const nutrition = nutritionRes.rows[0] || {};
    const thresholds = {
      calories: Number(goals?.target_calories) || 1500,
      carbohydrate: Number(goals?.target_carbohydrate) || 100,
      protein: Number(goals?.target_protein) || 50,
      fat: Number(goals?.target_fat) || 30,
    };

    const alerts = [];
    const types = [
      ['calories', 'total_calories', 'CALORIES'],
      ['carbohydrate', 'total_carbohydrate', 'CARBOHYDRATE'],
      ['protein', 'total_protein', 'PROTEIN'],
      ['fat', 'total_fat', 'FAT'],
    ];
    for (const [key, col, type] of types) {
      const current = parseFloat(nutrition[col]) || 0;
      const target = thresholds[key];
      if (target > 0 && current < target) {
        alerts.push({ type, current, target });
      }
    }

    for (const alert of alerts) {
      await insertDeficiencyAlert({
        userId,
        deficiencyType: alert.type,
        currentValue: alert.current,
        targetValue: alert.target,
      });
    }

    return res.json({
      success: true,
      data: {
        date,
        nutrition: {
          total_calories: parseFloat(nutrition.total_calories) || 0,
          total_carbohydrate: parseFloat(nutrition.total_carbohydrate) || 0,
          total_protein: parseFloat(nutrition.total_protein) || 0,
          total_fat: parseFloat(nutrition.total_fat) || 0,
        },
        alerts,
      },
    });
  } catch (err) {
    console.error('checkDeficiency 에러:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
