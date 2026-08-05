// One-time seeder for the Exam Hub (provinces, section tabs, exam sets, rules).
//
// Triggered from the seed button in the Exam tab header. Safe to re-run: every
// document uses a deterministic id, so a second run overwrites rather than
// duplicating.
import { commitWrites, setWrite, type WriteSpec } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import type { ExamQuestion } from '@/src/core/firebase/services/examHub';

// Firestore caps a commit at 500 writes, and these documents carry embedded
// question arrays, so batches are kept well under that for payload size too.
const WRITE_CHUNK = 120;

const PROVINCES: { id: string; nameEn: string; nameNe: string }[] = [
  { id: 'federal', nameEn: 'Federal Exam', nameNe: 'संघीय परीक्षा' },
  { id: 'koshi', nameEn: 'Koshi Province', nameNe: 'कोशी प्रदेश' },
  { id: 'madhesh', nameEn: 'Madhesh Province', nameNe: 'मधेश प्रदेश' },
  { id: 'bagmati', nameEn: 'Bagmati Province', nameNe: 'बागमती प्रदेश' },
  { id: 'gandaki', nameEn: 'Gandaki Province', nameNe: 'गण्डकी प्रदेश' },
  { id: 'lumbini', nameEn: 'Lumbini Province', nameNe: 'लुम्बिनी प्रदेश' },
  { id: 'karnali', nameEn: 'Karnali Province', nameNe: 'कर्णाली प्रदेश' },
  { id: 'sudurpaschim', nameEn: 'Sudurpaschim Province', nameNe: 'सुदूरपश्चिम प्रदेश' },
];

const SECTIONS: {
  id: string;
  nameEn: string;
  nameNe: string;
  kind: 'mcq' | 'theory' | 'mixed';
  color: string;
  description: string;
}[] = [
  {
    id: 'mcq-tests',
    nameEn: 'MCQ Tests',
    nameNe: 'वस्तुगत परीक्षा',
    kind: 'mcq',
    color: '#2563EB',
    description:
      'Elevate your learning curve. Toggle through boards, verify rules, study high-value questions and boost confidence today.',
  },
  {
    id: 'theory-desk',
    nameEn: 'Theory Desk',
    nameNe: 'विषयगत डेस्क',
    kind: 'theory',
    color: '#0F766E',
    description:
      'Subjective paper sets with full model answers. Open the paper, study the structure and practise writing complete answers.',
  },
  {
    id: 'past-qns',
    nameEn: 'Past Qns',
    nameNe: 'पुराना प्रश्नहरू',
    kind: 'mixed',
    color: '#7C3AED',
    description:
      'Real questions from previous Loksewa examinations, board by board, so you know exactly what gets asked.',
  },
  {
    id: 'gk-pm',
    nameEn: 'GK & PM',
    nameNe: 'सामान्य ज्ञान',
    kind: 'mcq',
    color: '#D97706',
    description:
      'General knowledge and public management practice — the shared paper that decides most Loksewa results.',
  },
];

/** courseId -> subcourseIds, matching what seedCourseData() writes. */
const COURSE_TREE: { courseId: string; subcourseIds: string[] }[] = [
  { courseId: 'civil-engineering', subcourseIds: ['civil-assistant-sub-engineer', 'civil-sub-engineer', 'civil-engineering-7th'] },
  { courseId: 'geometric-engineering', subcourseIds: ['amin', 'surveyor', 'geometric-engineering-7th'] },
  { courseId: 'electrical-engineering', subcourseIds: ['electrical-assistant-engineer', 'sub-electrical-engineer', 'electrical-engineering-7th'] },
];

const SAMPLE_QUESTIONS: ExamQuestion[] = [
  {
    question: 'Which river is the longest in Nepal?',
    options: ['Koshi', 'Karnali', 'Gandaki', 'Bagmati'],
    correctIndex: 1,
    explanation: 'The Karnali is the longest river in Nepal, flowing about 507 km within the country.',
  },
  {
    question: 'The minimum grade of concrete recommended for reinforced concrete work is:',
    options: ['M10', 'M15', 'M20', 'M25'],
    correctIndex: 2,
    explanation: 'M20 is the minimum grade recommended for reinforced concrete in normal exposure conditions.',
  },
  {
    question: 'Which article of the Constitution of Nepal 2072 guarantees the right to education?',
    options: ['Article 29', 'Article 31', 'Article 33', 'Article 35'],
    correctIndex: 1,
    explanation: 'Article 31 of the Constitution of Nepal 2072 guarantees every citizen the right to education.',
  },
];

const RULES = [
  {
    icon: 'time-outline',
    title: 'Fixed time limit',
    description: 'The timer starts the moment you begin and does not pause. The exam submits automatically when it reaches zero.',
  },
  {
    icon: 'list-outline',
    title: 'Answer in any order',
    description: 'Use the question numbers on the left to jump between questions. You can revisit and change any answer before submitting.',
  },
  {
    icon: 'remove-circle-outline',
    title: 'Negative marking',
    description: 'A wrong answer deducts 0.25 marks. Questions you skip are not penalised, so guess only when you can rule options out.',
  },
  {
    icon: 'wifi-outline',
    title: 'Stay connected',
    description: 'Keep a stable internet connection. Your answers are saved when you submit, so losing connection mid-exam can cost your attempt.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Do not leave the exam',
    description: 'Leaving the exam screen asks for confirmation. If you confirm, the attempt ends and is recorded as it stands.',
  },
  {
    icon: 'eye-off-outline',
    title: 'Results timing',
    description: 'Answer review and rankings unlock only after the official exam end time, so nobody gains an advantage by finishing early.',
  },
  {
    icon: 'refresh-outline',
    title: 'Multiple attempts',
    description: 'You may re-attempt an exam as often as you like. Every attempt is kept in your history with its own score.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Fair play',
    description: 'Work on your own. Sharing questions or answers outside the app spoils the practice for everyone preparing with you.',
  },
];

/**
 * Start times are staggered per province so all three card states are visible
 * immediately after seeding, instead of everything sitting in one state:
 *   koshi   -> opens in ~6 min  (countdown button)
 *   madhesh -> opens in 3 hours (card hidden until 10 min before)
 *   others  -> already open     (Start / View Question)
 */
function startTimeFor(provinceId: string, now: number): Date {
  if (provinceId === 'koshi') return new Date(now + 6 * 60 * 1000);
  if (provinceId === 'madhesh') return new Date(now + 3 * 60 * 60 * 1000);
  return new Date(now - 60 * 60 * 1000);
}

function difficultyFor(index: number): 'easy' | 'medium' | 'hard' {
  return index % 3 === 0 ? 'easy' : index % 3 === 1 ? 'medium' : 'hard';
}

export interface SeedProgress {
  written: number;
  total: number;
}

/**
 * Seeds provinces, sections, one exam set per
 * (subcourse x province x section) and matching rules.
 */
export async function seedExamHub(onProgress?: (p: SeedProgress) => void): Promise<SeedProgress> {
  const now = Date.now();
  const writes: WriteSpec[] = [];

  // Provinces
  PROVINCES.forEach((p, i) => {
    writes.push(setWrite(`${Collections.examProvinces}/${p.id}`, { ...p, order: i + 1 }));
  });

  // Sections — empty course/subcourse arrays mean "applies everywhere"; add ids
  // later to hide a tab for a specific subcourse.
  SECTIONS.forEach((s, i) => {
    writes.push(
      setWrite(`${Collections.examSections}/${s.id}`, {
        nameEn: s.nameEn,
        nameNe: s.nameNe,
        kind: s.kind,
        color: s.color,
        description: s.description,
        order: i + 1,
        courseIds: [],
        subcourseIds: [],
      })
    );
  });

  // Shared fallback rules, used when no more specific document exists.
  writes.push(setWrite(`${Collections.examRules}/default`, { rules: RULES }));

  let variant = 0;
  for (const { courseId, subcourseIds } of COURSE_TREE) {
    for (const subcourseId of subcourseIds) {
      for (const province of PROVINCES) {
        for (const section of SECTIONS) {
          const id = `${subcourseId}__${province.id}__${section.id}`;
          const isPdf = section.kind === 'theory';
          variant += 1;

          writes.push(
            setWrite(`${Collections.examSets}/${id}`, {
              courseId,
              subcourseId,
              provinceId: province.id,
              sectionId: section.id,
              title: `${province.nameEn} · ${section.nameEn} Set 1`,
              startTime: startTimeFor(province.id, now),
              totalQuestions: isPdf ? 0 : SAMPLE_QUESTIONS.length,
              durationMinutes: isPdf ? 0 : 5,
              passPercent: 40,
              // Every 4th set is pro, so the "To Buy" state is testable.
              accessType: variant % 4 === 0 ? 'pro' : 'free',
              difficulty: difficultyFor(variant),
              contentType: isPdf ? 'pdf' : 'mcq',
              pdfUrl: isPdf ? 'https://drive.google.com/file/d/1SAMPLE_THEORY_PAPER/view' : null,
              questions: isPdf ? [] : SAMPLE_QUESTIONS,
            })
          );

          // Rules are stored per combination so any single one can be changed
          // later without touching the others.
          writes.push(setWrite(`${Collections.examRules}/${id}`, { rules: RULES }));
        }
      }
    }
  }

  const total = writes.length;
  let written = 0;
  for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
    await commitWrites(writes.slice(i, i + WRITE_CHUNK));
    written = Math.min(i + WRITE_CHUNK, total);
    onProgress?.({ written, total });
  }

  return { written, total };
}
