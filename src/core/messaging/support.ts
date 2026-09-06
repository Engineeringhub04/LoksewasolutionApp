// Support submissions: Contact Us, Feedback, Report a Problem, Report a Question.
//
// These used to write to Firestore (contactMessages / reports). They now go to a
// Google Form instead — see AppConfig.messaging.googleForm for why. Contact,
// feedback and app-problem traffic therefore does not consume Firestore quota.
// Question reports additionally create a private Firestore history copy for the
// in-app report history page.
//
// The exported signatures are unchanged from the previous Firestore-backed
// service so every existing screen keeps working.
import { submitToGoogleForm } from './googleForm';
import { createReportHistory } from '@/src/core/firebase/services/reportHistory';

/** Contact Us — free-text message from the user. */
export async function submitContactMessage(message: string): Promise<void> {
  await submitToGoogleForm({ type: 'contact', message });
}

/** App feedback with a 1–5 star rating. */
export async function submitFeedback(rating: number, message: string): Promise<void> {
  await submitToGoogleForm({
    type: 'feedback',
    rating,
    // Keeps the row readable in the sheet even when the user rates without commenting.
    message: message || '(no comment)',
  });
}

/**
 * Report a problem with the app itself (Settings → Report a Problem).
 *
 * `screenshotUri` is accepted for call-site compatibility but is deliberately
 * NOT uploaded: it's a local file:// path that would be meaningless outside the
 * device. It's noted in the description so support knows a screenshot exists and
 * can ask for it. Uploading it would mean pushing user images to Cloudinary from
 * a bug-report form, which isn't worth the storage.
 */
export async function submitProblemReport(
  category: string,
  description: string,
  screenshotUri?: string | null
): Promise<void> {
  await submitToGoogleForm({
    type: 'report',
    issueCategory: `app-problem / ${category}`,
    message: screenshotUri ? `${description}\n\n[User attached a screenshot on-device]` : description,
  });
}

/** Report an issue with a specific exam/quiz question. */
export async function submitQuestionReport(
  questionRef: string,
  issue: string,
  description: string
): Promise<void> {
  await Promise.all([
    submitToGoogleForm({
      type: 'report',
      questionReference: questionRef,
      issueCategory: `question / ${issue}`,
      message: description,
    }),
    createReportHistory({
      source: 'question',
      targetType: 'question',
      targetId: questionRef,
      targetTitle: questionRef,
      reason: issue,
      description,
    }),
  ]);
}
