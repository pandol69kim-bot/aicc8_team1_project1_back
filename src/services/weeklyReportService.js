import { pool } from '../../database/databaseConnect.js';
import { createNotification } from '../models/notificationsModel.js';
import { getUsersConfigForType, isInTimeWindow } from '../models/notificationTypeSettingsModel.js';

/**
 * 주간 영양 점수 (0~100)
 * - daily_summaries.score 평균 우선, 없으면 diary 기록률로 계산
 */
async function getWeeklyScore(userId, startDate, endDate) {
  const res = await pool.query(
    `SELECT AVG(score)::numeric AS avg_score, COUNT(*) AS cnt
     FROM daily_summaries
     WHERE user_id = $1 AND summary_date >= $2 AND summary_date <= $3`,
    [userId, startDate, endDate]
  );
  const avg = res.rows[0]?.avg_score;
  if (avg != null && res.rows[0].cnt > 0) {
    return Math.round(Number(avg));
  }

  const daysRes = await pool.query(
    `SELECT (meal_time AT TIME ZONE 'Asia/Seoul')::date AS d,
            COUNT(DISTINCT meal_type) FILTER (WHERE meal_type IN ('breakfast','lunch','dinner')) AS meals
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date >= $2
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date <= $3
       AND deleted_at IS NULL
     GROUP BY (meal_time AT TIME ZONE 'Asia/Seoul')::date`,
    [userId, startDate, endDate]
  );
  if (daysRes.rows.length === 0) return null;
  let sum = 0;
  for (const r of daysRes.rows) {
    const m = parseInt(r.meals, 10) || 0;
    sum += m === 3 ? 100 : m === 2 ? 66 : m === 1 ? 33 : 0;
  }
  return Math.round(sum / 7);
}

/**
 * 이번 주(월)에 이미 발송했는지 (mealNudgeService 패턴 - type+title+DB 날짜)
 */
async function alreadySentThisWeek(userId, mondayStr) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'weekly_report' AND title = '주간 리포트'
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date >= $2::date
     LIMIT 1`,
    [userId, mondayStr]
  );
  return res.rows.length > 0;
}

/**
 * 주간 리포트 알림 배치
 * - 사용자 설정 dayOfWeek(기본 월), time ±30분 창에 실행
 */
export async function runWeeklyReportJob() {
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
  const prevWeekEnd = new Date(lastWeekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekStart.getDate() - 6);

  const lastStart = lastWeekStart.toISOString().slice(0, 10);
  const lastEnd = lastWeekEnd.toISOString().slice(0, 10);
  const prevStart = prevWeekStart.toISOString().slice(0, 10);
  const prevEnd = prevWeekEnd.toISOString().slice(0, 10);
  const thisMondayStr = today.toISOString().slice(0, 10);

  let sent = 0;

  try {
    const usersWithConfig = await getUsersConfigForType('weekly_report');

    for (const { userId, config } of usersWithConfig) {
      const targetDay = Number(config.dayOfWeek ?? 1); // 기본 월요일 (1=월)
      const inWindow = dayOfWeek === targetDay && isInTimeWindow(config.time, currentMinutes);
      if (!inWindow) continue;
      if (await alreadySentThisWeek(userId, thisMondayStr)) continue;

      const [lastScore, prevScore] = await Promise.all([
        getWeeklyScore(userId, lastStart, lastEnd),
        getWeeklyScore(userId, prevStart, prevEnd),
      ]);

      if (lastScore == null) continue;

      let message;
      if (prevScore != null) {
        const diff = lastScore - prevScore;
        if (diff > 0) {
          message = `지난주 'HoneyMat' 리포트가 도착했습니다! 지난주보다 영양 점수가 ${diff}점 올랐어요! 📈`;
        } else if (diff < 0) {
          message = `지난주 'HoneyMat' 리포트가 도착했습니다! 이번 주는 조금만 더 신경 써보아요. 📋`;
        } else {
          message = `지난주 'HoneyMat' 리포트가 도착했습니다! 꾸준히 잘 기록하고 계세요. 📋`;
        }
      } else {
        message = `지난주 'HoneyMat' 리포트가 도착했습니다! 영양 점수 ${lastScore}점이에요. 📈`;
      }

      await createNotification({
        userId,
        type: 'weekly_report',
        title: '주간 리포트',
        message,
      });
      sent++;
    }
    return { sent };
  } catch (error) {
    console.error('runWeeklyReportJob 에러:', error);
    throw error;
  }
}
