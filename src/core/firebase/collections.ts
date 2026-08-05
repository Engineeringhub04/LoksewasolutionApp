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
  /** Per-user attempt history for an exam set. */
  examAttempts: (uid: string) => `users/${uid}/exam_attempts`,
} as const;
