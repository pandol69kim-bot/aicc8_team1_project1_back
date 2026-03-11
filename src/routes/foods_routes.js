import express from 'express';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { pool } from '../../database/databaseConnect.js';

const router = express.Router();

router.post('/sheet/import', async (req, res) => {
    try {
        let {
            csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRdxK328L_8O9rzCzhV5tA5C8WduDrFQyngy2qR1eTQDYXd0GOvrmHZ5b0KfPMxFbNRH7RuZLuQ-iZd/pub?gid=1763039306&single=true&output=csv",
            mode = 'upsert',
            uniqueKey = 'food_code',
            mapping
        } = req.body || {};

        // 기본 매핑 설정
        if (!mapping) {
            mapping = {
                "식품코드": "food_code",
                "식품명": "food_name",
                "식품대분류명": "category",
                "칼로리(kcal)": "calories",
                "탄수화물(g)": "carbohydrate",
                "단백질(g)": "protein",
                "지방(g)": "fat",
                "당류(g)": "sugars",
                "식품중량": "serving_size"
            };
        }

        if (!csvUrl) {
            return res.status(400).json({ success: false, message: 'csvUrl is required' });
        }

        // 1. 구글 시트 CSV 데이터 가져오기
        const response = await axios.get(csvUrl);
        const csvData = response.data;

        // 2. CSV 전처리 및 파싱
        const lines = csvData.split('\n');
        const headerIndex = lines.findIndex(line => line.includes('식품코드'));

        if (headerIndex === -1) {
            return res.status(400).json({ success: false, message: 'CSV에 "식품코드" 헤더가 없습니다. 구글 시트를 확인해주세요.' });
        }

        const validCsvData = lines.slice(headerIndex).join('\n');
        const jsonData = parse(validCsvData, {
            columns: true,
            skip_empty_lines: true
        });

        if (jsonData.length === 0) {
            return res.status(400).json({ success: false, message: 'CSV 데이터가 비어 있거나 읽을 수 없습니다.' });
        }

        // 3. 매핑 설정 및 DB 저장
        const csvKeys = Object.keys(mapping);
        const dbColumns = Object.values(mapping);

        if (mode === 'upsert' && (!uniqueKey || !dbColumns.includes(uniqueKey))) {
            return res.status(400).json({ success: false, message: 'upsert 모드일 때는 매핑 값에 포함된 구역인 uniqueKey를 명시해야 합니다.' });
        }

        let successCount = 0;
        let failCount = 0;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const batchSize = 1000;

            for (let i = 0; i < jsonData.length; i += batchSize) {
                const batch = jsonData.slice(i, i + batchSize);
                const values = [];
                const placeholders = [];
                let paramIndex = 1;

                // 1. Bulk Query 값 및 파라미터 매핑 구성
                for (const row of batch) {
                    const rowValues = csvKeys.map(csvKey => {
                        let val = row[csvKey];
                        if (val === '' || val === undefined || val === null) return null;

                        // DB 컬럼이 numeric을 기대하는 경우 (serving_size 등) 숫자 외의 문자 제거
                        const dbCol = mapping[csvKey];
                        if (['calories', 'protein', 'fat', 'sugars', 'serving_size', 'carbohydrate', 'sodium'].includes(dbCol)) {
                            // "100g", "600ml" 같은 문자열에서 숫자 부분만 추출 (정규식 사용)
                            const numMode = String(val).replace(/[^0-9.]/g, '');
                            if (numMode === '') return null;
                            return parseFloat(numMode);
                        }

                        return val;
                    });
                    values.push(...rowValues);

                    const rowPlaceholders = dbColumns.map(() => `$${paramIndex++}`);
                    placeholders.push(`(${rowPlaceholders.join(', ')})`);
                }

                const columnsStr = dbColumns.map(col => `"${col}"`).join(', ');

                try {
                    if (mode === 'upsert') {
                        // DO UPDATE SET 쿼리 생성
                        const excluded = dbColumns.map(col => `"${col}" = EXCLUDED."${col}"`).join(', ');

                        const query = `
                            INSERT INTO foods (${columnsStr})
                            VALUES ${placeholders.join(', ')}
                            ON CONFLICT ("${uniqueKey}") DO UPDATE SET ${excluded}
                        `;
                        await client.query(query, values);
                    } else {
                        const query = `
                            INSERT INTO foods (${columnsStr})
                            VALUES ${placeholders.join(', ')}
                        `;
                        await client.query(query, values);
                    }
                    successCount += batch.length;
                } catch (e) {
                    console.error("Bulk 처리 실패 - 배치 시작 인덱스:", i, "에러:", e.message);
                    failCount += batch.length;
                }
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({
            success: true,
            message: `데이터 임포트 완료 (성공: ${successCount}건, 실패: ${failCount}건)`,
            successCount,
            failCount
        });

    } catch (error) {
        console.error("데이터 임포트 중 오류 발생:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 테스트용: 식품명으로 데이터 검색 (예: GET /api/foods/search?name=식혜)
router.get('/search', async (req, res) => {
    try {
        const { name } = req.query;

        if (!name) {
            return res.status(400).json({ success: false, message: "검색할 식품명을 쿼리로(query) 전달해주세요. (예: ?name=식혜)" });
        }

        // ✅ 방어 코드 추가: 앞뒤 공백 제거 및 혹시 모를 따옴표(" '), 유령 문자(Zero-width space) 제거
        const cleanName = name.trim().replace(/['"\u200B-\u200D\uFEFF]/g, '').normalize('NFC');


        // food_name에 검색어가 포함된 데이터 최대 10개 조회
        const query = "SELECT * FROM foods WHERE food_name LIKE $1 LIMIT 10";
        const result = await pool.query(query, [`%${cleanName}%`]);

        res.json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });
    } catch (error) {
        console.error("데이터 검색 중 오류 발생:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
