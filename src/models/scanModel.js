import { pool } from '../../database/databaseConnect.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * AI 스캔 결과 데이터 저장 (ai_scans)
 */
export const saveAiScanData = async (userId, imageUrl, scanResult) => {
    const query = `
        INSERT INTO ai_scans (id, user_id, image_url, scan_result)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const values = [uuidv4(), userId, imageUrl, JSON.stringify(scanResult)];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

/**
 * AI 스캔 정보 조회
 */
export const getAiScanById = async (id) => {
    const query = `SELECT * FROM ai_scans WHERE id = $1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
};

/**
 * 식단 기록 데이터 배열 저장 (diary_entries)
 */
export const saveDiaryEntries = async ({ user_id, ai_scan_id, meal_type, mealTime, foods, image_url }) => {
    const results = [];
    const timeToUse = mealTime || new Date().toISOString();

    for (const food of foods) {
        const query = `
            INSERT INTO diary_entries (
                id, user_id, ai_scan_id, meal_type, meal_time,
                snap_food_name, snap_calories, snap_carbohydrate, snap_protein, snap_fat, snap_sugars,
                serving_size, image_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;
        const values = [
            uuidv4(),
            user_id,
            ai_scan_id || null,
            meal_type,
            timeToUse,
            food.snap_food_name,
            food.snap_calories || 0,
            food.snap_carbohydrate || 0,
            food.snap_protein || 0,
            food.snap_fat || 0,
            food.snap_sugars || 0,
            food.serving_size || 0,
            image_url || null
        ];
        const { rows } = await pool.query(query, values);
        results.push(rows[0]);
    }
    return results;
};
