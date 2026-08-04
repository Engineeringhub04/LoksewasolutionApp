// "About Developer" section content — admin-seeded, shown on Home.
import { listDocuments, commitWrites, setWrite } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface Developer {
  id: string;
  name: string;
  description: string;
  photoUrl: string;
  viewUrl: string;
}

export async function fetchDevelopers(): Promise<Developer[]> {
  const docs = await listDocuments(Collections.developers);
  return docs as unknown as Developer[];
}

/** Seeds the single developer profile — dev/admin utility. */
export async function seedDeveloperData(): Promise<void> {
  await commitWrites([
    setWrite(`${Collections.developers}/kishan-raut`, {
      name: 'Kishan Raut',
      description:
        'Full-stack developer passionate about building tools that help Nepali students achieve their government job dreams.',
      photoUrl: 'https://i.ibb.co/gb8KRz3x/IMG-0562.png',
      viewUrl: 'https://www.kishanraut.com.np',
    }),
  ]);
}
