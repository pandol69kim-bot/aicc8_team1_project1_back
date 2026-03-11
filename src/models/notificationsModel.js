import { pool } from '../../database/databaseConnect.js';
import { v4 as uuidv4 } from "uuid";

/**
 * 알림 목록 조회
 */
export const getUserNotifications = async (userId) => {
    const query = `
    SELECT id, type, title, message, is_read, created_at
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
    try {
        const { rows } = await pool.query(query, [userId]);
        // 클라이언트 명세에 맞게 읽음 상태 필드명 매핑 (is_read -> read)
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            title: row.title,
            message: row.message,
            read: row.is_read,
            createdAt: row.created_at
        }));
    } catch (error) {
        console.error('getUserNotifications 에러:', error);
        throw error;
    }
};

/**
 * 알림 생성
 * @param {{ userId: string, type: string, title: string, message: string }} data
 */
export const createNotification = async ({ userId, type, title, message }) => {
    const id = uuidv4();
    const query = `
    INSERT INTO notifications (id, user_id, type, title, message, is_read)
    VALUES ($1, $2, $3, $4, $5, false)
    RETURNING id, type, title, message, is_read, created_at
  `;
    try {
        const { rows } = await pool.query(query, [id, userId, type, title, message]);
        return rows[0];
    } catch (error) {
        console.error('createNotification 에러:', error);
        throw error;
    }
};

/**
 * 특정 알림 읽음 처리
 */
export const markNotificationAsRead = async (notificationId, userId) => {
    const query = `
    UPDATE notifications
    SET is_read = true, read_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `;
    try {
        const { rows } = await pool.query(query, [notificationId, userId]);
        return rows[0];
    } catch (error) {
        console.error('markNotificationAsRead 에러:', error);
        throw error;
    }
};

/**
 * 알림 환경설정 조회
 */
export const getNotificationSettings = async (userId) => {
    const query = `
    SELECT receive_notifications
    FROM users
    WHERE id = $1 AND deleted_at IS NULL
  `;
    try {
        const { rows } = await pool.query(query, [userId]);
        return rows[0];
    } catch (error) {
        console.error('getNotificationSettings 에러:', error);
        throw error;
    }
};

/**
 * 알림 환경설정 업데이트 (users 테이블의 receive_notifications 컬럼 등 활용)
 */
export const updateNotificationSettings = async (userId, receiveNotifications) => {
    const query = `
    UPDATE users
    SET receive_notifications = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND deleted_at IS NULL
    RETURNING receive_notifications
  `;
    try {
        const { rows } = await pool.query(query, [receiveNotifications, userId]);
        return rows[0];
    } catch (error) {
        console.error('updateNotificationSettings 에러:', error);
        throw error;
    }
};
