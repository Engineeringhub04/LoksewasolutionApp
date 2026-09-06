// Demo subject cards shown on Home until real subject content (matched to the
// user's specific subcourse) is added to Firestore. Picked by courseId so the
// list at least feels relevant (e.g. Civil Engineering shows Soil Mechanics).
export interface DemoSubject {
  id: string;
  name: string;
  icon: string;
  backgroundColor: string;
}

const CIVIL_SUBJECTS: DemoSubject[] = [
  { id: 'soil-mechanics', name: 'Soil Mechanics', icon: 'layers', backgroundColor: '#1D4ED8' },
  { id: 'surveying', name: 'Surveying', icon: 'compass', backgroundColor: '#059669' },
  { id: 'structural-analysis', name: 'Structural Analysis', icon: 'business', backgroundColor: '#EA580C' },
  { id: 'concrete-technology', name: 'Concrete Technology', icon: 'construct', backgroundColor: '#7C3AED' },
];

const ELECTRICAL_SUBJECTS: DemoSubject[] = [
  { id: 'circuit-theory', name: 'Circuit Theory', icon: 'flash', backgroundColor: '#1D4ED8' },
  { id: 'power-systems', name: 'Power Systems', icon: 'flash-outline', backgroundColor: '#059669' },
  { id: 'electrical-machines', name: 'Electrical Machines', icon: 'cog', backgroundColor: '#EA580C' },
  { id: 'control-systems', name: 'Control Systems', icon: 'options', backgroundColor: '#7C3AED' },
];

const GEOMETRIC_SUBJECTS: DemoSubject[] = [
  { id: 'geodesy', name: 'Geodesy', icon: 'globe', backgroundColor: '#1D4ED8' },
  { id: 'cadastral-survey', name: 'Cadastral Survey', icon: 'map', backgroundColor: '#059669' },
  { id: 'remote-sensing', name: 'Remote Sensing', icon: 'satellite', backgroundColor: '#EA580C' },
  { id: 'gis', name: 'GIS', icon: 'location', backgroundColor: '#7C3AED' },
];

const GENERAL_SUBJECTS: DemoSubject[] = [
  { id: 'general-knowledge', name: 'General Knowledge', icon: 'bulb', backgroundColor: '#1D4ED8' },
  { id: 'subjective-section', name: 'Subjective Section', icon: 'create', backgroundColor: '#059669' },
  { id: 'public-admin', name: 'Public Administration', icon: 'business', backgroundColor: '#EA580C' },
  { id: 'nepali-grammar', name: 'Nepali Grammar', icon: 'language', backgroundColor: '#7C3AED' },
];

export function demoSubjectsForCourse(courseId: string | null): DemoSubject[] {
  if (courseId === 'civil-engineering') return CIVIL_SUBJECTS;
  if (courseId === 'electrical-engineering') return ELECTRICAL_SUBJECTS;
  if (courseId === 'geometric-engineering') return GEOMETRIC_SUBJECTS;
  return GENERAL_SUBJECTS;
}
