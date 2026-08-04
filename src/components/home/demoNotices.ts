// Demo notices shown on Home until real notices exist in Firestore.
export interface DemoNotice {
  id: string;
  title: string;
  date: string;
}

export const DEMO_NOTICES: DemoNotice[] = [
  { id: 'demo-notice-1', title: 'New mock test series launched for this month', date: 'Today' },
  { id: 'demo-notice-2', title: 'App update available with bug fixes and improvements', date: 'Yesterday' },
  { id: 'demo-notice-3', title: 'Scheduled maintenance completed successfully', date: '2 days ago' },
];
