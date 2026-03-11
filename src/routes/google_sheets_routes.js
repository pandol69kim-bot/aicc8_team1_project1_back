import express from 'express';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

const router = express.Router();

// GET /api/google-sheets
// 구글 시트 CSV URL을 query parameter(?url=...)로 받아 파싱합니다.
// URL 쿼리를 넘기지 않으면 아래의 기본 URL이 사용됩니다.
router.get('/', async (req, res) => {
  try {
    const defaultUrl =
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRdxK328L_8O9rzCzhV5tA5C8WduDrFQyngy2qR1eTQDYXd0GOvrmHZ5b0KfPMxFbNRH7RuZLuQ-iZd/pub?gid=1763039306&single=true&output=csv'; // 임시 값이지만 추후 전체 URL로 교체하세요.
    const csvUrl = req.query.url || defaultUrl;

    // 1. 구글 시트 CSV 데이터 가져오기
    const response = await axios.get(csvUrl);
    const csvData = response.data;

    // 2. CSV를 JSON 객체 배열로 변환
    const jsonData = parse(csvData, {
      columns: true, // 첫 줄을 키(Key)로 사용
      skip_empty_lines: true,
    });

    // 3. 포스트맨(클라이언트)에 JSON 형태로 응답
    res.json({
      success: true,
      data: jsonData,
    });
  } catch (error) {
    console.error('CSV 데이터를 가져오거나 파싱하는 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      message:
        '데이터 변환에 실패했습니다. 올바른 구글 시트 CSV URL인지 확인해주세요.',
    });
  }
});

export default router;
