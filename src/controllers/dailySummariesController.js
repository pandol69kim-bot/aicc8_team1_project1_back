import { getSummary, getSummariesInRange } from '../models/dailySummariesModel.js';
import { summarizeDay } from '../services/dailySummariesService.js';

function formatSummary(row) {
  if (!row) return null;
  return {
    date: row.summary_date,
    calories: Number(row.total_calories) || 0,
    carbohydrate: Number(row.total_carbohydrate) || 0,
    protein: Number(row.total_protein) || 0,
    fat: Number(row.total_fat) || 0,
    sugars: Number(row.total_sugars) || 0,
    score: row.score ?? null,
    goalAchieved: row.goal_achieved ?? false,
  };
}

/**
 * GET /api/users/me/daily-summary?date=YYYY-MM-DD
 * 단일 날짜 일별 집계 조회 (없으면 생성 후 반환)
 */
export async function getDailySummary(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    let row = await getSummary(userId, dateStr);
    if (!row) {
      const summary = await summarizeDay(userId, dateStr);
      row = summary;
    }

    return res.json({
      success: true,
      data: formatSummary(row),
    });
  } catch (err) {
    console.error('getDailySummary 에러:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/users/me/daily-summaries?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 날짜 범위 일별 집계 조회 (주간리포트 7일용)
 */
export async function getDailySummaries(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const startDate = req.query.startDate || req.query.start;
    const endDate = req.query.endDate || req.query.end;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate와 endDate가 필요합니다.',
      });
    }

    const rows = await getSummariesInRange(userId, startDate, endDate);
    const data = rows.map(formatSummary);

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('getDailySummaries 에러:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
