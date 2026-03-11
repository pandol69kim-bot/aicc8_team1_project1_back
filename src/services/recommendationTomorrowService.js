import { pool } from '../../database/databaseConnect.js';
import { createNotification } from '../models/notificationsModel.js';
import { getOrCreateGoals } from '../models/nutritionGoalsModel.js';
import { insertDeficiencyAlert } from '../models/deficiencyAlertsModel.js';
import { getUsersConfigForType, isInTimeWindow } from '../models/notificationTypeSettingsModel.js';
import { findUserById } from '../models/userModel.js';
import { getExcludedKeywords, pickCompatibleMenu } from '../utils/allergyFilter.js';

const DEFAULTS = { carb: 250, protein: 50, fat: 65 };
const MIN_DEFICIT_RATIO = 0.2;  // 목표의 20% 이상 부족 시 제안

/** 부족 영양소 → 내일 아침 추천 메뉴 (알레르기 시 대체 메뉴 포함) */
const SUGGESTIONS = {
  carb: [
    { label: '식이섬유·탄수화물', menu: '사과와 요거트', emoji: '🍎' },
    { label: '식이섬유·탄수화물', menu: '귤과 고구마', emoji: '🍊' },
    { label: '식이섬유·탄수화물', menu: '바나나와 오트밀', emoji: '🍌' },
  ],
  protein: [
    { label: '단백질', menu: '계란과 두유', emoji: '🥚' },
    { label: '단백질', menu: '두부와 해초', emoji: '🧈' },
  ],
  fat: [
    { label: '건강한 지방', menu: '아보카도와 견과류', emoji: '🥑' },
    { label: '건강한 지방', menu: '올리브오일 샐러드', emoji: '🥗' },
  ],
};

/**
 * 오늘 일간 영양 합계
 */
async function getDailyTotals(userId, dateStr) {
  const res = await pool.query(
    `SELECT
       COALESCE(SUM(snap_carbohydrate), 0) AS carb,
       COALESCE(SUM(snap_protein), 0) AS protein,
       COALESCE(SUM(snap_fat), 0) AS fat
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
       AND deleted_at IS NULL`,
    [userId, dateStr]
  );
  const r = res.rows[0] || {};
  return {
    carb: parseFloat(r.carb) || 0,
    protein: parseFloat(r.protein) || 0,
    fat: parseFloat(r.fat) || 0,
  };
}

/**
 * 목표 영양소 (없으면 getOrCreateGoals로 자동 생성)
 */
async function getTargets(userId, dateStr) {
  const goals = await getOrCreateGoals(userId, dateStr);
  return {
    carb: goals?.target_carbohydrate != null ? Number(goals.target_carbohydrate) : DEFAULTS.carb,
    protein: goals?.target_protein != null ? Number(goals.target_protein) : DEFAULTS.protein,
    fat: goals?.target_fat != null ? Number(goals.target_fat) : DEFAULTS.fat,
  };
}

/**
 * 가장 부족한 영양소 (목표 대비 비율)
 */
function getMostDeficient(current, target) {
  let maxDeficit = 0;
  let key = null;
  for (const k of ['carb', 'protein', 'fat']) {
    const t = target[k] || DEFAULTS[k];
    const c = current[k] || 0;
    if (t <= 0) continue;
    const deficit = (t - c) / t;
    if (deficit >= MIN_DEFICIT_RATIO && deficit > maxDeficit) {
      maxDeficit = deficit;
      key = k;
    }
  }
  return key;
}

/**
 * 오늘 recommendation_tomorrow 이미 발송했는지 (mealNudgeService 패턴 - type+title+DB 현재 날짜)
 */
async function alreadySent(userId) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'recommendation_tomorrow' AND title = '내일의 식단 제안'
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
     LIMIT 1`,
    [userId]
  );
  return res.rows.length > 0;
}

/**
 * 내일의 식단 제안 알림 배치
 * - 사용자 설정 time ±30분 창에만 실행 (기본 20:30)
 */
export async function runRecommendationTomorrowJob() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayRes = await pool.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today`
  );
  const dateStr = todayRes.rows[0].today.toISOString().slice(0, 10);
  let sent = 0;

  try {
    const usersWithConfig = await getUsersConfigForType('recommendation_tomorrow');

    for (const { userId, config } of usersWithConfig) {
      if (!isInTimeWindow(config.time, currentMinutes)) continue;
      const [current, target] = await Promise.all([
        getDailyTotals(userId, dateStr),
        getTargets(userId, dateStr),
      ]);
      const deficient = getMostDeficient(current, target);
      if (!deficient) continue;
      if (await alreadySent(userId)) continue;

      const user = await findUserById(userId);
      const excluded = getExcludedKeywords(user || {});
      const s = pickCompatibleMenu(SUGGESTIONS[deficient], excluded);
      if (!s) continue;

      const message = `내일 아침은 오늘 부족했던 ${s.label}를 채워줄 '${s.menu}' 식단 어떠세요? ${s.emoji}`;
      const notif = await createNotification({
        userId,
        type: 'recommendation_tomorrow',
        title: '내일의 식단 제안',
        message,
      });
      const typeMap = { carb: 'CARBOHYDRATE', protein: 'PROTEIN', fat: 'FAT' };
      await insertDeficiencyAlert({
        userId,
        deficiencyType: typeMap[deficient] || deficient.toUpperCase(),
        currentValue: current[deficient],
        targetValue: target[deficient],
        notificationId: notif?.id,
      }).catch((err) => console.error('deficiency_alerts INSERT 실패:', err.message));
      sent++;
    }
    return { sent };
  } catch (error) {
    console.error('runRecommendationTomorrowJob 에러:', error);
    throw error;
  }
}
