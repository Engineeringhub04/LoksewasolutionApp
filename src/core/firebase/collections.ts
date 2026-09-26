// Firestore collection name constants (PRD §47 capabilities → inferred schema).
// Never hardcode a collection path string outside this file.
export const Collections = {
  users: 'users',
  // Legacy content collections remain unchanged for backward compatibility.
  subjects: 'subjects',
  chapters: (subjectId: string) => `subjects/${subjectId}/chapters`,
  units: (subjectId: string) => `subjects/${subjectId}/units`,
  unit: (subjectId: string, unitId: string) => `subjects/${subjectId}/units/${unitId}`,
  unitChapters: (subjectId: string, unitId: string) => `subjects/${subjectId}/units/${unitId}/chapters`,
  // New syllabus-driven learning catalog; isolated from legacy content.
  learningSubjects: 'app_learning_subjects',
  learningChapters: (subjectId: string) => `app_learning_subjects/${subjectId}/chapters`,
  learningUnits: (subjectId: string) => `app_learning_subjects/${subjectId}/units`,
  learningUnitChapters: (subjectId: string, unitId: string) => `app_learning_subjects/${subjectId}/units/${unitId}/chapters`,
  // Flat catalog collections for the Subject admin/data model. The nested paths
  // above remain available for backward compatibility with the first release.
  learningChapterRecords: 'app_learning_chapters',
  learningUnitRecords: 'app_learning_units',
  learningUnitChapterRecords: 'app_learning_unit_chapters',
  // Phase 1 subject-page catalog; scoped by course and subcourse.
  subjectDetails: 'app_subjects_details',
  // Phase 2 subject structure catalog; scoped by course, subcourse and subject.
  subjectChapterDetails: 'app_subjects_chapter_details',
  subjectUnitDetails: 'app_subjects_units_details',
  subjectUnitChapterDetails: 'app_subjects_unit-chapters_details',
  // New subject-page content model; question mode is stored on each document so
  // Practice and Read banks remain independently manageable.
  learningQuestions: 'app_learning_questions',
  learningQuestionBanks: 'app_learning_question_banks',
  learningTheory: 'app_learning_theory',
  // Phase 5 content collections: one question/resource document per syllabus record.
  subjectCucqDataAllMode: 'app_subject_cucqdata_Allmode',
  subjectTheoryResources: 'app_subject_theory_resources',
  // Independent Additional Features content; intentionally separate from learning subjects.
  additionalFeaturePages: 'app_additional_feature_pages',
  additionalFeatureQuestionBanks: 'app_additional_feature_question_banks',
  topics: (subjectId: string, chapterId: string) => `subjects/${subjectId}/chapters/${chapterId}/topics`,
  questions: 'questions',
  mockTests: 'mockTests',
  liveExams: 'liveExams',
  attempts: 'attempts',
  // Current Affairs collections were removed on 2026-09-13 along with the
  // feature's screens and service. Re-add them here if the feature is rebuilt.
  gorkhapatra: 'gorkhapatra',
  // Notice board — `app_` prefix per the 2026-09 convention (migrated from the
  // legacy unprefixed `notices` collection).
  notices: 'app_notices',
  discussions: 'discussions',
  comments: (discussionId: string) => `discussions/${discussionId}/comments`,
  replies: (discussionId: string, commentId: string) => `discussions/${discussionId}/comments/${commentId}/replies`,
  discussionReactions: (discussionId: string) => `discussions/${discussionId}/reactions`,
  commentReactions: (discussionId: string, commentId: string) => `discussions/${discussionId}/comments/${commentId}/reactions`,
  replyReactions: (discussionId: string, commentId: string, replyId: string) => `discussions/${discussionId}/comments/${commentId}/replies/${replyId}/reactions`,
  discussionGuidelines: 'app_discussion_guidelines',
  reportHistory: 'app_report_history',
  bookmarks: 'bookmarks',
  learningProgress: (uid: string) => `users/${uid}/learning_progress`,
  notes: 'notes',
  achievements: 'achievements',
  leaderboard: 'leaderboard',
  // Kept for reference only — support/report traffic now goes to the Google Form
  // + Discord inbox (see src/core/messaging/), not Firestore. Nothing writes here.
  reports: 'reports',
  contactMessages: 'contactMessages',
  notifications: 'notifications',
  // Admin campaign audit log AND the app's global broadcast feed. Docs tagged
  // `kind: 'gorkhapatra'` are surfaced in every login user's inbox (including
  // accounts created later), so historical broadcasts stay visible to new users.
  appNotifications: 'app_notifications',
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
  // Existing single settings document (id: 'config') holds enabled flags,
  // manual QR/bank details, and instructions. Provider secret keys must be
  // removed from this client-readable document and stored only in a secure
  // backend/secret manager when gateway integration is implemented.
  subscriptionSettings: 'app_subscription_settings',
  // Plan catalog — Free / Monthly / Yearly cards shown on the Subscription page.
  subscriptionPlans: 'app_subscription_plans',
  // One row per user subscription request/record. Flat top-level collection
  // (not a per-user subcollection) so the Admin desk can list/query pending
  // requests across ALL users.
  subscriptions: 'app_subscriptions',
  // Individual premium exam purchase requests. Kept separate from overall
  // subscription requests so the existing plan lifecycle remains unchanged.
  examPurchases: 'app_exam_purchases',
  // Individual Subject/Unit/Chapter purchase requests. Kept separate from
  // subscriptions and exam purchases so each entitlement has its own review flow.
  contentPurchases: 'app_content_purchases',
  // Coupon codes — admin-created, time-limited, usable by both auto and
  // manual flows.
  couponCodes: 'app_coupon_codes',

  // ===== Syllabus =====
  // Flat collection: one document per course+subcourse combination.
  // Document ID = courseId__subcourseId for O(1) direct reads (no query needed).
  syllabusData: 'app_syllabusdata',

  // ===== Daily Test =====
  // One document per Daily Test model (a small daily quiz). Scoped by
  // course+subcourse so the query is filtered to just the enrolled subcourse
  // (single-field index on subcourseId — Spark-plan friendly, low read count).
  dailyTestModels: 'app_daily_test_models',
  /** Per-user Daily Test results (private history, one doc per attempt). */
  dailyTestResults: (uid: string) => `users/${uid}/daily_test_results`,

  // ===== Push Notifications =====
  // Anonymous device push tokens. Because the app requires login to reach Home,
  // a NOT-logged-in device has no user document to attach its Expo push token to —
  // it lives here instead, keyed by a stable installation id. This is the ONLY
  // client-writable-while-signed-out collection; its rule is schema-locked and
  // client reads are denied (only an admin can list tokens to send a broadcast).
  devicePushTokens: 'app_device_push_tokens',
  // Logged-in devices store their Expo push token in a per-user subcollection
  // (keyed by the same stable installation id) so it can be listed by the admin
  // for targeted sends and removed cleanly on sign-out. A subcollection is used
  // instead of a field on the user doc because the user-doc update rule pins the
  // owner-writable key set and does not include a tokens field.
  userPushTokens: (uid: string) => `users/${uid}/push_tokens`,

  // ===== Single-device login =====
  /**
   * One account = one device. A single document (id `active`) names the device
   * that currently holds the account; a new device overwrites it and the
   * displaced device signs itself out on its next foreground check.
   *
   * A subcollection rather than a field on the user doc for the same reason as
   * push_tokens above: the owner-writable key set on `users/{uid}` is pinned by
   * the rules and adding to it would loosen a rule that already works.
   */
  userSession: (uid: string) => `users/${uid}/session`,
  /** The one session document id. Anything else is rejected by the rules. */
  activeSessionId: 'active',

  // ===== Main Leaderboard =====
  /**
   * Private per-user aggregate, one document per enrolled subcourse. Holds the
   * full source-by-source breakdown (QOTD, exams, daily tests, practice, read,
   * theory, GK/PM, constitution...) that produced the score.
   */
  mainLeaderboard: (uid: string) => `users/${uid}/app_mainleaderboard`,
  /**
   * Public mirror of the above — ONE row per user per subcourse, which is what
   * the leaderboard screen actually queries. It exists because the private
   * subcollection above is owner-read-only and Firestore cannot query across
   * per-user subcollections; same reason app_exam_rankings exists.
   *
   * Document id is `${uid}__${subcourseId}` so republishing overwrites in place
   * instead of piling up a new row per refresh.
   */
  mainLeaderboardPublic: 'app_main_leaderboard',
  /**
   * Foreground time and activity counters — the "app focus" signal. Kept out of
   * the user document because that doc's update rule pins an owner-writable key
   * set, and out of the leaderboard doc because it is written far more often.
   */
  appUsage: (uid: string) => `users/${uid}/app_usage`,
  /**
   * Progress for everything that previously persisted nothing (read mode, theory
   * mode, GK, PM, constitution, past questions). One document per activity,
   * id `${source}__${refId}`, so all of them share a single collection and a
   * single security rule instead of six.
   */
  activityProgress: (uid: string) => `users/${uid}/app_activity_progress`,

  // ===== Analytics =====
  /**
   * Private per-user analytics, one document per enrolled subcourse. Owner-only
   * with NO public mirror — unlike the leaderboard, this screen shows a user
   * only their own data, so nothing here is ever queried across users.
   *
   * Holds the current breakdown plus a `days` map of up to 180 daily snapshots
   * of the CUMULATIVE totals. Every other progress collection in this app is
   * cumulative and carries no per-day record, so a trend chart is impossible to
   * reconstruct from them; storing cumulative snapshots and differencing
   * consecutive days is what makes per-day effort, minutes and activity
   * recoverable at all. See services/analyticsSnapshot.
   */
  analytics: (uid: string) => `users/${uid}/app_analytics`,

  // ===== Content totals (coverage denominator) =====
  /**
   * ONE document per subcourse holding how much content the app contains — the
   * denominator behind the profile progress ring. The ring measures COVERAGE
   * ("how much of this subcourse have you actually worked through"), which is
   * impossible to compute on the client any other way: Firestore's REST API
   * exposes no count aggregation here, most question banks are arrays nested
   * inside parent documents, and scanning six catalog collections on every score
   * publish would cost hundreds of reads per user per day.
   *
   * The admin site maintains it atomically — every content create/edit/delete
   * ships an `increment()` transform for this document inside the very same
   * commit as the content write, so the counters cannot drift from a partial
   * write, and a "Recompute totals" action re-derives exact values if they ever
   * do. Reading it costs the app exactly one document.
   */
  contentTotals: 'app_content_totals',
} as const;
