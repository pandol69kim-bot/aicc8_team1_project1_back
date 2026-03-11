import axios from 'axios';
import { pool } from '../../database/databaseConnect.js';
import { createNotification } from '../models/notificationsModel.js';
import { getUsersConfigForType, isInTimeWindow } from '../models/notificationTypeSettingsModel.js';
import { findUserById } from '../models/userModel.js';
import { getExcludedKeywords, pickCompatibleMenu } from '../utils/allergyFilter.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const SEOUL = { lat: 37.5665, lon: 126.978 };

/** weather_code: 61-67=rain, 80-82=showers */
const isRainy = (code) => code >= 61 && code <= 67 || code >= 80 && code <= 82;

/** 날씨별 메뉴 후보 (알레르기 시 대체 선택) */
function getMenuCandidatesByWeather(weatherCode, temp) {
  if (isRainy(weatherCode)) {
    return {
      intro: '비 오는 날이네요!',
      desc: '칼로리는 낮으면서 따뜻한',
      candidates: [
        { menu: '두부 전골' },
        { menu: '미역국' },
      ],
    };
  }
  if (temp < 5) {
    return {
      intro: '춥죠?',
      desc: '따뜻하게 속을 채워줄',
      candidates: [
        { menu: '된장국과 계란찜' },
        { menu: '미역국' },
      ],
    };
  }
  if (temp > 28) {
    return {
      intro: '날씨가 더워요!',
      desc: '시원하게 한 끼',
      candidates: [
        { menu: '냉모밀과 오이무침' },
        { menu: '물냉면' },
        { menu: '두부샐러드' },
      ],
    };
  }
  return {
    intro: '오늘 메뉴 고민되시죠?',
    desc: '담백하고 균형 잡힌',
    candidates: [
      { menu: '샐러드와 닭가슴살' },
      { menu: '두부샐러드' },
    ],
  };
}

/**
 * 날씨 조회 (서울 기준)
 */
async function fetchWeather() {
  const { data } = await axios.get(OPEN_METEO_URL, {
    params: {
      latitude: SEOUL.lat,
      longitude: SEOUL.lon,
      current: 'weather_code,temperature_2m',
      timezone: 'Asia/Seoul',
    },
    timeout: 5000,
  });
  const c = data.current;
  return { code: c.weather_code, temp: c.temperature_2m ?? 15 };
}

/**
 * 오늘 recommendation_menu 이미 발송했는지 (mealNudgeService 패턴 - type+title+DB 현재 날짜)
 */
async function alreadySent(userId) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'recommendation_menu' AND title = '메뉴 추천'
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
     LIMIT 1`,
    [userId]
  );
  return res.rows.length > 0;
}

/**
 * 메뉴 고민 해결 알림 배치 (날씨 연동)
 * - 사용자 설정 time1(점심 전), time2(저녁 전) ±30분 창에 실행
 */
export async function runRecommendationMenuJob() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let weather = { code: 0, temp: 15 };
  try {
    weather = await fetchWeather();
  } catch (err) {
    console.warn('날씨 API 조회 실패, 기본 메뉴 사용:', err.message);
  }

  const todayRes = await pool.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today`
  );
  const rec = getMenuCandidatesByWeather(weather.code, weather.temp);
  let sent = 0;

  try {
    const usersWithConfig = await getUsersConfigForType('recommendation_menu');

    for (const { userId, config } of usersWithConfig) {
      const inWindow = isInTimeWindow(config.time1, currentMinutes) || isInTimeWindow(config.time2, currentMinutes);
      if (!inWindow) continue;
      if (await alreadySent(userId)) continue;

      const user = await findUserById(userId);
      const excluded = getExcludedKeywords(user || {});
      const chosen = pickCompatibleMenu(rec.candidates, excluded);
      if (!chosen) continue;

      const message = `${rec.intro} ${rec.desc} '${chosen.menu}' 레시피를 확인해보세요.`;
      await createNotification({
        userId,
        type: 'recommendation_menu',
        title: '메뉴 추천',
        message,
      });
      sent++;
    }
    return { sent, weather: { code: weather.code, temp: weather.temp } };
  } catch (error) {
    console.error('runRecommendationMenuJob 에러:', error);
    throw error;
  }
}
