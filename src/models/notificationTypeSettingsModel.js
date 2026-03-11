import { pool } from '../../database/databaseConnect.js';

const NOTIFICATION_TYPES = [
  'meal_nudge',
  'streak',
  'insight_sugar_fat',
  'insight_protein',
  'recommendation_tomorrow',
  'recommendation_menu',
  'weekly_report',
  'goal_achievement',
];

const DEFAULT_CONFIG = {
  meal_nudge: {
    breakfastTime: '08:00',
    lunchTime: '12:30',
    dinnerTime: '19:00',
  },
  streak: { time: '23:00' },
  insight_sugar_fat: { time1: '14:00', time2: '20:30' },
  insight_protein: { time: '20:00' },
  recommendation_tomorrow: { time: '20:30' },
  recommendation_menu: { time1: '11:30', time2: '17:30' },
  weekly_report: { dayOfWeek: 1, time: '08:30' },
  goal_achievement: { dayOfWeek: 1, time: '08:35' },
};

/**
 * 사용자 알림 유형별 설정 조회 (없으면 기본값 반환)
 */
export { NOTIFICATION_TYPES, DEFAULT_CONFIG };

export async function getNotificationTypeSettings(userId) {
  const [rowsRes, mealPatternRes] = await Promise.all([
    pool.query(
      `SELECT type, enabled, config FROM notification_type_settings WHERE user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT breakfast_time, lunch_time, dinner_time FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    ),
  ]);

  const db = Object.fromEntries(
    rowsRes.rows.map((r) => [
      r.type,
      { enabled: r.enabled, config: r.config || {} },
    ]),
  );

  const mealPattern = mealPatternRes.rows[0];
  const mealTimes = mealPattern
    ? {
        breakfastTime: mealPattern.breakfast_time
          ? String(mealPattern.breakfast_time).slice(0, 5)
          : '08:00',
        lunchTime: mealPattern.lunch_time
          ? String(mealPattern.lunch_time).slice(0, 5)
          : '12:30',
        dinnerTime: mealPattern.dinner_time
          ? String(mealPattern.dinner_time).slice(0, 5)
          : '19:00',
      }
    : DEFAULT_CONFIG.meal_nudge;

  const result = {};
  for (const type of NOTIFICATION_TYPES) {
    const row = db[type];
    const baseConfig = DEFAULT_CONFIG[type] || {};
    const merged =
      type === 'meal_nudge'
        ? { ...baseConfig, ...mealTimes }
        : { ...baseConfig, ...(row?.config || {}) };
    result[type] = {
      enabled: row?.enabled ?? true,
      config: merged,
    };
  }
  return result;
}

/**
 * receive_notifications=true 사용자 중 type이 활성화된 사용자들의 config 조회
 * @returns {Promise<Array<{ userId: string, config: object }>>}
 */
export async function getUsersConfigForType(type) {
  const defaults = JSON.stringify(DEFAULT_CONFIG[type] || {});
  const res = await pool.query(
    `SELECT u.id AS "userId",
            ($2::jsonb || COALESCE(nts.config, '{}'::jsonb)) AS config,
            COALESCE(nts.enabled, true) AS enabled
     FROM users u
     LEFT JOIN notification_type_settings nts ON nts.user_id = u.id AND nts.type = $1
     WHERE u.receive_notifications = true AND u.deleted_at IS NULL`,
    [type, defaults],
  );
  return res.rows
    .filter((r) => r.enabled !== false)
    .map((r) => ({ userId: r.userId, config: r.config }));
}

/** "08:00" → 분(480), "20:30" → 1230 */
export function timeToMinutes(str) {
  if (!str) return null;
  const s = String(str).trim();
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return (h || 0) * 60 + (Number.isNaN(m) ? 0 : m);
}

/** 현재 시각(분)이 설정시간과 일치하는지 (정해진 시각 HH:MM에만) */
export function isInTimeWindow(configuredStr, currentMinutes) {
  const configured = timeToMinutes(configuredStr);
  if (configured == null) return false;
  return currentMinutes === configured;
}

/**
 * 특정 알림 유형이 사용자에게 활성화되어 있는지
 */
export async function isNotificationTypeEnabled(userId, type) {
  const res = await pool.query(
    `SELECT enabled FROM notification_type_settings WHERE user_id = $1 AND type = $2`,
    [userId, type],
  );
  if (res.rows.length === 0) return true;
  return res.rows[0].enabled === true;
}

/**
 * 알림 유형별 설정 업데이트 (UPSERT)
 * @param {string} userId
 * @param {Object} updates - { meal_nudge: { enabled, config }, ... }
 */
export async function updateNotificationTypeSettings(userId, updates) {
  const client = await pool.connect();
  try {
    for (const [type, payload] of Object.entries(updates)) {
      if (!NOTIFICATION_TYPES.includes(type)) continue;
      const enabled = payload.enabled === undefined ? true : payload.enabled;
      const config = payload.config ?? {};
      await client.query(
        `INSERT INTO notification_type_settings (user_id, type, enabled, config, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (user_id, type)
         DO UPDATE SET
           enabled = $3,
           config = CASE WHEN $4::jsonb != '{}'::jsonb
             THEN notification_type_settings.config || $4::jsonb
             ELSE notification_type_settings.config END,
           updated_at = NOW()`,
        [userId, type, enabled, JSON.stringify(config)],
      );
    }
    return getNotificationTypeSettings(userId);
  } finally {
    client.release();
  }
}
