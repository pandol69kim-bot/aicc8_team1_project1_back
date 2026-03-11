import express from "express";
import { searchFoodByName } from "../services/mfdsService.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: MFDS
 *   description: Food search via MFDS API
 */

/**
 * @swagger
 * /api/mfds/search:
 *   get:
 *     summary: Search for food by name
 *     tags: [MFDS]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Food name to search for
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Missing query
 */
router.get("/search", async (req, res) => {
    try {
        const { query, page, size } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, message: "query가 필요해요" });
        }

        const data = await searchFoodByName(query, Number(page || 1), Number(size || 20));
        return res.json({ success: true, data });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "식약처 API 호출 실패" });
    }
});

export default router;