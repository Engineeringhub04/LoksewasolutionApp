// Global Search (PRD §38, §47.9): grouped/typed results across content types.
import { fetchSubjects } from './content';
import { fetchDiscussions } from './discussions';
import { fetchAllQuestions } from './questions';

export interface SearchResultGroup<T> {
  type: 'subjects' | 'discussions' | 'questions';
  items: T[];
}

export async function searchContent(queryText: string) {
  const lower = queryText.trim().toLowerCase();
  if (!lower) return { subjects: [], discussions: [], questions: [] };

  const [subjects, discussions, questions] = await Promise.all([fetchSubjects(), fetchDiscussions(50), fetchAllQuestions(100)]);

  return {
    subjects: subjects.filter((s) => s.name.toLowerCase().includes(lower)),
    discussions: discussions.filter((d) => d.title.toLowerCase().includes(lower) || d.body.toLowerCase().includes(lower)),
    questions: questions.filter((q) => q.text.toLowerCase().includes(lower)),
  };
}
