// Derives Performance Analytics (PRD §28) from attempt history — no separate
// aggregate collection needed since attempt counts are low per user.
import { fetchAttemptHistory, type AttemptResult } from './exams';

export interface AnalyticsSummary {
  attempts: AttemptResult[];
  averageScorePercent: number;
  totalTimeSpentSeconds: number;
  scoreTrend: { label: string; percent: number }[];
}

export async function fetchAnalytics(uid: string): Promise<AnalyticsSummary> {
  const attempts = await fetchAttemptHistory(uid, 20);
  const ordered = [...attempts].reverse();

  const totalTimeSpentSeconds = attempts.reduce((sum, a) => sum + a.timeTakenSeconds, 0);
  const percents = attempts.map((a) => (a.totalMarks > 0 ? a.score / a.totalMarks : 0));
  const averageScorePercent = percents.length > 0 ? percents.reduce((s, p) => s + p, 0) / percents.length : 0;

  const scoreTrend = ordered.map((a, i) => ({
    label: `#${i + 1}`,
    percent: a.totalMarks > 0 ? a.score / a.totalMarks : 0,
  }));

  return { attempts, averageScorePercent, totalTimeSpentSeconds, scoreTrend };
}
