import express from 'express';
import userController from '../controllers/userController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and profile retrieval
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (placeholder)
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Successfully retrieved user list
 *       500:
 *         description: Server error
 */
router.get('/', userController.getUsers || ((req, res) => res.send("getUsers not implemented")));

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user (Signup alias)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nickname
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               nickname: { type: string }
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Invalid input
 */
router.post('/', userController.signup);

export default router;
