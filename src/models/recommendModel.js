import { pool } from '../../database/databaseConnect.js';

/**
 * DB에서 지정된 개수만큼 랜덤하게 음식을 가져옵니다.
 * @param {number} limit 조회할 음식 수 (기본값: 5)
 */
export const getRandomFoods = async (limit = 5) => {
  const query = `
    SELECT 
        food_code AS id, 
        food_name AS name, 
        -- image_url이 foods 테이블에 없으면 null을 반환합니다. 
        -- 만약 있다면 column 이름을 맞추어 수정하세요.
        null AS image ,
        calories AS kcal,
        carbohydrate AS carbs,
        protein,
        fat,
        sugars AS sugar,
        null AS status
        
        
    FROM foods 
    ORDER BY RANDOM() 
    LIMIT $1
  `;
  try {
    const { rows } = await pool.query(query, [limit]);
    return rows;
  } catch (error) {
    console.error('getRandomFoods 에러:', error);
    throw error;
  }
};

/**
 * 키워드로 유사 음식을 검색하되, 이름이 특정 접두어로 시작하는 음식은 제외합니다.
 * (이름이 겹치는 추천 대신 DB에서 관련된 다른 음식을 찾을 때 사용)
 * @param {string} keyword 검색 키워드 (예: '닭' -> 닭이 들어간 음식)
 * @param {string} excludePrefix 제외할 이름 접두어 (앞 4글자 등, 예: '닭가슴')
 * @param {number} limit 조회할 음식 수 (기본값: 5)
 */
export const searchRelatedFoods = async (
  keyword,
  excludePrefix = '',
  limit = 5,
) => {
  if (!keyword || !keyword.trim()) return [];

  const safeKeyword = keyword.trim().slice(0, 10);
  const hasExclude = excludePrefix && excludePrefix.trim().length > 0;
  const safeExclude = hasExclude ? excludePrefix.trim() : '';

  const query = hasExclude
    ? `
    SELECT 
      food_code AS id, 
      food_name AS name, 
      null AS image,
      calories AS kcal,
      carbohydrate AS carbs,
      protein,
      fat,
      sugars AS sugar,
      null AS status
    FROM foods
    WHERE food_name ILIKE $1
      AND (length($2::text) = 0 OR food_name NOT LIKE $2 || '%')
    ORDER BY RANDOM()
    LIMIT $3
  `
    : `
    SELECT 
      food_code AS id, 
      food_name AS name, 
      null AS image,
      calories AS kcal,
      carbohydrate AS carbs,
      protein,
      fat,
      sugars AS sugar,
      null AS status
    FROM foods
    WHERE food_name ILIKE $1
    ORDER BY RANDOM()
    LIMIT $2
  `;

  const values = hasExclude
    ? [`%${safeKeyword}%`, safeExclude, limit]
    : [`%${safeKeyword}%`, limit];

  try {
    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    console.error('searchRelatedFoods 에러:', error);
    throw error;
  }
};

/**
 * 키워드(문자열 배열) 리스트를 받아 foods 테이블에서 일치하거나 유사한 음식을 검색합니다.
 * @param {string[]} keywords 검색할 음식 키워드 배열 (예: ['닭가슴살', '고구마'])
 */
export const searchFoodsByKeywords = async (keywords) => {
  if (!keywords || keywords.length === 0) return [];

  // 각 키워드별로 ILIKE 조건을 만들어 OR로 연결
  const conditions = keywords.map((_, i) => `food_name ILIKE $${i + 1}`);
  const query = `
    SELECT 
      food_code AS id, 
      food_name AS name, 
      null AS image,
      calories AS kcal,
      carbohydrate AS carbs,
      protein,
      fat,
      sugars AS sugar,
      null AS status
    FROM foods
    WHERE ${conditions.join(' OR ')}
    LIMIT 10
  `;

  const values = keywords.map((kw) => `%${kw}%`);

  try {
    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    console.error('searchFoodsByKeywords 에러:', error);
    throw error;
  }
};

/**
 * AI 추천 내역을 DB에 저장합니다.
 * @param {string} id 추천 데이터의 UUID
 * @param {string} userId 사용자 UUID
 * @param {Array} foods 추천된 음식 목록 JSON 데이터
 */
export const saveRecommendationResult = async (
  id,
  userId,
  foods,
  reason = '',
) => {
  const query = `
    INSERT INTO recommendations (id, user_id, context_type, recommendation_data, reason)
    VALUES ($1, $2, 'AI_CHAT', $3, $4)
    RETURNING id
  `;
  const dataJson = JSON.stringify({ foods });

  try {
    const { rows } = await pool.query(query, [id, userId, dataJson, reason]);
    return rows[0];
  } catch (error) {
    console.error('saveRecommendationResult 에러:', error);
    throw error;
  }
};
