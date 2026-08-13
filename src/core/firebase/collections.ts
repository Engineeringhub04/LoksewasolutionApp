// Firestore collection name constants (PRD §47 capabilities → inferred schema).
// Never hardcode a collection path string outside this file.
export const Collections = {
  users: 'users',
  subjects: 'subjects',
  chapters: (subjectId: string) => `subjects/${subjectId}/chapters`,
  topics: (subjectId: string, chapterId: string) => `subjects/${subjectId}/chapters/${chapterId}/topics`,
  questions: 'questions',
  mockTests: 'mockTests',
  liveExams: 'liveExams',
  attempts: 'attempts',
  currentAffairs: 'currentAffairs',
  gorkhapatra: 'gorkhapatra',
  notices: 'notices',
  discussions: 'discussions',
  comments: (discussionId: string) => `discussions/${discussionId}/comments`,
  bookmarks: 'bookmarks',
  notes: 'notes',
  achievements: 'achievements',
  leaderboard: 'leaderboard',
  // Kept for reference only — support/report traffic now goes to the Google Form
  // + Discord inbox (see src/core/messaging/), not Firestore. Nothing writes here.
  reports: 'reports',
  contactMessages: 'contactMessages',
  notifications: 'notifications',
  meta: 'meta',
  appOnboardingSettings: 'app_onboarding-settings',
  homeBanners: 'app_home_banners',
  developers: 'app_developers',

  // ===== Exam Hub =====
  // Provinces shown as the first filter row (Federal, Koshi, ... ). "All Board"
  // is a UI-level filter, not a stored document.
  examProvinces: 'app_exam_provinces',
  // Section tabs (MCQ Tests, Theory Desk, Past Qns, GK & PM). Each carries the
  // course/subcourse ids it applies to, so a section can be hidden for a given
  // subcourse purely from the database.
  examSections: 'app_exam_sections',
  // One document per exam card. Questions are embedded as an array on the
  // document rather than a subcollection: a set is always read whole, so this is
  // one read instead of N and keeps attempts consistent with the question list.
  examSets: 'app_exam_sets',
  // Rules are stored per course+subcourse+province+section so any one of them can
  // be changed later without affecting the rest.
  examRules: 'app_exam_rules',
  /** Per-user attempt history for an exam set (private to that user). */
  examAttempts: (uid: string) => `users/${uid}/exam_attempts`,
  /**
   * One public row per attempt, used to build per-exam leaderboards. Needed
   * because per-user subcollections can't be queried across users.
   */
  examRankings: 'app_exam_rankings',

  // ===== Theory Answer Upload + Admin Review =====
  // One document per submitted answer PDF. Flat top-level collection (not a
  // per-user subcollection) because the Admin desk must list/query submissions
  // across ALL users — something a subcollection cannot do.
  examAnswers: 'app_exam_answers',

  // ===== Subscription =====
  // Single settings document (id: 'config') holding the gateway mode
  // (auto/manual toggle), eSewa/Khalti/Fonepay merchant keys, QR/bank image
  // URL, and manual-payment instructions text. One doc, not a collection,
  // because there is only ever one active configuration.
  subscriptionSettings: 'app_subscription_settings',
  // Plan catalog — Free / Monthly / Yearly cards shown on the Subscription page.
  subscriptionPlans: 'app_subscription_plans',
  // One row per user subscription request/record. Flat top-level collection
  // (not a per-user subcollection) so the Admin desk can list/query pending
  // requests across ALL users.
  subscriptions: 'app_subscriptions',
  // Coupon codes — admin-created, time-limited, usable by both auto and
  // manual flows.
  couponCodes: 'app_coupon_codes',
} as const;
