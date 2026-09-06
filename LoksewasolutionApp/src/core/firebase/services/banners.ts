// Home hero banner slides — admin-seeded, shown in the auto-sliding carousel
// at the top of Home. Each slide is either an image (remote URL) or a plain
// color+text slide (imageLink omitted), with an optional tap-through link.
import { runQuery, commitWrites, setWrite } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface HomeBanner {
  id: string;
  order: number;
  heading: string;
  subheading: string;
  backgroundColor: string;
  imageLink?: string | null;
  linkUrl?: string | null;
}

export async function fetchHomeBanners(): Promise<HomeBanner[]> {
  const docs = await runQuery(Collections.homeBanners, {
    orderBy: [{ field: 'order', direction: 'asc' }],
  });
  return docs as unknown as HomeBanner[];
}

/** Seeds 3 demo banners (2 image-based, 1 color+text) — dev/admin utility. */
export async function seedHomeBanners(): Promise<void> {
  const writes = [
    setWrite(`${Collections.homeBanners}/banner-1`, {
      order: 1,
      heading: 'Weekly Mock Tests',
      subheading: 'Practice with real exam patterns every week',
      backgroundColor: '#1D4ED8',
      imageLink: 'https://i.ibb.co/rfL4jkjM/preview2-ls.png',
      linkUrl: null,
    }),
    setWrite(`${Collections.homeBanners}/banner-2`, {
      order: 2,
      heading: 'Live Exams',
      subheading: 'Compete with fellow aspirants in real time',
      backgroundColor: '#0F766E',
      imageLink: 'https://i.ibb.co/35BFfgVf/preview1-ls.png',
      linkUrl: null,
    }),
    setWrite(`${Collections.homeBanners}/banner-3`, {
      order: 3,
      heading: 'Prepare Smarter, Score Higher',
      subheading: 'Your complete Loksewa preparation companion',
      backgroundColor: '#F59E0B',
      imageLink: null,
      linkUrl: null,
    }),
  ];
  await commitWrites(writes);
}
