import { pool } from '../../database/databaseConnect.js';

/**
 * 사용자 식사 패턴 조회
 * @param {string} userId
 * @returns {Promise<{ breakfastTime: string, lunchTime: string, dinnerTime: string } | null>}
 */
export const getMealPattern = async (userId) => {
  const query = `
    SELECT breakfast_time, lunch_time, dinner_time
    FROM users
    WHERE id = $1 AND deleted_at IS NULL
  `;
  try {
    const { rows } = await pool.query(query, [userId]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      breakfastTime: r.breakfast_time ? String(r.breakfast_time).slice(0, 5) : '08:00',
      lunchTime: r.lunch_time ? String(r.lunch_time).slice(0, 5) : '12:30',
      dinnerTime: r.dinner_time ? String(r.dinner_time).slice(0, 5) : '19:00',
    };
  } catch (error) {
    console.error('getMealPattern 에러:', error);
    throw error;
  }
};

/**
 * 사용자 식사 패턴 업데이트
 * @param {string} userId
 * @param {{ breakfastTime?: string, lunchTime?: string, dinnerTime?: string }} data - HH:mm 형식
 */
export const updateMealPattern = async (userId, { breakfastTime, lunchTime, dinnerTime }) => {
  const query = `
    UPDATE users
    SET
      breakfast_time = COALESCE($1::TIME, breakfast_time),
      lunch_time = COALESCE($2::TIME, lunch_time),
      dinner_time = COALESCE($3::TIME, dinner_time),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4 AND deleted_at IS NULL
    RETURNING breakfast_time, lunch_time, dinner_time
  `;
  try {
    const { rows } = await pool.query(query, [
      breakfastTime || null,
      lunchTime || null,
      dinnerTime || null,
      userId,
    ]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      breakfastTime: r.breakfast_time ? String(r.breakfast_time).slice(0, 5) : '08:00',
      lunchTime: r.lunch_time ? String(r.lunch_time).slice(0, 5) : '12:30',
      dinnerTime: r.dinner_time ? String(r.dinner_time).slice(0, 5) : '19:00',
    };
  } catch (error) {
    console.error('updateMealPattern 에러:', error);
    throw error;
  }
};
