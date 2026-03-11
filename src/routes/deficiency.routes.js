import express from "express";
import { checkDeficiency } from "../controllers/deficiencyController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Deficiency
 *   description: Nutritional deficiency analysis
 */

/**
 * @swagger
 * /api/deficiency/check:
 *   post:
 *     summary: Check for nutritional deficiencies on a specific date
 *     tags: [Deficiency]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check (YYYY-MM-DD)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deficiency analysis results
 *       400:
 *         description: Missing parameters
 *       500:
 *         description: Server error
 */
router.post("/check", checkDeficiency);

export default router;
