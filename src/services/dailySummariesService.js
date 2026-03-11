/**
 * Task 4: daily_summaries 일별 집계 서비스
 * diary_entries 기반 일별 영양소 집계, score·goal_achieved 계산 후 UPSERT
 */
import { pool } from '../../database/databaseConnect.js';
import { v4 as uuidv4 } from 'uuid';
import { getOrCreateGoals } from '../models/nutritionGoalsModel.js';

const GOAL_ACHIEVED_SCORE = 85;

/**
 * nutrition_goals target과 실제 섭취량으로 영양 점수(0~100) 계산
 * 프론트 calculateNutritionScore와 동일 로직, 일일 기준
 */
function calculateScore(actual, target) {
  const cal = (a, g) => (g > 0 ? a / g : 1);
  const getComponentScore = (input, goal, type) => {
    const ratio = cal(input, goal);
    if (type === 'sugar') {
      return ratio <= 1 ? 100 : Math.max(0, 100 - (ratio - 1) * 150);
    }
    if (type === 'protein') {
      if (ratio < 1) return ratio * 100;
      return Math.max(70, 100 - (ratio - 1) * 20);
    }
    return Math.max(0, 100 - Math.abs(1 - ratio) * 80);
  };

  const weights = { cal: 0.2, carb: 0.2, pro: 0.25, fat: 0.15, sug: 0.2 };
  const calScore = getComponentScore(actual.calories, target.calories, 'calories');
  const carbScore = getComponentScore(actual.carbohydrate, target.carbohydrate, 'carbs');
  const proScore = getComponentScore(actual.protein, target.protein, 'protein');
  const fatScore = getComponentScore(actual.fat, target.fat, 'fat');
  const sugScore = getComponentScore(actual.sugars, target.sugars, 'sugar');

  return Math.round(
    calScore * weights.cal +
      carbScore * weights.carb +
      proScore * weights.pro +
      fatScore * weights.fat +
      sugScore * weights.sug
  );
}

/**
 * diary_entries에서 해당 날짜 영양소 합계 조회
 */
async function getDiaryTotals(userId, dateStr) {
  const res = await pool.query(
    `SELECT
       COALESCE(SUM(snap_calories), 0) AS total_calories,
       COALESCE(SUM(snap_carbohydrate), 0) AS total_carbohydrate,
       COALESCE(SUM(snap_protein), 0) AS total_protein,
       COALESCE(SUM(snap_fat), 0) AS total_fat,
       COALESCE(SUM(snap_sugars), 0) AS total_sugars,
       COALESCE(SUM(snap_sodium), 0) AS total_sodium,
       COALESCE(SUM(snap_cholesterol), 0) AS total_cholesterol,
       COALESCE(SUM(snap_saturated_fat), 0) AS total_saturated_fat,
       COALESCE(SUM(snap_trans_fat), 0) AS total_trans_fat
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
       AND deleted_at IS NULL`,
    [userId, dateStr]
  );
  const r = res.rows[0];
  return {
    total_calories: Number(r?.total_calories ?? 0),
    total_carbohydrate: Number(r?.total_carbohydrate ?? 0),
    total_protein: Number(r?.total_protein ?? 0),
    total_fat: Number(r?.total_fat ?? 0),
    total_sugars: Number(r?.total_sugars ?? 0),
    total_sodium: Number(r?.total_sodium ?? 0),
    total_cholesterol: Number(r?.total_cholesterol ?? 0),
    total_saturated_fat: Number(r?.total_saturated_fat ?? 0),
    total_trans_fat: Number(r?.total_trans_fat ?? 0),
  };
}

/**
 * 해당 날짜 일별 집계 및 daily_summaries UPSERT
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function summarizeDay(userId, dateStr) {
  const [totals, goalsRow] = await Promise.all([
    getDiaryTotals(userId, dateStr),
    getOrCreateGoals(userId, dateStr),
  ]);

  const actual = {
    calories: totals.total_calories,
    carbohydrate: totals.total_carbohydrate,
    protein: totals.total_protein,
    fat: totals.total_fat,
    sugars: totals.total_sugars,
  };

  const target = {
    calories: Number(goalsRow.target_calories) || 2000,
    carbohydrate: Number(goalsRow.target_carbohydrate) || 250,
    protein: Number(goalsRow.target_protein) || 100,
    fat: Number(goalsRow.target_fat) || 65,
    sugars: Number(goalsRow.target_sugars) || 50,
  };

  const score = calculateScore(actual, target);
  const goal_achieved = score >= GOAL_ACHIEVED_SCORE;

  const query = `
    INSERT INTO daily_summaries (
      id, user_id, summary_date,
      total_calories, total_carbohydrate, total_protein, total_fat, total_sugars,
      total_sodium, total_cholesterol, total_saturated_fat, total_trans_fat,
      score, goal_achieved, analyzed_at, updated_at
    ) VALUES (
      $1, $2, $3::date,
      $4, $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, summary_date) DO UPDATE SET
      total_calories = EXCLUDED.total_calories,
      total_carbohydrate = EXCLUDED.total_carbohydrate,
      total_protein = EXCLUDED.total_protein,
      total_fat = EXCLUDED.total_fat,
      total_sugars = EXCLUDED.total_sugars,
      total_sodium = EXCLUDED.total_sodium,
      total_cholesterol = EXCLUDED.total_cholesterol,
      total_saturated_fat = EXCLUDED.total_saturated_fat,
      total_trans_fat = EXCLUDED.total_trans_fat,
      score = EXCLUDED.score,
      goal_achieved = EXCLUDED.goal_achieved,
      analyzed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `;

  const id = uuidv4();
  await pool.query(query, [
    id,
    userId,
    dateStr,
    totals.total_calories,
    totals.total_carbohydrate,
    totals.total_protein,
    totals.total_fat,
    totals.total_sugars,
    totals.total_sodium,
    totals.total_cholesterol,
    totals.total_saturated_fat,
    totals.total_trans_fat,
    score,
    goal_achieved,
  ]);

  return {
    summary_date: dateStr,
    ...totals,
    score,
    goal_achieved,
  };
}

/**
 * 날짜/ISO 문자열 → Asia/Seoul 기준 YYYY-MM-DD
 */
export function toDateStrAsiaSeoul(dateOrIso) {
  const d = dateOrIso ? new Date(dateOrIso) : new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * 식사 기록 시 해당 날짜 daily_summaries 갱신 (INSERT/UPDATE/DELETE 후 호출)
 */
export async function refreshSummaryForMeal(userId, mealTime) {
  const dateStr = toDateStrAsiaSeoul(mealTime);
  await summarizeDay(userId, dateStr);
}

/**
 * 전일 식사 기록이 있는 모든 사용자에 대해 daily_summaries 갱신 (cron용)
 * 00:00~00:10 KST 구간에서만 실행 (매분 cron과 함께 사용)
 * @returns {{ summarized: number }}
 */
export async function runDailySummariesJob() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes > 10) return { summarized: 0, sent: 0 }; // 00:00~00:10만 실행

  const res = await pool.query(
    `SELECT DISTINCT user_id,
            ((meal_time AT TIME ZONE 'Asia/Seoul')::date)::text AS d
     FROM diary_entries
     WHERE (meal_time AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_DATE AT TIME ZONE 'Asia/Seoul')::date - 1
       AND deleted_at IS NULL`
  );
  let summarized = 0;
  for (const row of res.rows) {
    try {
      await summarizeDay(row.user_id, row.d);
      summarized++;
    } catch (err) {
      console.error(`daily_summaries 갱신 실패 user=${row.user_id} date=${row.d}:`, err.message);
    }
  }
  return { summarized, sent: summarized };
}
