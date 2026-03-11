import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import {
  getRandomFoods,
  searchFoodsByKeywords,
  searchRelatedFoods,
  saveRecommendationResult,
} from '../models/recommendModel.js';
import { findUserById } from '../models/userModel.js';
import {
  getExcludedKeywords,
  filterFoodsByUser,
} from '../utils/allergyFilter.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * [GET] /api/recommend/random
 * 초기 랜덤 식단 조회 데이터 (5개) 반환
 */
export const getRandomFoodList = async (req, res) => {
  try {
    const foods = await getRandomFoods(5);

    return res.status(200).json({
      success: true,
      message: '랜덤 식단 조회 완료.',
      foods: foods.map((f) => ({
        id: f.id,
        name: f.name,
        image: f.image,
        kcal: f.kcal,
        carbs: f.carbs,
        protein: f.protein,
        fat: f.fat,
        sugar: f.sugar,
        status: f.status,
      })),
    });
  } catch (error) {
    console.error('getRandomFoodList 에러:', error);
    return res
      .status(500)
      .json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
  }
};

/**
 * [GET] /api/recommend/related
 * 키워드로 관련 음식 검색 (특정 접두어로 시작하는 이름 제외)
 * 쿼리: keyword, exclude, limit(선택)
 */
export const getRelatedFoodList = async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const exclude = req.query.exclude || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

    const foods = await searchRelatedFoods(keyword, exclude, limit);

    return res.status(200).json({
      success: true,
      foods: foods.map((f) => ({
        id: f.id,
        name: f.name,
        image: f.image,
        kcal: f.kcal,
        carbs: f.carbs,
        protein: f.protein,
        fat: f.fat,
        sugar: f.sugar,
        status: f.status,
      })),
    });
  } catch (error) {
    console.error('getRelatedFoodList 에러:', error);
    return res
      .status(500)
      .json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
  }
};

/**
 * [POST] /api/recommend/save
 * AI 식단 추천 및 저장 (전문 영양사 대화형 응답 + [DATA] 태그로 메뉴 추출)
 */
export const recommendFoodsByAI = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: '인증 정보가 없습니다.' });
    }

    const { messages, inputMessage } = req.body;
    const finalInput =
      (inputMessage && inputMessage.trim()) || '추천 메뉴를 알려주세요.';

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ success: false, message: '올바르지 않은 대화 요청입니다.' });
    }

    // 1. 사용자 프로필 및 알레르기/식이제한 컨텍스트
    const user = await findUserById(userId);
    let userContext = '목표: 건강 유지';
    if (user) {
      userContext = `사용자 목표: ${user.goals}, 식이 제한: ${user.dietary_restrictions}, 알레르기: ${user.allergies || '없음'}, 키: ${user.height}cm, 체중: ${user.weight}kg.`;
    }

    const filterTags = [
      '#고단백',
      '#다이어트',
      '#비건',
      '#저탄수',
      '#0kcal',
      '#저당',
      '#과일',
      '#저지방',
      '#고지방',
      '#고칼로리',
      '#고당',
    ];

    // 2. 전문 영양사 프롬프트 (대화형 응답 + [DATA] JSON 포함)
    const promptMessages = [
      {
        role: 'system',
        content: `당신은 전문 영양사입니다. 사용자의 요청에 맞춰 한국의 실제 식단을 추천하세요.
[응답 규칙]
1. 모든 대화는 한국어로 진행하며 친절하게 설명하세요.
2. 추천하는 구체적인 메뉴 데이터는 반드시 답변 마지막에 [DATA]와 [/DATA] 태그로 감싸서 JSON 배열 형식으로 포함하세요.
3. JSON 구조: [{"name": "음식명", "description": "설명", "tags": ["태그1", "태그2"]}]
4. tags는 반드시 다음 목록에서만 선택하세요: ${filterTags.join(', ')}.
5. 한 번에 3~5개의 메뉴를 추천하고 실제 음식 DB에서 검색 가능한 메뉴명을 사용하세요.
6. 추천된 메뉴는 중복되지 않도록 하세요.
7. 없는 식단을 만들어내지 마세요.
8. 텍스트 답변에서는 특수문자 *, &, ^, %, $, #, @, ;를 출력하지 마세요.
9. 답변 양식: 간단한 설명 후 번호. 메뉴이름: 추천이유 순서로 작성하고 마지막에 카드 확인 권유 문구를 넣으세요.
[사용자정보] ${userContext}`,
      },
      ...messages
        .filter(
          (m) =>
            m.content &&
            typeof m.content === 'string' &&
            m.content.trim() !== '',
        )
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: finalInput },
    ];

    let aiResponseContent = '';

    if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: promptMessages,
        temperature: 0.7,
      });
      aiResponseContent = completion.choices[0].message.content;
    } else {
      console.warn('OPENAI_API_KEY is not set. Using fallback response.');
      aiResponseContent =
        '식단을 추천합니다. [DATA][{"name": "닭가슴살", "description": "고단백", "tags": ["고단백"]}][/DATA]';
    }

    // 3. [DATA] 태그에서 음식명 추출
    const dataRegex = /\[DATA\]([\s\S]*?)\[\/DATA\]/;
    const match = aiResponseContent.match(dataRegex);
    let searchKeywords = [];
    const cleanTextMessage = aiResponseContent.replace(dataRegex, '').trim();

    if (match && match[1]) {
      try {
        const parsedData = JSON.parse(match[1]);
        searchKeywords = parsedData.map((item) => item.name).filter(Boolean);
      } catch (e) {
        console.error('AI [DATA] JSON 파싱 에러:', e);
      }
    }

    // 4. DB에서 음식 검색
    let recommendedFoods = await searchFoodsByKeywords(searchKeywords);
    if (!recommendedFoods || recommendedFoods.length === 0) {
      recommendedFoods = await getRandomFoods(3);
    }

    // 5. 알레르기·식이제한에 맞지 않는 음식 제외
    const excluded = getExcludedKeywords(user || {});
    recommendedFoods = filterFoodsByUser(recommendedFoods, excluded);
    recommendedFoods = recommendedFoods.slice(0, 3);

    const responseFoodsList = recommendedFoods.map((f) => ({
      id: f.id,
      name: f.name,
      image: f.image,
      kcal: f.kcal,
      carbs: f.carbs,
      protein: f.protein,
      fat: f.fat,
      sugar: f.sugar,
      status: f.status,
    }));

    // 6. 추천 기록 DB 저장
    const recId = uuidv4();
    await saveRecommendationResult(
      recId,
      userId,
      responseFoodsList,
      cleanTextMessage,
    );

    // 7. 결과 반환 (프론트 chatContent/reply 기대)
    return res.status(200).json({
      success: true,
      chatContent: cleanTextMessage,
      foods: responseFoodsList,
    });
  } catch (error) {
    console.error('recommendFoodsByAI 에러:', error);
    return res
      .status(500)
      .json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
  }
};
