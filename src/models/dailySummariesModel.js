/**
 * daily_summaries 테이블 조회
 * Task 10: 일별 집계 조회 API
 */
import { pool } from '../../database/databaseConnect.js';

/**
 * 특정 날짜 daily_summaries 조회
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 */
export async function getSummary(userId, dateStr) {
  const res = await pool.query(
    `SELECT summary_date, total_calories, total_carbohydrate, total_protein,
            total_fat, total_sugars, score, goal_achieved
     FROM daily_summaries
     WHERE user_id = $1 AND summary_date = $2::date`,
    [userId, dateStr]
  );
  return res.rows[0] || null;
}

/**
 * 날짜 범위 내 daily_summaries 조회 (주간리포트 7일용)
 * @param {string} userId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export async function getSummariesInRange(userId, startDate, endDate) {
  const res = await pool.query(
    `SELECT summary_date, total_calories, total_carbohydrate, total_protein,
            total_fat, total_sugars, score, goal_achieved
     FROM daily_summaries
     WHERE user_id = $1 AND summary_date >= $2::date AND summary_date <= $3::date
     ORDER BY summary_date ASC`,
    [userId, startDate, endDate]
  );
  return res.rows;
}
