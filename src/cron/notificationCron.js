import cron from 'node-cron';
import { runMealNudgeJob } from '../services/mealNudgeService.js';
import { runStreakNudgeJob } from '../services/streakNudgeService.js';
import { runInsightSugarFatJob } from '../services/insightSugarFatService.js';
import { runInsightProteinJob } from '../services/insightProteinService.js';
import { runRecommendationTomorrowJob } from '../services/recommendationTomorrowService.js';
import { runRecommendationMenuJob } from '../services/recommendationMenuService.js';
import { runWeeklyReportJob } from '../services/weeklyReportService.js';
import { runGoalAchievementJob } from '../services/goalAchievementService.js';
import { runDailySummariesJob } from '../services/dailySummariesService.js';

const TZ = 'Asia/Seoul';

function run(name, fn) {
  return async () => {
    try {
      const r = await fn();
      if (r.sent > 0) {
        console.log(`[cron] ${name}:`, r);
      }
    } catch (e) {
      console.error(`[cron] ${name} 에러:`, e.message);
    }
  };
}

async function runAllNotificationJobs() {
  await run('daily-summaries', runDailySummariesJob)();
  await run('meal-nudge', runMealNudgeJob)();
  await run('streak-nudge', runStreakNudgeJob)();
  await run('insight-sugar-fat', runInsightSugarFatJob)();
  await run('insight-protein', runInsightProteinJob)();
  await run('recommendation-tomorrow', runRecommendationTomorrowJob)();
  await run('recommendation-menu', runRecommendationMenuJob)();
  await run('weekly-report', runWeeklyReportJob)();
  await run('goal-achievement', runGoalAchievementJob)();
}

export function startNotificationCron() {
  // 1분마다 전체 알림 작업 실행 (각 작업 내부에서 정해진 시각 체크)
  cron.schedule('* * * * *', runAllNotificationJobs, { timezone: TZ });
  console.log('[cron] 알림 스케줄러 시작 (1분마다, KST)');
}
