import OpenAI from 'openai';
import * as scanModel from '../models/scanModel.js';
import { refreshSummaryForMeal } from '../services/dailySummariesService.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROMPT = `이 이미지에 담긴 음식을 분석해서, 각 음식별로 영양정보와 이미지 내 위치를 JSON 배열로 반환해주세요.
반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.
[
  { "name": "음식명", "amount": 숫자, "bbox": { "x": 숫자, "y": 숫자, "w": 숫자, "h": 숫자 }, "calories": 숫자, "carbohydrate": 숫자, "protein": 숫자, "fat": 숫자, "sodium": 숫자, "sugars": 숫자 },
  ...
]
- name: 음식명 (한국어)
- amount: 분석 기준이 된 음식의 양 (g). 이미지에서 보이는 분량을 g 단위로 추정
- bbox: 이미지 내 해당 음식이 있는 영역. 이미지 전체를 100 기준으로 한 비율
  - x: 왼쪽 상단의 x 위치 (0~100)
  - y: 왼쪽 상단의 y 위치 (0~100)
  - w: 너비 (0~100)
  - h: 높이 (0~100)
- calories: 칼로리 (kcal)
- carbohydrate: 탄수화물 (g)
- protein: 단백질 (g)
- fat: 지방 (g)
- sodium: 나트륨 (mg)
- sugars: 당류 (g)
예상치를 합리적으로 추정해주세요. bbox는 각 음식/음료가 이미지에서 차지하는 대략적인 영역을 추정해주세요.`;

const REANALYZE_PROMPT = `사용자가 수정한 음식 목록과 그램수에 맞춰 각 음식의 영양정보를 재계산해주세요.
반드시 아래 형식의 JSON 배열만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.
[
  { "name": "음식명", "amount": 숫자, "calories": 숫자, "carbohydrate": 숫자, "protein": 숫자, "fat": 숫자, "sodium": 숫자, "sugars": 숫자 },
  ...
]
- name: 음식명 (입력과 동일하게)
- amount: 그램수 (입력과 동일하게)
- calories: 해당 그램수 기준 칼로리 (kcal)
- carbohydrate: 탄수화물 (g)
- protein: 단백질 (g)
- fat: 지방 (g)
- sodium: 나트륨 (mg)
- sugars: 당류 (g)
각 음식의 일반적인 영양밀도를 고려하여 주어진 그램수에 맞는 영양소를 추정해주세요.
입력된 음식 순서대로 JSON 배열을 반환해주세요.`;

/**
 * POST /api/scan/food/reanalyze - 수정된 음식량으로 AI 재분석
 * req.body: { foods: [{ name: string, amount: number }, ...] }
 */
export async function reanalyzeFood(req, res) {
  try {
    const { foods: inputFoods } = req.body || {};
    if (!Array.isArray(inputFoods) || inputFoods.length === 0) {
      return res.status(400).json({
        message: 'foods 배열을 보내주세요. 예: { "foods": [{ "name": "김치찌개", "amount": 300 }] }',
      });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: 'OPENAI_API_KEY가 설정되지 않았습니다. .env를 확인해주세요.',
      });
    }

    const foodListStr = inputFoods
      .map((f) => `- ${String(f.name || '').trim() || '음식'}: ${Number(f.amount) || 0}g`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `${REANALYZE_PROMPT}\n\n수정된 음식 목록:\n${foodListStr}`,
        },
      ],
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    let foods = [];
    try {
      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      foods = JSON.parse(jsonStr);
    } catch (e) {
      console.error('AI 재분석 응답 파싱 실패:', text);
      return res
        .status(500)
        .json({ message: 'AI 재분석 결과를 파싱할 수 없습니다.', raw: text });
    }

    if (!Array.isArray(foods)) foods = [];
    const totalCalories = foods.reduce(
      (sum, f) => sum + (Number(f.calories) || 0),
      0
    );

    res.json({
      success: true,
      foods,
      totalCalories: Math.round(totalCalories),
    });
  } catch (err) {
    console.error(err);
    const msg = err?.message || '서버 오류';
    if (msg.includes('API key')) {
      return res.status(401).json({ message: 'OpenAI API 키가 유효하지 않습니다.' });
    }
    res.status(500).json({ message: msg });
  }
}

/**
 * POST /api/scan/food - 식사 사진 업로드 → AI 영양 분석
 * req.file: multer로 수신한 이미지 (buffer)
 */
export async function analyzeFood(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일을 업로드해주세요.' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: 'OPENAI_API_KEY가 설정되지 않았습니다. .env를 확인해주세요.',
      });
    }

    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    let foods = [];
    try {
      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      foods = JSON.parse(jsonStr);
    } catch (e) {
      console.error('AI 응답 파싱 실패:', text);
      return res
        .status(500)
        .json({ message: 'AI 분석 결과를 파싱할 수 없습니다.', raw: text });
    }

    if (!Array.isArray(foods)) foods = [];
    const totalCalories = foods.reduce(
      (sum, f) => sum + (Number(f.calories) || 0),
      0
    );

    res.json({
      success: true,
      foods,
      totalCalories: Math.round(totalCalories),
    });
  } catch (err) {
    console.error(err);
    const msg = err?.message || '서버 오류';
    if (msg.includes('API key')) {
      return res.status(401).json({ message: 'OpenAI API 키가 유효하지 않습니다.' });
    }
    res.status(500).json({ message: msg });
  }
}

/**
 * POST /api/scan/save-ai - AI 분석 결과 저장 (ai_scans)
 * FormData: image(파일), user_id, scan_result(JSON 문자열)
 * 이미지는 uploads 폴더에 저장되고 DB에는 /uploads/파일명 경로만 저장
 */
export async function saveAi(req, res) {
  try {
    const { user_id, scan_result } = req.body;

    if (!user_id || !scan_result) {
      return res.status(400).json({ success: false, message: '필수 데이터(user_id, scan_result)가 누락되었습니다.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '이미지 파일(image)이 필요합니다.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const scanResultObj = typeof scan_result === 'string' ? JSON.parse(scan_result) : scan_result;
    const saved = await scanModel.saveAiScanData(user_id, imageUrl, scanResultObj);

    res.json({
      success: true,
      message: '저장되었습니다.',
      data: {
        scan_result: saved.scan_result,
        ai_scan_id: saved.id // 3.4 저장 시 연동을 위해 id값을 넘겨줌
      }
    });
  } catch (error) {
    console.error('saveAi 에러:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

/**
 * POST /api/scan/save-diary - 식단 기록 저장 (diary_entries)
 */
export async function saveDiary(req, res) {
  try {
    const { user_id, ai_scan_id, meal_type, mealTime, foods, image_url } = req.body;

    if (!user_id || !meal_type || !foods || !Array.isArray(foods)) {
      return res.status(400).json({ success: false, message: '필수 데이터(user_id, meal_type, foods)가 누락되었습니다.' });
    }

    let finalImageUrl = image_url;

    // 만약 프론트에서 image_url을 보내지 않고 ai_scan_id만 넘겼다면 DB에서 조회해서 사용
    if (ai_scan_id && !finalImageUrl) {
      const scanData = await scanModel.getAiScanById(ai_scan_id);
      if (scanData) {
        finalImageUrl = scanData.image_url;
      }
    }

    // 프론트 형식(name, calories, carbohydrate...) → 모델 형식(snap_food_name, snap_calories...) 변환
    const mappedFoods = foods.map((f) => ({
      snap_food_name: f.snap_food_name ?? f.name,
      snap_calories: f.snap_calories ?? f.calories ?? 0,
      snap_carbohydrate: f.snap_carbohydrate ?? f.carbohydrate ?? 0,
      snap_protein: f.snap_protein ?? f.protein ?? 0,
      snap_fat: f.snap_fat ?? f.fat ?? 0,
      snap_sugars: f.snap_sugars ?? f.sugars ?? 0,
      serving_size: f.serving_size ?? f.amount ?? 0,
    }));

    const savedEntries = await scanModel.saveDiaryEntries({
      user_id,
      ai_scan_id,
      meal_type,
      mealTime,
      foods: mappedFoods,
      image_url: finalImageUrl
    });

    refreshSummaryForMeal(user_id, mealTime || (savedEntries[0]?.meal_time)).catch((err) =>
      console.error('daily_summaries 갱신 실패:', err.message)
    );

    res.json({
      success: true,
      message: '저장되었습니다.',
      data: {
        mealTime: savedEntries.length > 0 ? savedEntries[0].meal_time : mealTime
      }
    });

  } catch (error) {
    console.error('saveDiary 에러:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
