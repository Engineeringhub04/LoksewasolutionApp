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
} as const;
