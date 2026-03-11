import { pool } from '../../database/databaseConnect.js';
import { v4 as uuidv4 } from 'uuid';
import { findUserById } from './userModel.js';
import { calculateDailyNutritionGoals } from '../services/goalCalculationService.js';

/**
 * nutrition_goals 테이블에서 사용자·날짜별 목표 조회
 * @param {string} userId
 * @param {string} targetDate - YYYY-MM-DD
 * @returns {Promise<Object|null>}
 */
export async function getGoals(userId, targetDate) {
  const query = `
    SELECT id, user_id, target_date, target_calories, target_carbohydrate,
           target_protein, target_fat, target_sugars, created_at, updated_at
    FROM nutrition_goals
    WHERE user_id = $1 AND target_date = $2::date
    ORDER BY created_at DESC
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(query, [userId, targetDate]);
    return rows[0] || null;
  } catch (error) {
    console.error('getGoals 에러:', error);
    throw error;
  }
}

/**
 * nutrition_goals UPSERT (기존 행 있으면 UPDATE, 없으면 INSERT)
 * @param {string} userId
 * @param {string} targetDate - YYYY-MM-DD
 * @param {Object} goals - { target_calories, target_carbohydrate, target_protein, target_fat, target_sugars }
 * @returns {Promise<Object>}
 */
export async function upsertGoals(userId, targetDate, goals) {
  const {
    target_calories,
    target_carbohydrate,
    target_protein,
    target_fat,
    target_sugars,
  } = goals;

  try {
    const existing = await getGoals(userId, targetDate);

    if (existing) {
      const updateQuery = `
        UPDATE nutrition_goals
        SET target_calories = $1, target_carbohydrate = $2, target_protein = $3,
            target_fat = $4, target_sugars = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, user_id, target_date, target_calories, target_carbohydrate,
                  target_protein, target_fat, target_sugars, updated_at
      `;
      const { rows } = await pool.query(updateQuery, [
        target_calories,
        target_carbohydrate,
        target_protein,
        target_fat,
        target_sugars,
        existing.id,
      ]);
      return rows[0];
    }

    const id = uuidv4();
    const insertQuery = `
      INSERT INTO nutrition_goals (id, user_id, target_date, target_calories,
        target_carbohydrate, target_protein, target_fat, target_sugars)
      VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8)
      RETURNING id, user_id, target_date, target_calories, target_carbohydrate,
                target_protein, target_fat, target_sugars, created_at
    `;
    const { rows } = await pool.query(insertQuery, [
      id,
      userId,
      targetDate,
      target_calories,
      target_carbohydrate,
      target_protein,
      target_fat,
      target_sugars,
    ]);
    return rows[0];
  } catch (error) {
    console.error('upsertGoals 에러:', error);
    throw error;
  }
}

/**
 * 목표 조회 또는 없으면 사용자 정보 기반 자동 계산 후 저장
 * @param {string} userId
 * @param {string} targetDate - YYYY-MM-DD
 * @param {Object} [user] - { height, weight, gender, age_group } (미제공 시 DB에서 조회)
 * @returns {Promise<Object>}
 */
export async function getOrCreateGoals(userId, targetDate, user = null) {
  const existing = await getGoals(userId, targetDate);
  if (existing) return existing;

  const profile = user || (await findUserById(userId));
  const goals = calculateDailyNutritionGoals(profile || {});
  const saved = await upsertGoals(userId, targetDate, goals);
  return saved;
}
