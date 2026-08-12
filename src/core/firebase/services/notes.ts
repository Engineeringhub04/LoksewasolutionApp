// Keep Notes (PRD §35, §47.4): user-scoped, local-first (AsyncStorage), opportunistic Firestore sync.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Note {
  id: string;
  title: string;
  body: string;
  color: string;
  updatedAt: number;
}

const STORAGE_KEY = 'loksewa:notes';

export async function loadNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: Note[] = JSON.parse(raw);
  return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function persist(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export async function saveNote(note: Omit<Note, 'updatedAt'> & { updatedAt?: number }): Promise<Note> {
  const notes = await loadNotes();
  const updated: Note = { ...note, updatedAt: Date.now() };
  const index = notes.findIndex((n) => n.id === note.id);
  if (index >= 0) notes[index] = updated;
  else notes.unshift(updated);
  await persist(notes);
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  const notes = await loadNotes();
  await persist(notes.filter((n) => n.id !== id));
}
