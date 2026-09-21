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
import { uploadImageToCloudinary } from '@/src/core/media/cloudinary';
import { createReportHistory, type ReportSource, type ReportTargetType } from '@/src/core/firebase/services/reportHistory';

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
 * The screenshot is uploaded to Cloudinary and its HTTPS URL is appended to the
 * message body. Previously the picked image was dropped and the body just said
 * "[User attached a screenshot on-device]" — a note about a file nobody could
 * ever open, which is the one part of a bug report support actually wants.
 *
 * The URL rides inside the EXISTING message field on purpose. The Apps Script
 * that relays form rows to Discord lives in Google's cloud, not in this repo, so
 * the form's entry ids, the `type: 'report'` literal and the
 * `issueCategory: 'app-problem / <category>'` shape all have to stay exactly as
 * they are. Putting the link in the body means zero changes on that side and the
 * existing Discord embed renders it as a clickable link for free.
 *
 * A failed upload is NOT a failed report: the old marker goes in instead and the
 * user's description is still delivered. Losing the screenshot is a nuisance;
 * losing the bug report because the network wobbled is not acceptable.
 */
export async function submitProblemReport(
  category: string,
  description: string,
  screenshotUri?: string | null,
  onUploadProgress?: (fraction: number) => void
): Promise<void> {
  let body = description;

  if (screenshotUri) {
    try {
      const url = await uploadImageToCloudinary(screenshotUri, onUploadProgress);
      body = `${description}\n\nScreenshot: ${url}`;
    } catch {
      body = `${description}\n\n[User attached a screenshot, but the upload failed]`;
    }
  }

  await submitToGoogleForm({
    type: 'report',
    issueCategory: `app-problem / ${category}`,
    message: body,
  });

  // App-problem reports used to exist only in the Google Sheet, so the user's own
  // Report History page never showed them. The history copy is best-effort: the
  // report has already reached support by this point, and a Firestore hiccup (or
  // a signed-out user) must not turn a delivered report into a visible failure.
  try {
    await createReportHistory({
      source: 'app',
      targetType: 'app',
      targetId: 'app-problem',
      targetTitle: category,
      contextLabel: 'App · Report a Problem',
      reason: category,
      description: body,
    });
  } catch {
    // ignore — Discord/Sheet delivery already succeeded
  }
}

/** Everything a context-aware report needs to reach both Discord and the history page. */
export interface ContextReportInput {
  /** History grouping, e.g. 'question' for anything question-shaped. */
  source: ReportSource;
  targetType: ReportTargetType;
  /** Stable id of the reported item. */
  targetId: string;
  /** Short human title (the question text, the article name…). */
  targetTitle?: string | null;
  /** The auto-filled context block — options, answer, chapter, set name… */
  targetPreview?: string | null;
  /** Origin shown as a badge, e.g. "Exam · Set 3" or "GK · Practice Mode". */
  contextLabel: string;
  /** The chosen category (or the user's own words when they picked "Other"). */
  reason: string;
  description: string;
  /** Discord prefix — `<context> / <category>`; defaults to `source`. */
  formContext?: string;
}

/**
 * The single entry point for every report icon in the app.
 *
 * It fans out to the two places a report has to land: the Google Form (whose
 * Apps Script relays it to Discord — the entry ids, `type: 'report'` and the
 * `issueCategory: '<context> / <category>'` shape must stay byte-identical), and
 * the user's private Report History in Firestore.
 *
 * Both are awaited together: if the Form post fails the user should see an
 * error, because that is the copy support actually reads.
 */
export async function submitContextReport(input: ContextReportInput): Promise<void> {
  const context = input.formContext ?? input.source;
  const reference = input.targetTitle?.trim() || input.targetId;
  // The context block rides inside the message body so the Discord embed shows
  // the question and its options without any change on the Apps Script side.
  const body = input.targetPreview?.trim()
    ? `${input.description}\n\n--- Reported content ---\n${input.targetPreview.trim()}`
    : input.description;

  await Promise.all([
    submitToGoogleForm({
      type: 'report',
      questionReference: `${input.contextLabel} :: ${reference}`,
      issueCategory: `${context} / ${input.reason}`,
      message: body,
    }),
    createReportHistory({
      source: input.source,
      targetType: input.targetType,
      targetId: input.targetId,
      targetTitle: input.targetTitle ?? null,
      targetPreview: input.targetPreview ?? null,
      contextLabel: input.contextLabel,
      reason: input.reason,
      description: input.description,
    }),
  ]);
}

/** Report an issue with a specific exam/quiz question (manual entry screen). */
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
      contextLabel: 'Question · Manual report',
      reason: issue,
      description,
    }),
  ]);
}
