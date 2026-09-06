import { getDocument, setDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface DiscussionGuidelines {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  version: number;
  updatedAt: unknown;
}

const DEFAULT_GUIDELINES: Omit<DiscussionGuidelines, 'id'> = {
  title: 'Community Guidelines',
  body: 'Keep the Discussion space useful, respectful and focused on learning.',
  bullets: [
    'Be respectful and avoid personal attacks.',
    'Share accurate, course-related information.',
    'Do not post private payment, password or contact details.',
    'Report content that is abusive, misleading or unsafe.',
  ],
  version: 1,
  updatedAt: null,
};

function parseGuidelines(doc: Record<string, unknown>): DiscussionGuidelines {
  return {
    id: typeof doc.id === 'string' ? doc.id : 'default',
    title: typeof doc.title === 'string' ? doc.title : DEFAULT_GUIDELINES.title,
    body: typeof doc.body === 'string' ? doc.body : DEFAULT_GUIDELINES.body,
    bullets: Array.isArray(doc.bullets) ? doc.bullets.filter((value): value is string => typeof value === 'string') : DEFAULT_GUIDELINES.bullets,
    version: typeof doc.version === 'number' ? doc.version : 1,
    updatedAt: doc.updatedAt ?? null,
  };
}

export async function fetchDiscussionGuidelines(): Promise<DiscussionGuidelines> {
  const doc = await getDocument(`${Collections.discussionGuidelines}/default`);
  return parseGuidelines(doc ?? { id: 'default', ...DEFAULT_GUIDELINES });
}

/** Admin-only in Firestore rules; the fixed ID makes repeated seeding safe. */
export async function seedDiscussionGuidelines(): Promise<void> {
  await setDocument(`${Collections.discussionGuidelines}/default`, {
    ...DEFAULT_GUIDELINES,
    seeded: true,
  }, { merge: true });
}
