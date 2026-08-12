// Dev-only demo data seeder. Populates Firestore with 2-3 sample docs per collection
// so every screen in the app has something real to render without manual data entry.
// Triggered from the "Seed Demo Data" button on the Login screen (dev builds only).
import { commitWrites, setWrite, serverTimestamp, type WriteSpec } from './firestoreRest';
import { Collections } from './collections';
import { isFirebaseConfigured } from './env';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function seedDemoData(): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }

  const writes: WriteSpec[] = [];

  // Subjects
  const subjects = [
    { id: 'general-knowledge', name: 'General Knowledge', icon: 'earth-outline', chapterCount: 2 },
    { id: 'nepali-grammar', name: 'Nepali Grammar', icon: 'language-outline', chapterCount: 2 },
    { id: 'mathematics', name: 'Mathematics', icon: 'calculator-outline', chapterCount: 1 },
  ];
  for (const s of subjects) {
    writes.push(setWrite(`${Collections.subjects}/${s.id}`, {
      name: s.name,
      icon: s.icon,
      chapterCount: s.chapterCount,
      createdAt: serverTimestamp(),
    }));
  }

  // Chapters + topics for "general-knowledge"
  const gkChapters = [
    { id: 'geography', title: 'Geography of Nepal', topicCount: 2 },
    { id: 'history', title: 'History of Nepal', topicCount: 1 },
  ];
  for (const c of gkChapters) {
    writes.push(setWrite(`${Collections.chapters('general-knowledge')}/${c.id}`, {
      title: c.title,
      topicCount: c.topicCount,
      createdAt: serverTimestamp(),
    }));
  }
  const gkTopics = [
    { id: 'rivers', chapterId: 'geography', title: 'Major Rivers of Nepal', body: 'Nepal has three major river systems: Koshi, Gandaki, and Karnali...' },
    { id: 'mountains', chapterId: 'geography', title: 'Mountain Ranges', body: 'Nepal contains 8 of the world\'s 14 highest peaks above 8000m...' },
    { id: 'unification', chapterId: 'history', title: 'Unification of Nepal', body: 'King Prithvi Narayan Shah unified Nepal starting from Gorkha in 1743...' },
  ];
  for (const t of gkTopics) {
    writes.push(setWrite(`${Collections.topics('general-knowledge', t.chapterId)}/${t.id}`, {
      title: t.title,
      body: t.body,
      createdAt: serverTimestamp(),
    }));
  }

  // Questions
  const questions = [
    {
      id: 'q1',
      subjectId: 'general-knowledge',
      chapterId: 'geography',
      text: 'What is the longest river in Nepal?',
      options: ['Koshi', 'Karnali', 'Gandaki', 'Bagmati'],
      correctIndex: 1,
      explanation: 'The Karnali River is the longest river in Nepal.',
      difficulty: 'easy',
    },
    {
      id: 'q2',
      subjectId: 'general-knowledge',
      chapterId: 'history',
      text: 'Who unified modern Nepal?',
      options: ['Prithvi Narayan Shah', 'Bhimsen Thapa', 'Jung Bahadur Rana', 'Mahendra'],
      correctIndex: 0,
      explanation: 'King Prithvi Narayan Shah led the unification campaign.',
      difficulty: 'easy',
    },
    {
      id: 'q3',
      subjectId: 'nepali-grammar',
      chapterId: null,
      text: 'सर्वनामको उदाहरण कुन हो?',
      options: ['राम', 'ऊ', 'किताब', 'सुन्दर'],
      correctIndex: 1,
      explanation: '"ऊ" is a pronoun (सर्वनाम).',
      difficulty: 'medium',
    },
  ];
  for (const q of questions) {
    writes.push(setWrite(`${Collections.questions}/${q.id}`, { ...q, createdAt: serverTimestamp() }));
  }

  // Mock tests
  const mockTests = [
    { id: 'mock-1', title: 'General Knowledge Mock Test 1', questionIds: ['q1', 'q2'], durationMinutes: 30, markingScheme: '+1 / -0.25' },
    { id: 'mock-2', title: 'Full Syllabus Mock Test', questionIds: ['q1', 'q2', 'q3'], durationMinutes: 60, markingScheme: '+1 / 0' },
  ];
  for (const m of mockTests) {
    writes.push(setWrite(`${Collections.mockTests}/${m.id}`, { ...m, published: true, createdAt: serverTimestamp() }));
  }

  // Live exams
  const liveExams = [
    {
      id: 'live-1',
      title: 'Weekly Live Exam',
      questionIds: ['q1', 'q2', 'q3'],
      durationMinutes: 45,
      scheduledStart: new Date(Date.now() + 3600 * 1000),
    },
  ];
  for (const l of liveExams) {
    writes.push(setWrite(`${Collections.liveExams}/${l.id}`, { ...l, createdAt: serverTimestamp() }));
  }

  // Current affairs
  const currentAffairs = [
    { id: 'ca-1', headline: 'Nepal signs new trade agreement', summary: 'Nepal and neighboring country sign a bilateral trade pact...', category: 'Economy', date: daysAgo(0) },
    { id: 'ca-2', headline: 'New hydropower project inaugurated', summary: 'A 456MW hydropower project began commercial operation...', category: 'National', date: daysAgo(1) },
  ];
  for (const c of currentAffairs) {
    writes.push(setWrite(`${Collections.currentAffairs}/${c.id}`, { ...c }));
  }

  // Gorkhapatra
  const gorkhapatra = [
    { id: 'gp-1', date: daysAgo(0), sections: [{ title: 'Editorial', summary: 'Todays editorial on public service reform...' }] },
    { id: 'gp-2', date: daysAgo(1), sections: [{ title: 'National News', summary: 'Coverage of national assembly proceedings...' }] },
  ];
  for (const g of gorkhapatra) {
    writes.push(setWrite(`${Collections.gorkhapatra}/${g.id}`, { ...g }));
  }

  // Notices
  const notices = [
    { id: 'notice-1', title: 'New mock test series launched', body: 'We have launched a new mock test series for Kharidar level.', featuredOnHome: true, date: daysAgo(0) },
    { id: 'notice-2', title: 'Scheduled maintenance completed', body: 'Scheduled maintenance completed successfully.', featuredOnHome: true, date: daysAgo(2) },
    { id: 'notice-3', title: 'App update available', body: 'A new version with bug fixes is now available.', featuredOnHome: false, date: daysAgo(4) },
  ];
  for (const n of notices) {
    writes.push(setWrite(`${Collections.notices}/${n.id}`, { ...n }));
  }

  // Discussions + comments
  const discussions = [
    { id: 'disc-1', title: 'How to prepare for Kharidar exam?', body: 'Looking for tips on preparation strategy...', category: 'Tips', likeCount: 4, commentCount: 2 },
    { id: 'disc-2', title: 'Best books for General Knowledge?', body: 'Can anyone recommend good GK books?', category: 'Resources', likeCount: 2, commentCount: 1 },
  ];
  for (const d of discussions) {
    writes.push(setWrite(`${Collections.discussions}/${d.id}`, { ...d, createdAt: serverTimestamp() }));
  }
  const comments = [
    { discussionId: 'disc-1', id: 'c1', body: 'Start with NCERT-style structured notes.', authorName: 'Demo User' },
    { discussionId: 'disc-1', id: 'c2', body: 'Daily current affairs really helped me.', authorName: 'Demo User 2' },
    { discussionId: 'disc-2', id: 'c1', body: 'Try the Loksewa Solution GK notes section.', authorName: 'Demo User' },
  ];
  for (const c of comments) {
    writes.push(setWrite(`${Collections.comments(c.discussionId)}/${c.id}`, {
      body: c.body,
      authorName: c.authorName,
      createdAt: serverTimestamp(),
    }));
  }

  // Achievements
  const achievements = [
    { id: 'ach-1', title: 'First Mock Test', description: 'Complete your first mock test', icon: 'ribbon-outline' },
    { id: 'ach-2', title: '7 Day Streak', description: 'Study for 7 consecutive days', icon: 'flame-outline' },
    { id: 'ach-3', title: 'Discussion Starter', description: 'Create your first discussion post', icon: 'chatbubbles-outline' },
  ];
  for (const a of achievements) {
    writes.push(setWrite(`${Collections.achievements}/${a.id}`, { ...a }));
  }

  // Leaderboard
  const leaderboard = [
    { id: 'lb-1', name: 'Sita Sharma', score: 98, scope: 'all-time' },
    { id: 'lb-2', name: 'Ram Thapa', score: 91, scope: 'all-time' },
    { id: 'lb-3', name: 'Gita KC', score: 87, scope: 'all-time' },
  ];
  for (const l of leaderboard) {
    writes.push(setWrite(`${Collections.leaderboard}/${l.id}`, { ...l }));
  }

  writes.push(setWrite(`${Collections.meta}/seedInfo`, { seededAt: serverTimestamp() }));

  await commitWrites(writes);
}
