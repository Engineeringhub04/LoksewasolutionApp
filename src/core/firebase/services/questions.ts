import { runQuery } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { fetchLearningQuestions, type LearningQuestion, type LearningQuestionMode } from '@/src/core/firebase/services/learningContent';
import { DEFAULT_LEARNING_COURSE_ID, DEFAULT_LEARNING_SUBCOURSE_ID } from '@/src/core/firebase/services/learning';

export interface Question {
  id: string;
  subjectId: string;
  chapterId: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mode?: LearningQuestionMode;
  textNe?: string;
  optionsNe?: string[];
  explanationNe?: string;
}

function toQuestion(question: LearningQuestion): Question {
  return {
    id: question.id,
    subjectId: question.subjectId,
    chapterId: question.chapterId,
    text: question.text,
    options: question.options,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    difficulty: question.difficulty,
    mode: question.mode,
    textNe: question.textNe,
    optionsNe: question.optionsNe,
    explanationNe: question.explanationNe,
  };
}

export async function fetchQuestionsBySubject(subjectId: string, max = 50): Promise<Question[]> {
  return (await runQuery(Collections.questions, {
    where: [{ field: 'subjectId', op: '==', value: subjectId }],
    limit: max,
  })) as unknown as Question[];
}

export async function fetchQuestionsByChapter(
  subjectId: string,
  chapterId: string,
  max = 100,
  courseId = DEFAULT_LEARNING_COURSE_ID,
  subcourseId = DEFAULT_LEARNING_SUBCOURSE_ID,
): Promise<Question[]> {
  const learningQuestions = await fetchLearningQuestions(courseId, subcourseId, subjectId, chapterId);
  if (learningQuestions.length > 0) return learningQuestions.map(toQuestion).slice(0, max);

  return (await runQuery(Collections.questions, {
    where: [
      { field: 'subjectId', op: '==', value: subjectId },
      { field: 'chapterId', op: '==', value: chapterId },
    ],
    limit: max,
  })) as unknown as Question[];
}

export async function fetchAllQuestions(max = 200): Promise<Question[]> {
  return (await runQuery(Collections.questions, { limit: max })) as unknown as Question[];
}

export async function fetchRandomQuestion(): Promise<Question | null> {
  const all = await fetchAllQuestions();
  if (all.length === 0) return null;
  return all[Math.floor(Math.random() * all.length)];
}
