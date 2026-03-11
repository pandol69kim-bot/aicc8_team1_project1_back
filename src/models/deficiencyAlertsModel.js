/**
 * deficiency_alerts 테이블 연동
 * Task 8: 결핍 감지 시 기록
 */
import { pool } from '../../database/databaseConnect.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 결핍 알림 기록
 * @param {Object} params - { userId, deficiencyType, currentValue, targetValue, notificationId? }
 */
export async function insertDeficiencyAlert({
  userId,
  deficiencyType,
  currentValue,
  targetValue,
  notificationId = null,
}) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO deficiency_alerts (id, user_id, notification_id, deficiency_type, current_value, target_value, detected_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [id, userId, notificationId, deficiencyType, currentValue, targetValue]
  );
  return id;
}
