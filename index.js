import dotenv from 'dotenv';
dotenv.config();
//test test ccc

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import mealsRoutes from './src/routes/meals_routes.js';
import authRoutes from './src/routes/auth.routes.js';
import mfdsRoutes from './src/routes/mfds.routes.js';
import diaryRoutes from './src/routes/diary.routes.js';
import userRoutes from './src/routes/userRoutes.js';
import deficiencyRoutes from './src/routes/deficiency.routes.js';
import googleSheetsRoutes from './src/routes/google_sheets_routes.js';
import foodsRoutes from './src/routes/foods_routes.js';
import scanRoutes from './src/routes/scan.routes.js';
import notificationsRouter, {
  settingsRouter,
} from './src/routes/notifications.routes.js';
import { startNotificationCron } from './src/cron/notificationCron.js';
import recommendRoutes from './src/routes/recommend.routes.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './database/swagger.js';

// test - .env change  3333
const app = express();

// Set uploads directory as static route
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
  cors({
    origin: '//aicc8team1.vercel.app',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.send('This is the Main App for Deployment -- test02');
});

app.use('/api/meals', mealsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/mfds', mfdsRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/users', userRoutes); // /api/users 경로
app.use('/api/users', settingsRouter); // /api/users/me/notification-settings 매핑
app.use('/api/deficiency', deficiencyRoutes);
app.use('/api/google-sheets', googleSheetsRoutes);
app.use('/api/foods', foodsRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/notifications', notificationsRouter);
app.use('/api/recommend', recommendRoutes);

// app.get("/api/db/ping", async (req, res) => {
//   try {
//     const r = await pool.query("SELECT NOW() as now");
//     res.json({ success: true, data: r.rows[0] });
//   } catch (e) {
//     res.status(500).json({ success: false, error: String(e?.message || e) });
//   }
// });

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startNotificationCron();
});
