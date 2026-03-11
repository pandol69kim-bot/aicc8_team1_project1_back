/**
 * 알레르기·식이제한 기반 메뉴/음식 필터링
 * Task 7: recommendation_tomorrow, recommendation_menu, 식단추천 API 반영
 */

/** 메뉴별 부적합 키워드 (사용자 allergy/restriction에 포함되면 해당 메뉴 제외) */
const MENU_INCOMPATIBLE = {
  '사과와 요거트': ['우유', '유제품', '요거트', '락토스'],
  '계란과 두유': ['계란', '두유', '대두', '달걀'],
  '아보카도와 견과류': ['견과류', '땅콩', '아몬드', '호두', '잣'],
  '귤과 고구마': ['감귤', '귤', '고구마'],
  '바나나와 오트밀': ['글루텐', '밀', '오트'],
  '두부와 해초': ['대두', '두부'],
  '두부 전골': ['대두', '두부'],
  '된장국과 계란찜': ['계란', '달걀', '대두'],
  '냉모밀과 오이무침': ['밀', '글루텐'],
  '샐러드와 닭가슴살': ['닭', '육류', '고기', '닭고기'],
  '미역국': [],
  '된장국': ['대두'],
  '물냉면': ['밀', '글루텐'],
  '두부샐러드': ['대두', '두부'],
  '올리브오일 샐러드': [],
};

/**
 * 사용자 allergies + dietary_restrictions → 제외해야 할 키워드 배열
 * @param {Object} user - { allergies?: string[], dietary_restrictions?: string[]|object }
 */
export function getExcludedKeywords(user) {
  const keywords = new Set();
  if (!user) return keywords;

  const allergies = Array.isArray(user.allergies)
    ? user.allergies
    : user.allergies
      ? [String(user.allergies)]
      : [];
  allergies.forEach((a) => keywords.add(String(a).trim().toLowerCase()));

  let restrictions = user.dietary_restrictions;
  if (typeof restrictions === 'string') {
    try {
      restrictions = JSON.parse(restrictions);
    } catch {
      restrictions = restrictions ? [restrictions] : [];
    }
  }
  if (Array.isArray(restrictions)) {
    restrictions.forEach((r) => keywords.add(String(r).trim().toLowerCase()));
  }

  return keywords;
}

/**
 * 메뉴 문자열이 사용자 제한에 걸리는지
 * @param {string} menuName
 * @param {Set<string>} excludedKeywords
 */
export function isMenuExcluded(menuName, excludedKeywords) {
  if (!menuName || !excludedKeywords || excludedKeywords.size === 0) return false;
  const lower = String(menuName).toLowerCase();

  for (const kw of excludedKeywords) {
    if (kw && lower.includes(kw)) return true;
  }

  const incompatible = MENU_INCOMPATIBLE[menuName];
  if (incompatible) {
    for (const kw of incompatible) {
      if (excludedKeywords.has(kw.toLowerCase())) return true;
    }
  }

  return false;
}

/**
 * 후보 메뉴 목록에서 사용자에게 적합한 첫 번째 선택
 * @param {Array<{menu: string, label?: string, emoji?: string}>} candidates
 * @param {Set<string>} excludedKeywords
 */
export function pickCompatibleMenu(candidates, excludedKeywords) {
  for (const c of candidates) {
    const menu = c.menu || c;
    if (!isMenuExcluded(typeof menu === 'string' ? menu : menu.menu, excludedKeywords)) {
      return c;
    }
  }
  return null;
}

/**
 * 음식 목록에서 알레르기/제한에 걸리는 항목 제외
 * @param {Array<{name: string}>} foods
 * @param {Set<string>} excludedKeywords
 */
export function filterFoodsByUser(foods, excludedKeywords) {
  if (!foods || !Array.isArray(foods) || excludedKeywords.size === 0) return foods;
  return foods.filter((f) => !isMenuExcluded(f.name || f.food_name || '', excludedKeywords));
}
