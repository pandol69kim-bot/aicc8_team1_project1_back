import axios from "axios";

const BASE_URL = process.env.MFDS_BASE_URL;
const KEY = process.env.MFDS_API_KEY;

export async function searchFoodByName(foodName, pageNo = 1, numOfRows = 20) {
    const url = `${BASE_URL}/getFoodNtrCpntDbInq02`;

    const params = {
        serviceKey: KEY,
        type: "json",
        pageNo,
        numOfRows,
        FOOD_NM_KR: foodName, // ✅ 식품명 검색 파라미터
    };

    const res = await axios.get(url, { params });
    return res.data;
}