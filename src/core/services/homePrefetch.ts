import { fetchHomeBanners, type HomeBanner } from '@/src/core/firebase/services/banners';
import { fetchDevelopers, type Developer } from '@/src/core/firebase/services/developer';
import { fetchNotifications, type AppNotification } from '@/src/core/firebase/services/notifications';
import { fetchSubjectDetails, type SubjectDetail } from '@/src/core/firebase/services/subjectDetails';
import { hasAnsweredQotdToday } from '@/src/core/firebase/services/qotd';

export interface HomeDataSnapshot {
  banners: HomeBanner[];
  developers: Developer[];
  notifications: AppNotification[];
  subjectDetails: SubjectDetail[];
  qotdAnswered: boolean;
}

export interface HomeDataKey {
  uid: string | null;
  courseId: string;
  subcourseId: string;
}

let cachedKey: string | null = null;
let cachedSnapshot: HomeDataSnapshot | null = null;
let inFlightKey: string | null = null;
let inFlight: Promise<HomeDataSnapshot> | null = null;

function keyOf(key: HomeDataKey): string {
  return `${key.uid ?? 'guest'}:${key.courseId}:${key.subcourseId}`;
}

async function fetchSnapshot(key: HomeDataKey, force = false): Promise<HomeDataSnapshot> {
  const [banners, developers, notifications, subjectDetails, qotdAnswered] = await Promise.all([
    fetchHomeBanners(),
    fetchDevelopers(),
    key.uid ? fetchNotifications(key.uid) : Promise.resolve([]),
    fetchSubjectDetails(key.courseId, key.subcourseId, { force }),
    key.uid
      ? hasAnsweredQotdToday(key.uid, key.courseId)
      : Promise.resolve(false),
  ]);

  return { banners, developers, notifications, subjectDetails, qotdAnswered };
}

export function getCachedHomeData(key: HomeDataKey): HomeDataSnapshot | null {
  return cachedKey === keyOf(key) ? cachedSnapshot : null;
}

export function prefetchHomeData(key: HomeDataKey, force = false): Promise<HomeDataSnapshot> {
  const requestKey = keyOf(key);
  if (!force && cachedKey === requestKey && cachedSnapshot) {
    return Promise.resolve(cachedSnapshot);
  }
  // A manual refresh can fan out to five screen hooks. They must all share the
  // same forced request rather than starting one Firebase read per field.
  if (inFlightKey === requestKey && inFlight) {
    return inFlight;
  }

  inFlightKey = requestKey;
  inFlight = fetchSnapshot(key, force)
    .then((snapshot) => {
      cachedKey = requestKey;
      cachedSnapshot = snapshot;
      return snapshot;
    })
    .finally(() => {
      if (inFlightKey === requestKey) {
        inFlight = null;
        inFlightKey = null;
      }
    });

  return inFlight;
}

export function invalidateHomeData(key?: HomeDataKey): void {
  if (!key || cachedKey === keyOf(key)) {
    cachedKey = null;
    cachedSnapshot = null;
  }
}

export function clearHomeDataCache(): void {
  cachedKey = null;
  cachedSnapshot = null;
  inFlight = null;
  inFlightKey = null;
}
