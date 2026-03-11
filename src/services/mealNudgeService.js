import { pool } from '../../database/databaseConnect.js';
import { createNotification } from '../models/notificationsModel.js';
import { isNotificationTypeEnabled } from '../models/notificationTypeSettingsModel.js';

const MEAL_META = {
  breakfast: {
    mealType: 'breakfast',
    title: '아침 기록 알림',
    message:
      "오늘 아침은 무엇을 드셨나요? 사진 한 장으로 '꿀맛' 점수를 확인해보세요! 🍯",
  },
  lunch: {
    mealType: 'lunch',
    title: '점심 기록 알림',
    message:
      "오늘 점심은 무엇을 드셨나요? 사진 한 장으로 '꿀맛' 점수를 확인해보세요! 🍯",
  },
  dinner: {
    mealType: 'dinner',
    title: '저녁 기록 알림',
    message:
      "오늘 저녁은 무엇을 드셨나요? 사진 한 장으로 '꿀맛' 점수를 확인해보세요! 🍯",
  },
};

/** "08:00" → 480 (분), "20:30" → 1230 */
function timeToMinutes(str) {
  if (!str) return null;
  const s = String(str).trim();
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return (h || 0) * 60 + (Number.isNaN(m) ? 0 : m);
}

/**
 * 현재 시각이 설정 시간과 일치하는지 (정해진 시각 HH:MM에만)
 */
function isInUserTimeWindow(configuredStr, currentMinutes) {
  const configured = timeToMinutes(configuredStr);
  if (configured == null) return false;
  return currentMinutes === configured;
}

/**
 * meal nudge job 실행
 * - receive_notifications=true 사용자만 대상
 * - 각 사용자의 설정된 아침/점심/저녁 시간(users.breakfast_time 등) 구간에 발송
 * - 오늘 해당 끼니 미기록 & 같은 끼니 중복 발송 없음
 */
export async function runMealNudgeJob() {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
  );
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let sent = 0;
  try {
    const usersRes = await pool.query(
      `SELECT id, breakfast_time, lunch_time, dinner_time
       FROM users
       WHERE receive_notifications = true AND deleted_at IS NULL`,
    );
    const users = usersRes.rows;

    for (const row of users) {
      const userId = row.id;
      if (!(await isNotificationTypeEnabled(userId, 'meal_nudge'))) continue;

      const bfTime = row.breakfast_time
        ? String(row.breakfast_time).slice(0, 5)
        : '08:00';
      const lnTime = row.lunch_time
        ? String(row.lunch_time).slice(0, 5)
        : '12:30';
      const dnTime = row.dinner_time
        ? String(row.dinner_time).slice(0, 5)
        : '19:00';

      let targetMeal = null;
      if (isInUserTimeWindow(bfTime, currentMinutes)) targetMeal = 'breakfast';
      else if (isInUserTimeWindow(lnTime, currentMinutes)) targetMeal = 'lunch';
      else if (isInUserTimeWindow(dnTime, currentMinutes))
        targetMeal = 'dinner';

      if (!targetMeal) continue;

      const meta = MEAL_META[targetMeal];

      const diaryRes = await pool.query(
        `SELECT 1 FROM diary_entries
         WHERE user_id = $1 AND meal_type = $2
           AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
           AND deleted_at IS NULL
         LIMIT 1`,
        [userId, targetMeal],
      );
      if (diaryRes.rows.length > 0) continue;

      const notifRes = await pool.query(
        `SELECT 1 FROM notifications
         WHERE user_id = $1 AND type = 'meal_nudge' AND title = $2
           AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
         LIMIT 1`,
        [userId, meta.title],
      );
      if (notifRes.rows.length > 0) continue;

      await createNotification({
        userId,
        type: 'meal_nudge',
        title: meta.title,
        message: meta.message,
      });
      sent++;
      console.log(`[meal-nudge] 발송: userId=${userId} ${meta.title}`);
    }

    if (sent > 0) {
      console.log(`[meal-nudge] 완료: ${sent}건 발송`);
    }
    return sent > 0
      ? { sent, mealType: 'per_user' }
      : { sent: 0, reason: 'no_match' };
  } catch (error) {
    console.error('runMealNudgeJob 에러:', error);
    throw error;
  }
}
