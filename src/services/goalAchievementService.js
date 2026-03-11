import { pool } from '../../database/databaseConnect.js';
import { createNotification } from '../models/notificationsModel.js';
import { getUsersConfigForType, isInTimeWindow } from '../models/notificationTypeSettingsModel.js';

const GOAL_SCORE_THRESHOLD = 85;   // 주간 영양 점수 85점 이상
const GOAL_DAYS_THRESHOLD = 5;     // 5일 이상 목표 달성

/**
 * 지난주 목표 달성 여부
 * - daily_summaries.goal_achieved 5일 이상
 * - 또는 주간 영양 점수 85점 이상 (diary 기준)
 */
async function isGoalAchieved(userId, lastStart, lastEnd) {
  const goalRes = await pool.query(
    `SELECT COUNT(*) AS cnt FROM daily_summaries
     WHERE user_id = $1 AND summary_date >= $2 AND summary_date <= $3
       AND goal_achieved = true`,
    [userId, lastStart, lastEnd]
  );
  const goalDays = parseInt(goalRes.rows[0]?.cnt ?? 0, 10);
  if (goalDays >= GOAL_DAYS_THRESHOLD) return true;

  const daysRes = await pool.query(
    `SELECT (meal_time AT TIME ZONE 'Asia/Seoul')::date AS d,
            COUNT(DISTINCT meal_type) FILTER (WHERE meal_type IN ('breakfast','lunch','dinner')) AS meals
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date >= $2
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date <= $3
       AND deleted_at IS NULL
     GROUP BY (meal_time AT TIME ZONE 'Asia/Seoul')::date`,
    [userId, lastStart, lastEnd]
  );
  if (daysRes.rows.length < 5) return false;
  let sum = 0;
  for (const r of daysRes.rows) {
    const m = parseInt(r.meals, 10) || 0;
    sum += m === 3 ? 100 : m === 2 ? 66 : m === 1 ? 33 : 0;
  }
  const avgScore = sum / 7;
  return avgScore >= GOAL_SCORE_THRESHOLD;
}

/**
 * 이번 주(월)에 이미 발송했는지 (mealNudgeService 패턴 - type+title+DB 날짜)
 */
async function alreadySentThisWeek(userId, mondayStr) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'goal_achievement' AND title = '목표 달성!'
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date >= $2::date
     LIMIT 1`,
    [userId, mondayStr]
  );
  return res.rows.length > 0;
}

/**
 * 목표 달성 축하 알림 배치
 * - 사용자 설정 dayOfWeek(기본 월), time ±30분 창에 실행
 */
export async function runGoalAchievementJob() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay(); // 0=일, 1=월, ...

  const nowRes = await pool.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today`
  );
  const today = nowRes.rows[0].today;
  const lastWeekEnd = new Date(today);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);

  const lastStart = lastWeekStart.toISOString().slice(0, 10);
  const lastEnd = lastWeekEnd.toISOString().slice(0, 10);
  const thisMondayStr = today.toISOString().slice(0, 10);
  let sent = 0;

  try {
    const usersWithConfig = await getUsersConfigForType('goal_achievement');

    for (const { userId, config } of usersWithConfig) {
      const targetDay = Number(config.dayOfWeek ?? 1); // 기본 월요일 (1=월)
      const inWindow = dayOfWeek === targetDay && isInTimeWindow(config.time, currentMinutes);
      if (!inWindow) continue;
      if (await alreadySentThisWeek(userId, thisMondayStr)) continue;
      if (!(await isGoalAchieved(userId, lastStart, lastEnd))) continue;

      await createNotification({
        userId,
        type: 'goal_achievement',
        title: '목표 달성!',
        message: '축하합니다! 이번 주 목표 체중/영양 균형을 완벽하게 지키셨어요. 💪',
      });
      sent++;
    }
    return { sent };
  } catch (error) {
    console.error('runGoalAchievementJob 에러:', error);
    throw error;
  }
}
