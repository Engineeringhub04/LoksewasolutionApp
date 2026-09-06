import { Collections } from '@/src/core/firebase/collections';
import {
  civilSubEngineerLearningCatalog,
  type LearningChapterSeed,
  type LearningSubjectSeed,
  type LearningUnitSeed,
} from '@/src/core/firebase/learningCatalog';
import { commitWrites, serverTimestamp, setWrite, type WriteSpec } from '@/src/core/firebase/firestoreRest';
import { discoverSubjectDetailScopes, type SubjectDetailScope } from '@/src/core/firebase/services/subjectDetails';

export interface SubjectStructureSeedResult {
  scopes: number;
  chapterRecords: number;
  unitRecords: number;
  unitChapterRecords: number;
  totalRecords: number;
}

const DIRECT_SUBJECT_IDS = new Set(['general-awareness', 'public-management']);
const TECHNICAL_SUBJECT_ID = 'technical-subject';
const CATALOG_TECHNICAL_SUBJECT_ID = 'job-based-knowledge';

function subjectIdForCatalog(subject: LearningSubjectSeed): string {
  return subject.id === CATALOG_TECHNICAL_SUBJECT_ID ? TECHNICAL_SUBJECT_ID : subject.id;
}

function documentId(...parts: string[]): string {
  return parts.map((part) => part.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('__');
}

function chapterWrite(
  scope: SubjectDetailScope,
  subject: LearningSubjectSeed,
  chapter: LearningChapterSeed,
): WriteSpec {
  const subjectId = subjectIdForCatalog(subject);
  return setWrite(
    `${Collections.subjectChapterDetails}/${documentId(scope.course, scope.subcourse, subjectId, chapter.id)}`,
    {
      name: chapter.title,
      nameNe: chapter.titleNe,
      order: chapter.order,
      course: scope.course,
      subcourse: scope.subcourse,
      subjectId,
      unit: null,
      unitId: null,
      pro: false,
      price: 0,
      isPublished: true,
      isSeed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function unitWrite(
  scope: SubjectDetailScope,
  subject: LearningSubjectSeed,
  unit: LearningUnitSeed,
): WriteSpec {
  const subjectId = subjectIdForCatalog(subject);
  return setWrite(
    `${Collections.subjectUnitDetails}/${documentId(scope.course, scope.subcourse, subjectId, unit.id)}`,
    {
      name: unit.title,
      nameNe: unit.titleNe,
      order: unit.order,
      course: scope.course,
      subcourse: scope.subcourse,
      subjectId,
      pro: true,
      price: 50,
      chapterCount: unit.chapters.length,
      isPublished: true,
      isSeed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function unitChapterWrite(
  scope: SubjectDetailScope,
  subject: LearningSubjectSeed,
  unit: LearningUnitSeed,
  chapter: LearningChapterSeed,
): WriteSpec {
  const subjectId = subjectIdForCatalog(subject);
  return setWrite(
    `${Collections.subjectUnitChapterDetails}/${documentId(scope.course, scope.subcourse, subjectId, unit.id, chapter.id)}`,
    {
      name: chapter.title,
      nameNe: chapter.titleNe,
      order: chapter.order,
      course: scope.course,
      subcourse: scope.subcourse,
      subjectId,
      unitId: unit.id,
      unit: unit.title,
      unitNameNe: unit.titleNe,
      pro: true,
      price: 50,
      isPublished: true,
      isSeed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function buildSubjectStructureWrites(scopes: SubjectDetailScope[]): {
  writes: WriteSpec[];
  chapterRecords: number;
  unitRecords: number;
  unitChapterRecords: number;
} {
  const writes: WriteSpec[] = [];
  let chapterRecords = 0;
  let unitRecords = 0;
  let unitChapterRecords = 0;

  for (const scope of scopes) {
    for (const subject of civilSubEngineerLearningCatalog) {
      const subjectId = subjectIdForCatalog(subject);

      if (DIRECT_SUBJECT_IDS.has(subjectId)) {
        for (const chapter of subject.chapters ?? []) {
          writes.push(chapterWrite(scope, subject, chapter));
          chapterRecords += 1;
        }
      }

      if (subjectId === TECHNICAL_SUBJECT_ID) {
        for (const unit of subject.units ?? []) {
          writes.push(unitWrite(scope, subject, unit));
          unitRecords += 1;
          for (const chapter of unit.chapters) {
            writes.push(unitChapterWrite(scope, subject, unit, chapter));
            unitChapterRecords += 1;
          }
        }
      }
    }
  }

  return { writes, chapterRecords, unitRecords, unitChapterRecords };
}

export async function seedSubjectStructureDetails(): Promise<SubjectStructureSeedResult> {
  const scopes = await discoverSubjectDetailScopes();
  const built = buildSubjectStructureWrites(scopes);
  await commitWrites(built.writes);
  return {
    scopes: scopes.length,
    chapterRecords: built.chapterRecords,
    unitRecords: built.unitRecords,
    unitChapterRecords: built.unitChapterRecords,
    totalRecords: built.writes.length,
  };
}
