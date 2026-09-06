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

/** Test paper used by every Theory Desk set until real papers are uploaded. */
const THEORY_PDF_URL = 'https://drive.google.com/file/d/1Y-ldqTaV2dGW38jl5LnOjMiywlnWH_of/view?usp=drivesdk';

/** Technical/engineering questions — used by MCQ Tests and Past Qns. */
const TECHNICAL_QUESTIONS: ExamQuestion[] = [
  {
    question: 'The minimum grade of concrete recommended for reinforced concrete work is:',
    options: ['M10', 'M15', 'M20', 'M25'],
    correctIndex: 2,
    explanation: 'M20 is the minimum grade recommended for reinforced concrete under normal exposure conditions.',
  },
  {
    question: 'The standard size of a brick used in Nepal (including mortar) is:',
    options: ['190 x 90 x 90 mm', '200 x 100 x 100 mm', '230 x 110 x 55 mm', '250 x 120 x 70 mm'],
    correctIndex: 1,
    explanation: 'A nominal brick with mortar is taken as 200 x 100 x 100 mm, which keeps modular planning simple.',
  },
  {
    question: 'Slump test on fresh concrete measures:',
    options: ['Strength', 'Workability', 'Durability', 'Permeability'],
    correctIndex: 1,
    explanation: 'The slump test is a field measure of workability — how easily fresh concrete flows and compacts.',
  },
  {
    question: 'The safe bearing capacity of soil is usually determined by:',
    options: ['Slump test', 'Plate load test', 'Los Angeles test', 'Vicat test'],
    correctIndex: 1,
    explanation: 'A plate load test loads the soil in place and is the standard field method for safe bearing capacity.',
  },
  {
    question: 'In a simply supported beam carrying a uniformly distributed load, the maximum bending moment occurs at:',
    options: ['The supports', 'One quarter span', 'Mid span', 'It is constant'],
    correctIndex: 2,
    explanation: 'For a UDL on a simply supported beam the maximum moment is wL squared over 8, at mid span.',
  },
  {
    question: 'The instrument used to measure horizontal and vertical angles in surveying is:',
    options: ['Level', 'Theodolite', 'Planimeter', 'Clinometer'],
    correctIndex: 1,
    explanation: 'A theodolite measures both horizontal and vertical angles precisely.',
  },
  {
    question: 'Curing of concrete is done mainly to:',
    options: ['Increase workability', 'Retain moisture for hydration', 'Reduce cost', 'Improve colour'],
    correctIndex: 1,
    explanation: 'Curing keeps moisture available so cement hydration continues and design strength is reached.',
  },
  {
    question: 'The unit of electrical resistance is:',
    options: ['Ampere', 'Volt', 'Ohm', 'Watt'],
    correctIndex: 2,
    explanation: 'Resistance is measured in ohms, defined as one volt per ampere.',
  },
  {
    question: 'One-way slabs are generally designed when the ratio of longer to shorter span is:',
    options: ['Less than 1', 'Equal to 1', 'Greater than 2', 'Exactly 1.5'],
    correctIndex: 2,
    explanation: 'When the span ratio exceeds 2 the load travels mainly along the shorter span, so it is designed one-way.',
  },
  {
    question: 'The purpose of a damp proof course (DPC) in a building is to:',
    options: ['Carry the roof load', 'Stop rising moisture', 'Improve appearance', 'Increase floor height'],
    correctIndex: 1,
    explanation: 'A DPC is an impervious layer that blocks moisture rising from the ground into the walls.',
  },
];

/** General knowledge / public management — used by the GK & PM section. */
const GK_QUESTIONS: ExamQuestion[] = [
  {
    question: 'Which river is the longest in Nepal?',
    options: ['Koshi', 'Karnali', 'Gandaki', 'Bagmati'],
    correctIndex: 1,
    explanation: 'The Karnali is the longest river in Nepal, running about 507 km inside the country.',
  },
  {
    question: 'Which article of the Constitution of Nepal 2072 guarantees the right to education?',
    options: ['Article 29', 'Article 31', 'Article 33', 'Article 35'],
    correctIndex: 1,
    explanation: 'Article 31 guarantees every citizen the right to education, including free basic education.',
  },
  {
    question: 'How many provinces does Nepal have under the Constitution of 2072?',
    options: ['5', '6', '7', '8'],
    correctIndex: 2,
    explanation: 'Nepal is a federal republic made up of seven provinces.',
  },
  {
    question: 'The Public Service Commission of Nepal is constituted under which part of the Constitution?',
    options: ['Part 20', 'Part 21', 'Part 23', 'Part 25'],
    correctIndex: 2,
    explanation: 'Part 23 of the Constitution establishes the Public Service Commission and its functions.',
  },
  {
    question: 'Who appoints the Chief Justice of Nepal?',
    options: ['Prime Minister', 'President on the recommendation of the Constitutional Council', 'Speaker', 'Law Minister'],
    correctIndex: 1,
    explanation: 'The President appoints the Chief Justice on the Constitutional Council\'s recommendation.',
  },
  {
    question: 'The term of office of a member of the House of Representatives is:',
    options: ['4 years', '5 years', '6 years', '7 years'],
    correctIndex: 1,
    explanation: 'Members of the House of Representatives serve a five-year term.',
  },
  {
    question: 'In public administration, "accountability" primarily means:',
    options: ['Following seniority', 'Answering for decisions and results', 'Avoiding paperwork', 'Increasing budget'],
    correctIndex: 1,
    explanation: 'Accountability is the obligation to answer for one\'s decisions, actions and the results achieved.',
  },
  {
    question: 'Which is the highest mountain located entirely within Nepal?',
    options: ['Mt. Everest', 'Kanchenjunga', 'Manaslu', 'Dhaulagiri'],
    correctIndex: 2,
    explanation: 'Manaslu (8,163 m) lies wholly inside Nepal, unlike Everest and Kanchenjunga which sit on borders.',
  },
  {
    question: 'The fiscal year in Nepal begins on:',
    options: ['1 Baisakh', '1 Shrawan', '1 Kartik', '1 Magh'],
    correctIndex: 1,
    explanation: 'Nepal\'s fiscal year runs from 1 Shrawan to the end of Asar.',
  },
  {
    question: '"Good governance" in the Nepali civil service context does NOT include:',
    options: ['Transparency', 'Rule of law', 'Participation', 'Favouritism'],
    correctIndex: 3,
    explanation: 'Favouritism is contrary to good governance, which rests on transparency, rule of law and participation.',
  },
];

function questionsFor(sectionId: string): ExamQuestion[] {
  if (sectionId === 'gk-pm') return GK_QUESTIONS;
  return TECHNICAL_QUESTIONS;
}

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

  // Every exam-set id is deterministic, so this run overwrites the previous seed
  // in place. That is what lets Past Qns switch some of its sets from MCQ to
  // paper without leaving stale documents behind — no manual cleanup needed.

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
          // Past Qns carries BOTH kinds of paper, alternating per province, so
          // that tab genuinely exercises the mixed case: an MCQ set behaves like
          // MCQ Tests (Start -> quiz) and a theory set like Theory Desk
          // (View Question -> paper). Theory Desk is always a paper; the two MCQ
          // sections are always questions.
          const isPdf =
            section.kind === 'theory' ||
            (section.kind === 'mixed' && PROVINCES.findIndex((p) => p.id === province.id) % 2 === 1);
          const questions = isPdf ? [] : questionsFor(section.id);
          variant += 1;

          writes.push(
            setWrite(`${Collections.examSets}/${id}`, {
              courseId,
              subcourseId,
              provinceId: province.id,
              sectionId: section.id,
              title: `${province.nameEn} · ${section.nameEn} Set 1`,
              startTime: startTimeFor(province.id, now),
              totalQuestions: questions.length,
              // Roughly a minute per question, so the timer is realistic.
              durationMinutes: isPdf ? 0 : questions.length,
              passPercent: 40,
              // Every 4th set is pro, so the "To Buy" state is testable.
              accessType: variant % 4 === 0 ? 'pro' : 'free',
              difficulty: difficultyFor(variant),
              contentType: isPdf ? 'pdf' : 'mcq',
              pdfUrl: isPdf ? THEORY_PDF_URL : null,
              questions,
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
