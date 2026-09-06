// Content read services (PRD §47.3): Subjects, Chapters, Topics, Notices,
// Current Affairs, Gorkhapatra. Thin wrappers over Firestore REST queries.
import { getDocument, listDocuments, runQuery } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

export interface Subject {
  id: string;
  name: string;
  icon: string;
  chapterCount: number;
}

export interface Chapter {
  id: string;
  title: string;
  topicCount: number;
}

export interface Topic {
  id: string;
  title: string;
  body: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  featuredOnHome: boolean;
  date: { toDate: () => Date } | null;
}

export interface CurrentAffairItem {
  id: string;
  headline: string;
  summary: string;
  category: string;
  date: { toDate: () => Date } | null;
}

export interface GorkhapatraEdition {
  id: string;
  date: { toDate: () => Date } | null;
  sections: { title: string; summary: string }[];
}

export async function fetchSubjects(): Promise<Subject[]> {
  return (await listDocuments(Collections.subjects)) as unknown as Subject[];
}

export async function fetchSubject(subjectId: string): Promise<Subject | null> {
  return (await getDocument(`${Collections.subjects}/${subjectId}`)) as Subject | null;
}

export async function fetchChapters(subjectId: string): Promise<Chapter[]> {
  return (await listDocuments(Collections.chapters(subjectId))) as unknown as Chapter[];
}

export async function fetchTopics(subjectId: string, chapterId: string): Promise<Topic[]> {
  return (await listDocuments(Collections.topics(subjectId, chapterId))) as unknown as Topic[];
}

export async function fetchTopic(subjectId: string, chapterId: string, topicId: string): Promise<Topic | null> {
  return (await getDocument(`${Collections.topics(subjectId, chapterId)}/${topicId}`)) as Topic | null;
}

export async function fetchNotices(max = 20): Promise<Notice[]> {
  return (await runQuery(Collections.notices, {
    orderBy: [{ field: 'date', direction: 'desc' }],
    limit: max,
  })) as unknown as Notice[];
}

export async function fetchCurrentAffairs(max = 30): Promise<CurrentAffairItem[]> {
  return (await runQuery(Collections.currentAffairs, {
    orderBy: [{ field: 'date', direction: 'desc' }],
    limit: max,
  })) as unknown as CurrentAffairItem[];
}

export async function fetchGorkhapatraEditions(max = 30): Promise<GorkhapatraEdition[]> {
  return (await runQuery(Collections.gorkhapatra, {
    orderBy: [{ field: 'date', direction: 'desc' }],
    limit: max,
  })) as unknown as GorkhapatraEdition[];
}
