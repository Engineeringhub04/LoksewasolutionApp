export type ConstitutionUiLanguage = 'np' | 'en';

export const constitutionLabels = {
  np: {
    title: 'नेपालको संविधान',
    sectionsTitle: 'संविधानका खण्डहरू',
    sectionCount: (count: number) => `${toNepaliDigits(count)} वटा खण्ड`,
    partsAndSchedules: 'भागहरू र अनुसूचीहरू',
    searchPlaceholder: 'संविधानका खण्डहरू खोज्नुहोस्',
    noMatchingSection: 'कुनै मिल्दो खण्ड भेटिएन',
    searchEmptyHint: 'अर्को भाग वा अनुसूची खोज्नुहोस्।',
    loading: 'संविधान सामग्री तयार हुँदैछ...',
    unavailableTitle: 'सामग्री उपलब्ध छैन',
    unavailableDescription: 'यो खण्ड खोल्न इन्टरनेट जडान आवश्यक छ। पहिले सुरक्षित गरिएको खण्ड भए इन्टरनेटबिना पनि खुल्नेछ।',
    retry: 'पुनः प्रयास गर्नुहोस्',
    share: 'साझा गर्नुहोस्',
    changeLanguage: 'संविधानको भाषा परिवर्तन गर्नुहोस्',
    preamble: 'प्रस्तावना',
    part: (number: string | number) => `भाग ${toNepaliDigits(number)}`,
    schedule: (number: string | number) => `अनुसूची ${toNepaliDigits(number)}`,
    article: (number: string | number) => `धारा ${toNepaliDigits(number)}`,
  },
  en: {
    title: 'The Constitution of Nepal',
    sectionsTitle: 'Constitution Sections',
    sectionCount: (count: number) => `${count} sections`,
    partsAndSchedules: 'Parts and Schedules',
    searchPlaceholder: 'Search Constitution sections',
    noMatchingSection: 'No matching section',
    searchEmptyHint: 'Search for another Part or Schedule.',
    loading: 'Loading Constitution content...',
    unavailableTitle: 'Content unavailable',
    unavailableDescription: 'An internet connection is required to open this section. A section downloaded earlier can also be opened offline.',
    retry: 'Retry',
    share: 'Share',
    changeLanguage: 'Change Constitution language',
    preamble: 'Preamble',
    part: (number: string | number) => `Part ${number}`,
    schedule: (number: string | number) => `Schedule ${number}`,
    article: (number: string | number) => `Article ${number}`,
  },
} as const;

function toNepaliDigits(value: string | number): string {
  const digits = '०१२३४५६७८९';
  return String(value).replace(/[0-9]/g, (digit) => digits[Number(digit)]);
}
