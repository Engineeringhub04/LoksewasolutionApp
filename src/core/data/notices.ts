// Hardcoded notice content (until a real Firestore-backed notices admin panel
// exists). Single source of truth: the Notices page reads this list in full,
// and Home's "Recent Notices" section shows just the first 3.
export interface AppNotice {
  id: string;
  title: string;
  description: string;
  date: string;
}

export const APP_NOTICES: AppNotice[] = [
  {
    id: 'notice-1',
    title: 'New Mock Test Series Launched',
    description: 'A brand new mock test series covering this month\u2019s syllabus is now available. Practice under real exam conditions.',
    date: 'Today',
  },
  {
    id: 'notice-2',
    title: 'App Update Available',
    description: 'We\u2019ve fixed several bugs and improved performance across the app. Update now for the best experience.',
    date: 'Yesterday',
  },
  {
    id: 'notice-3',
    title: 'Scheduled Maintenance Completed',
    description: 'Our scheduled server maintenance has been completed successfully. All services are back to normal.',
    date: '2 days ago',
  },
  {
    id: 'notice-4',
    title: 'Live Exam Schedule for This Week',
    description: 'Check the Exam tab for this week\u2019s live exam timings and make sure you don\u2019t miss your slot.',
    date: '4 days ago',
  },
  {
    id: 'notice-5',
    title: 'Welcome to Loksewa\u2019s Solution',
    description: 'Thank you for joining! Explore subjects, take mock tests, and track your progress every day.',
    date: '1 week ago',
  },
];
