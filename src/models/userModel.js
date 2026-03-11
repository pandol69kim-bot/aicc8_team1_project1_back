import { pool } from '../../database/databaseConnect.js';

/**
 * 이메일로 사용자 조회
 * @param {string} email
 * @returns {Promise<Object>}
 */
const findUserByEmail = async (email) => {
  const query = 'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL';
  const values = [email];
  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error('findUserByEmail 에러:', error);
    throw error;
  }
};

/**
 * 닉네임 중복 확인 (생략 가능하나 보통 구현)
 * @param {string} nickname
 * @returns {Promise<Object>}
 */
const findUserByNickname = async (nickname) => {
  const query =
    'SELECT * FROM users WHERE nickname = $1 AND deleted_at IS NULL';
  const values = [nickname];
  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error('findUserByNickname 에러:', error);
    throw error;
  }
};

/**
 * 새로운 사용자 생성
 * @param {string} id - UUID v4
 * @param {string} email
 * @param {string} password_hash
 * @param {string} nickname
 * @returns {Promise<Object>}
 */
const createUser = async (
  id,
  email,
  password_hash,
  nickname,
  profile_image_url,
  gender,
  age_group,
  height,
  weight,
  goals,
  dietary_restrictions,
  receive_notifications,
  eating_habits,
  allergies,
) => {
  // 단일 테이블(users)에 모든 정보 삽입
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertUserQuery = `
            INSERT INTO users (id, email, password_hash, nickname, profile_image_url, gender, age_group, height, weight, goals, dietary_restrictions, receive_notifications, eating_habits, allergies)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id, email, nickname, profile_image_url, gender, age_group, height, weight, goals, dietary_restrictions, receive_notifications, eating_habits, allergies, created_at;
        `;
    const userValues = [
      id,
      email,
      password_hash,
      nickname,
      profile_image_url || null,
      gender || null,
      age_group || null,
      height || null,
      weight || null,
      goals ? JSON.stringify(goals) : '[]',
      dietary_restrictions ? JSON.stringify(dietary_restrictions) : '[]',
      receive_notifications !== undefined ? receive_notifications : true,
      eating_habits || null,
      allergies ? (Array.isArray(allergies) ? allergies : [allergies]) : null,
    ];
    const userResult = await client.query(insertUserQuery, userValues);
    const newUser = userResult.rows[0];

    await client.query('COMMIT');
    return newUser;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createUser 에러:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 비밀번호 재설정 인증 코드 저장
 */
const savePasswordResetCode = async (email, code, expiresAt) => {
  const query = `
        INSERT INTO password_resets (email, code, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) 
        DO UPDATE SET code = EXCLUDED.code, reset_token = NULL, expires_at = EXCLUDED.expires_at
    `;
  await pool.query(query, [email, code, expiresAt]);
};

/**
 * 이메일로 비밀번호 재설정 정보 조회
 */
const findPasswordResetInfo = async (email) => {
  const query = 'SELECT * FROM password_resets WHERE email = $1';
  const { rows } = await pool.query(query, [email]);
  return rows[0];
};

/**
 * 검증 성공 시 reset_token 저장
 */
const savePasswordResetToken = async (email, resetToken, expiresAt) => {
  const query = `
        UPDATE password_resets
        SET code = NULL, reset_token = $2, expires_at = $3
        WHERE email = $1
    `;
  await pool.query(query, [email, resetToken, expiresAt]);
};

/**
 * 비밀번호 업데이트 및 리셋 정보 삭제
 */
const updateUserPassword = async (email, newPasswordHash) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 비밀번호 업데이트
    await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
      newPasswordHash,
      email,
    ]);

    // 사용된 토큰/코드 정보 삭제
    await client.query('DELETE FROM password_resets WHERE email = $1', [email]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateUserPassword 에러:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ID로 사용자 조회
 * @param {string} id
 * @returns {Promise<Object>}
 */
const findUserById = async (id) => {
  const query = 'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL';
  const values = [id];
  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error('findUserById 에러:', error);
    throw error;
  }
};

/**
 * 사용자 정보 업데이트
 */
const updateProfile = async (id, updateData) => {
  const { nickname, profileImageUrl, height, weight, goals, dietaryRestrictions } = updateData;

  const query = `
    UPDATE users 
    SET 
        nickname = COALESCE($1, nickname),
        profile_image_url = COALESCE($2, profile_image_url),
        height = COALESCE($3, height),
        weight = COALESCE($4, weight),
        goals = COALESCE($5, goals),
        dietary_restrictions = COALESCE($6, dietary_restrictions),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $7 AND deleted_at IS NULL
    RETURNING id, nickname, profile_image_url, gender, age_group, height, weight, goals, dietary_restrictions
  `;

  const values = [
    nickname,
    profileImageUrl,
    height,
    weight,
    goals ? JSON.stringify(goals) : null,
    dietaryRestrictions ? JSON.stringify(dietaryRestrictions) : null,
    id
  ];

  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error('updateProfile 에러:', error);
    throw error;
  }
};

/**
 * 탈퇴(소프트 삭제: deleted_at 설정)
 */
const deleteUser = async (id) => {
  const query = `
    UPDATE users 
    SET deleted_at = CURRENT_TIMESTAMP 
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id
  `;
  try {
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  } catch (error) {
    console.error('deleteUser 에러:', error);
    throw error;
  }
};

/**
 * 프로필 이미지 업데이트 (또는 삭제 - null 처리)
 */
const updateProfileImage = async (id, profileImageUrl) => {
  const query = `
    UPDATE users 
    SET 
        profile_image_url = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND deleted_at IS NULL
    RETURNING id, profile_image_url
  `;

  try {
    const { rows } = await pool.query(query, [profileImageUrl, id]);
    return rows[0];
  } catch (error) {
    console.error('updateProfileImage 에러:', error);
    throw error;
  }
};

export {
  findUserByEmail,
  findUserByNickname,
  createUser,
  savePasswordResetCode,
  findPasswordResetInfo,
  savePasswordResetToken,
  updateUserPassword,
  findUserById,
  updateProfile,
  updateProfileImage,
  deleteUser,
};
