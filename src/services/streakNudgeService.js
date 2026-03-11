import { pool } from '../../database/databaseConnect.js';
import { createNotification } from '../models/notificationsModel.js';
import { getUsersConfigForType, isInTimeWindow } from '../models/notificationTypeSettingsModel.js';

const MILESTONES = [
  { days: 7, title: '연속 기록 응원 - 7일', message: "와, 7일 연속 기록이에요! 꾸준함이 영양 습관을 바꿔요. 다음 주도 화이팅! 🔥" },
  { days: 3, title: '연속 기록 응원 - 3일', message: "벌써 3일째 모든 식단을 기록 중이시네요! 이번 주 주간 리포트가 기대돼요. 🔥" },
];

/**
 * 해당 날짜에 아침/점심/저녁 모두 기록했는지
 */
async function isDayComplete(userId, dateStr) {
  const res = await pool.query(
    `SELECT COUNT(DISTINCT meal_type) AS cnt
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
       AND meal_type IN ('breakfast', 'lunch', 'dinner')
       AND deleted_at IS NULL`,
    [userId, dateStr]
  );
  return parseInt(res.rows[0]?.cnt ?? 0, 10) === 3;
}

/**
 * 어제 기준 연속 완료 일수
 */
async function getConsecutiveStreak(userId) {
  const todayRes = await pool.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today`
  );
  const today = todayRes.rows[0].today;
  let streak = 0;
  let d = new Date(today);
  d.setDate(d.getDate() - 1); // 어제부터

  for (let i = 0; i < 60; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    const complete = await isDayComplete(userId, dateStr);
    if (!complete) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/**
 * 해당 마일스톤 알림 이미 발송했는지 (오늘 기준, mealNudgeService 패턴)
 */
async function alreadySentStreak(userId, title) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'streak' AND title = $2
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
     LIMIT 1`,
    [userId, title]
  );
  return res.rows.length > 0;
}

/**
 * 연속 기록 응원 알림 배치
 * - 어제까지 연속 N일 아침/점심/저녁 모두 기록한 사용자
 * - 3일, 7일 마일스톤 도달 시 1회만 발송
 * - 사용자 설정 time ±30분 창에만 실행 (기본 23:00)
 */
export async function runStreakNudgeJob() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let sent = 0;
  try {
    const usersWithConfig = await getUsersConfigForType('streak');

    for (const { userId, config } of usersWithConfig) {
      if (!isInTimeWindow(config.time, currentMinutes)) continue;
      const streak = await getConsecutiveStreak(userId);
      for (const m of MILESTONES) {
        if (streak >= m.days) {
          const sentBefore = await alreadySentStreak(userId, m.title);
          if (sentBefore) continue;
          await createNotification({
            userId,
            type: 'streak',
            title: m.title,
            message: m.message,
          });
          sent++;
          break; // 한 사용자당 마일스톤당 1회만
        }
      }
    }
    return { sent };
  } catch (error) {
    console.error('runStreakNudgeJob 에러:', error);
    throw error;
  }
}
