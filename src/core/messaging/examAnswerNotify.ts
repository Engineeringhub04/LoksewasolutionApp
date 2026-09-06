// Notifies the admin (via Discord) whenever a student submits a Theory answer.
//
// Posts to a small Apps Script web app deployed separately (see
// docs/apps-script-exam-answers.gs alongside this change) rather than a Discord
// webhook called directly from the app: a webhook URL shipped in the bundle can
// be extracted and abused to spam the channel, same reasoning as
// core/messaging/googleForm.ts. The Apps Script URL is public by design and
// holds no secret — it only relays a fixed shape onward to Discord.
//
// Fire-and-forget: a failed notification must never block or fail the actual
// submission, so every call site should treat this as best-effort (`.catch(() => {})`).
import { AppConfig } from '@/src/core/config/appConfig';

export interface ExamAnswerNotifyPayload {
  studentName: string;
  courseName: string;
  subcourseName: string;
  examSetTitle: string;
  message: string;
  pdfUrl: string;
}

export async function notifyExamAnswerSubmitted(payload: ExamAnswerNotifyPayload): Promise<void> {
  const { appsScriptUrl } = AppConfig.messaging.examAnswerWebhook;
  if (!appsScriptUrl || appsScriptUrl.startsWith('REPLACE_WITH')) return;

  const res = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'exam_answer_submitted', ...payload }),
  });

  if (!res.ok) {
    throw new Error(`EXAM_ANSWER_NOTIFY_FAILED_${res.status}`);
  }
}
