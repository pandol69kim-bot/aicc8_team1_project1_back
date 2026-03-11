import { pool } from '../../database/databaseConnect.js';
import { createNotification } from '../models/notificationsModel.js';
import { getOrCreateGoals } from '../models/nutritionGoalsModel.js';
import { insertDeficiencyAlert } from '../models/deficiencyAlertsModel.js';
import { getUsersConfigForType, isInTimeWindow } from '../models/notificationTypeSettingsModel.js';

const DEFAULT_PROTEIN_TARGET = 50;  // g
const MIN_DEFICIT = 15;             // 15g 이상 부족 시 알림

/**
 * 오늘 일간 단백질 합계
 */
async function getDailyProtein(userId, dateStr) {
  const res = await pool.query(
    `SELECT COALESCE(SUM(snap_protein), 0) AS total
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
       AND deleted_at IS NULL`,
    [userId, dateStr]
  );
  return parseFloat(res.rows[0]?.total ?? 0) || 0;
}

/**
 * 목표 단백질 조회 (없으면 getOrCreateGoals로 자동 생성)
 */
async function getProteinTarget(userId, dateStr) {
  const goals = await getOrCreateGoals(userId, dateStr);
  const v = goals?.target_protein;
  return v != null ? Number(v) : DEFAULT_PROTEIN_TARGET;
}

/**
 * 오늘 insight_protein 이미 발송했는지 (mealNudgeService 패턴 - type+title+DB 현재 날짜)
 */
async function alreadySent(userId) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'insight_protein' AND title = '단백질 채우기'
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
     LIMIT 1`,
    [userId]
  );
  return res.rows.length > 0;
}

/**
 * 단백질 채우기 제안 알림 배치
 * - 사용자 설정 time ±30분 창에만 실행 (기본 20:00)
 * - 목표 대비 부족분 15g 이상 시 알림
 */
export async function runInsightProteinJob() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayRes = await pool.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today`
  );
  const dateStr = todayRes.rows[0].today.toISOString().slice(0, 10);
  let sent = 0;

  try {
    const usersWithConfig = await getUsersConfigForType('insight_protein');

    for (const { userId, config } of usersWithConfig) {
      if (!isInTimeWindow(config.time, currentMinutes)) continue;
      const [current, target] = await Promise.all([
        getDailyProtein(userId, dateStr),
        getProteinTarget(userId, dateStr),
      ]);
      const deficit = Math.round(target - current);
      if (deficit < MIN_DEFICIT) continue;
      if (await alreadySent(userId)) continue;

      const message = `오늘 목표 단백질까지 ${deficit}g 남았어요! 간식으로 삶은 계란이나 두유 어떠세요? 💪`;
      const notif = await createNotification({
        userId,
        type: 'insight_protein',
        title: '단백질 채우기',
        message,
      });
      await insertDeficiencyAlert({
        userId,
        deficiencyType: 'PROTEIN',
        currentValue: current,
        targetValue: target,
        notificationId: notif?.id,
      }).catch((err) => console.error('deficiency_alerts INSERT 실패:', err.message));
      sent++;
    }
    return { sent };
  } catch (error) {
    console.error('runInsightProteinJob 에러:', error);
    throw error;
  }
}
