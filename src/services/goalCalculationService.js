/**
 * Task 1: 사용자별 목표 영양소 자동 계산
 * users(height, weight, gender, age_group) 기반 1일 권장 칼로리·영양소 산출
 * Mifflin-St Jeor BMR 공식 + 활동계수 1.4(TDEE) 적용
 */

/** age_group 문자열 → 나이 숫자 (BMR 계산용) */
const AGE_GROUP_MAP = {
  '10대': 15,
  '20대': 25,
  '30대': 35,
  '40대': 45,
  '50대 이상': 55,
};

const ACTIVITY_FACTOR = 1.4; // 보통 활동량
// 영양소 비율 (일일 칼로리 기준): 탄수화물 50%, 단백질 20%, 지방 30%, 당류 10% 미만
const CARB_RATIO = 0.5;
const PROTEIN_RATIO = 0.2;
const FAT_RATIO = 0.3;
const SUGAR_RATIO = 0.1;
const KCAL_PER_CARB = 4;
const KCAL_PER_PROTEIN = 4;
const KCAL_PER_FAT = 9;

/**
 * age_group 또는 age에서 나이 숫자 반환
 * @param {Object} user - { age_group?: string, age?: number }
 * @returns {number}
 */
function resolveAge(user) {
  if (user?.age != null && typeof user.age === 'number') return user.age;
  const ageGroup = user?.age_group || user?.ageGroup;
  return AGE_GROUP_MAP[ageGroup] ?? 30;
}

/**
 * Mifflin-St Jeor 공식으로 BMR(기초대사량) 계산
 * BMR = 10*weight(kg) + 6.25*height(cm) - 5*age + s (s: male +5, female -161)
 * @param {Object} user - { height, weight, gender, age?|age_group? }
 * @returns {number}
 */
function calculateBMR(user) {
  const weight = Number(user.weight) || 70;
  const height = Number(user.height) || 170;
  const age = resolveAge(user);
  const isMale = (user.gender || '').toString().toLowerCase() === 'female' ? false : true;

  if (isMale) {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

/**
 * 1일 권장 칼로리(TDEE) 및 영양소 목표 계산
 * @param {Object} user - { height, weight, gender, age_group?, age? }
 * @returns {{
 *   target_calories: number,
 *   target_carbohydrate: number,
 *   target_protein: number,
 *   target_fat: number,
 *   target_sugars: number
 * }}
 */
export function calculateDailyNutritionGoals(user) {
  if (!user || (user.height == null && user.weight == null)) {
    return getDefaultGoals();
  }

  const bmr = calculateBMR(user);
  const dailyCalories = bmr * ACTIVITY_FACTOR;

  return {
    target_calories: Math.round(dailyCalories),
    target_carbohydrate: Math.round((dailyCalories * CARB_RATIO) / KCAL_PER_CARB),
    target_protein: Math.round((dailyCalories * PROTEIN_RATIO) / KCAL_PER_PROTEIN),
    target_fat: Math.round((dailyCalories * FAT_RATIO) / KCAL_PER_FAT),
    target_sugars: Math.round((dailyCalories * SUGAR_RATIO) / KCAL_PER_CARB),
  };
}

/**
 * 입력값 부족 시 사용할 기본 목표
 */
function getDefaultGoals() {
  return {
    target_calories: 2000,
    target_carbohydrate: 250,
    target_protein: 100,
    target_fat: 65,
    target_sugars: 50,
  };
}
