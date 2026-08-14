export type LearningHierarchy = 'direct-chapters' | 'unit-chapters';

export interface LearningChapterSeed {
  id: string;
  order: number;
  title: string;
  titleNe: string;
}

export interface LearningUnitSeed {
  id: string;
  order: number;
  title: string;
  titleNe: string;
  icon: string;
  chapters: LearningChapterSeed[];
}

export interface LearningSubjectSeed {
  id: string;
  order: number;
  title: string;
  titleNe: string;
  icon: string;
  hierarchy: LearningHierarchy;
  chapters?: LearningChapterSeed[];
  units?: LearningUnitSeed[];
}

const chapter = (id: string, order: number, title: string, titleNe: string): LearningChapterSeed => ({
  id,
  order,
  title,
  titleNe,
});

const unit = (id: string, order: number, title: string, titleNe: string, icon: string, chapters: LearningChapterSeed[]): LearningUnitSeed => ({
  id,
  order,
  title,
  titleNe,
  icon,
  chapters,
});

export const civilSubEngineerLearningCatalog: LearningSubjectSeed[] = [
  {
    id: 'general-awareness',
    order: 1,
    title: 'General Awareness',
    titleNe: 'सामान्य ज्ञान',
    icon: 'globe-outline',
    hierarchy: 'direct-chapters',
    chapters: [
      chapter('ga-1-1', 1, 'Geographical condition, natural resources and means of Nepal', 'नेपालको भौगोलिक अवस्था, प्राकृतिक स्रोत र साधनहरू'),
      chapter('ga-1-2', 2, 'Historical, cultural and social condition of Nepal', 'नेपालको ऐतिहासिक, सांस्कृतिक र सामाजिक अवस्था सम्बन्धी जानकारी'),
      chapter('ga-1-3', 3, 'Economic condition and current periodic plans of Nepal', 'नेपालको आर्थिक अवस्था र चालू आवधिक योजना सम्बन्धी जानकारी'),
      chapter('ga-1-4', 4, 'Biodiversity, sustainable development, environment, pollution, climate change and population management', 'जैविक विविधता, दिगो विकास, वातावरण, प्रदूषण, जलवायु परिवर्तन र जनसङ्ख्या व्यवस्थापन'),
      chapter('ga-1-5', 5, 'Important achievements of science and technology with direct impact on human life', 'मानव जीवनमा प्रत्यक्ष प्रभाव पार्ने विज्ञान र प्रविधिका महत्वपूर्ण उपलब्धिहरू'),
      chapter('ga-1-6', 6, 'General information on public health, diseases, food and nutrition', 'जनस्वास्थ्य, रोग, खाद्य र पोषण सम्बन्धी सामान्य जानकारी'),
      chapter('ga-1-7', 7, 'Constitution of Nepal: Parts 1 to 5 and schedules', 'नेपालको संविधान — भाग १ देखि ५ सम्म र अनुसूचीहरू'),
      chapter('ga-1-8', 8, 'United Nations and its specialized agencies', 'संयुक्त राष्ट्रसङ्घ र यसका विशिष्टीकृत संस्थाहरू सम्बन्धी जानकारी'),
      chapter('ga-1-9', 9, 'Regional organizations: SAARC, BIMSTEC, ASEAN and European Union', 'क्षेत्रीय सङ्गठन — सार्क, बिमस्टेक, आसियान र युरोपियन सङ्घ — सम्बन्धी जानकारी'),
      chapter('ga-1-10', 10, 'National and international contemporary activities', 'राष्ट्रिय र अन्तर्राष्ट्रिय महत्वका समसामयिक गतिविधिहरू'),
    ],
  },
  {
    id: 'public-management',
    order: 2,
    title: 'Public Management',
    titleNe: 'सार्वजनिक व्यवस्थापन',
    icon: 'briefcase-outline',
    hierarchy: 'direct-chapters',
    chapters: [
      chapter('pm-2-1', 1, 'Office Management', 'कार्यालय व्यवस्थापन'),
      chapter('pm-2-2', 2, 'Provisions under the Civil Service Act and Regulations', 'निजामती सेवा ऐन तथा नियमावलीमा भएका व्यवस्थाहरू'),
      chapter('pm-2-3', 3, 'Federal Affairs and General Administration Ministry', 'सङ्घीय मामिला तथा सामान्य प्रशासन मन्त्रालय सम्बन्धी जानकारी'),
      chapter('pm-2-4', 4, 'Constitutional bodies', 'संवैधानिक निकाय सम्बन्धी जानकारी'),
      chapter('pm-2-5', 5, 'Government budget, accounting and auditing system', 'सरकारी बजेट, लेखा तथा लेखापरीक्षण प्रणाली सम्बन्धी सामान्य जानकारी'),
      chapter('pm-2-6', 6, 'Meaning, agencies, methods and means of public service delivery', 'सार्वजनिक सेवा प्रवाहको अर्थ, सेवा प्रवाह गर्ने निकाय, तरिका र माध्यमहरू'),
      chapter('pm-2-7', 7, 'Human rights, good governance and right to information', 'मानव अधिकार, सुशासन र सूचनाको हक सम्बन्धी सामान्य जानकारी'),
      chapter('pm-2-8', 8, 'Public Charter', 'सार्वजनिक बडापत्र'),
      chapter('pm-2-9', 9, 'Management concepts and direction, control, coordination, decision-making, motivation and leadership in public management', 'व्यवस्थापनको अवधारणा तथा सार्वजनिक व्यवस्थापनमा निर्देशन, नियन्त्रण, समन्वय, निर्णय प्रक्रिया, उत्प्रेरणा र नेतृत्व सम्बन्धी जानकारी'),
      chapter('pm-2-10', 10, 'Human values, civic duties and responsibilities, and discipline', 'मानवीय मूल्य मान्यता, नागरिक कर्तव्य तथा दायित्व र अनुशासन'),
    ],
  },
  {
    id: 'job-based-knowledge',
    order: 3,
    title: 'Job Based Knowledge',
    titleNe: 'सेवा सम्बन्धित कार्य–ज्ञान',
    icon: 'construct-outline',
    hierarchy: 'unit-chapters',
    units: [
      unit('surveying', 1, 'Surveying', 'सर्भेइङ', 'compass-outline', [
        chapter('surveying-1-1', 1, 'General', 'सामान्य'),
        chapter('surveying-1-2', 2, 'Levelling', 'लेभलिङ'),
        chapter('surveying-1-3', 3, 'Plane Tabling', 'प्लेन टेबलिङ'),
        chapter('surveying-1-4', 4, 'Theodolite and Traverse Surveying', 'थियोडोलाइट तथा ट्राभर्स सर्भेइङ'),
        chapter('surveying-1-5', 5, 'Contouring', 'कन्टुरिङ'),
        chapter('surveying-1-6', 6, 'Setting Out', 'सेटिङ आउट'),
      ]),
      unit('construction-materials', 2, 'Construction Materials', 'निर्माण सामग्री', 'business-outline', [
        chapter('construction-materials-2-1', 1, 'Stone', 'ढुङ्गा'),
        chapter('construction-materials-2-2', 2, 'Cement', 'सिमेन्ट'),
        chapter('construction-materials-2-3', 3, 'Clay and Clay Products', 'माटो तथा माटोबाट बनेका सामग्री'),
        chapter('construction-materials-2-4', 4, 'Paints and Varnishes', 'रङ तथा वार्निस'),
        chapter('construction-materials-2-5', 5, 'Bitumen', 'बिटुमिन'),
      ]),
      unit('mechanics-materials-structures', 3, 'Mechanics of Materials and Structures', 'पदार्थ तथा संरचनाको यान्त्रिकी', 'git-compare-outline', [
        chapter('mechanics-3-1', 1, 'Mechanics of Materials', 'पदार्थको यान्त्रिकी'),
        chapter('mechanics-3-2', 2, 'Mechanics of Beams', 'बीमको यान्त्रिकी'),
        chapter('mechanics-3-3', 3, 'Simple Strut Theory', 'साधारण स्ट्रट सिद्धान्त'),
      ]),
      unit('hydraulics', 4, 'Hydraulics', 'हाइड्रोलिक्स', 'water-outline', [
        chapter('hydraulics-4-1', 1, 'General', 'सामान्य'),
        chapter('hydraulics-4-2', 2, 'Hydro-Kinematics and Hydro-Dynamics', 'हाइड्रो–काइनेमेटिक्स तथा हाइड्रो–डाइनामिक्स'),
        chapter('hydraulics-4-3', 3, 'Measurement of Discharge', 'डिस्चार्ज मापन'),
        chapter('hydraulics-4-4', 4, 'Flows', 'प्रवाह'),
      ]),
      unit('soil-mechanics', 5, 'Soil Mechanics', 'माटोको यान्त्रिकी', 'layers-outline', [
        chapter('soil-5-1', 1, 'General', 'सामान्य'),
        chapter('soil-5-2', 2, 'Soil Water Relation', 'माटो–पानी सम्बन्ध'),
        chapter('soil-5-3', 3, 'Compaction of Soil', 'माटोको कम्प्याक्सन'),
        chapter('soil-5-4', 4, 'Shear Strength of Soils', 'माटोको कतरनी सामर्थ्य'),
        chapter('soil-5-5', 5, 'Earth Pressures', 'माटोको दबाब'),
        chapter('soil-5-6', 6, 'Foundation Engineering', 'फाउन्डेसन इन्जिनियरिङ'),
      ]),
      unit('structural-design', 6, 'Structural Design', 'संरचनात्मक डिजाइन', 'resize-outline', [
        chapter('structural-6-1', 1, 'R.C. Sections in Bending', 'बङ्ग्याइमा R.C. सेक्सनहरू'),
        chapter('structural-6-2', 2, 'Shear and Bond for R.C. Sections', 'R.C. सेक्सनका लागि शियर तथा बन्ड'),
        chapter('structural-6-3', 3, 'Axially Loaded R.C. Columns', 'अक्षीय भारित R.C. स्तम्भहरू'),
        chapter('structural-6-4', 4, 'Design and Drafting of R.C. Structures', 'R.C. संरचनाको डिजाइन तथा ड्राफ्टिङ'),
      ]),
      unit('building-construction-technology', 7, 'Building Construction Technology', 'भवन निर्माण प्रविधि', 'home-outline', [
        chapter('building-7-1', 1, 'Foundations', 'फाउन्डेसन'),
        chapter('building-7-2', 2, 'Walls', 'पर्खाल'),
        chapter('building-7-3', 3, 'Damp Proofing', 'ड्याम्प प्रुफिङ'),
        chapter('building-7-4', 4, 'Concrete Technology', 'कङ्क्रिट प्रविधि'),
        chapter('building-7-5', 5, 'Wood Work', 'काठको काम'),
        chapter('building-7-6', 6, 'Flooring and Finishing', 'फ्लोरिङ तथा फिनिसिङ'),
      ]),
      unit('water-supply-sanitation', 8, 'Water Supply and Sanitation Engineering', 'खानेपानी तथा सरसफाइ इन्जिनियरिङ', 'water-outline', [
        chapter('water-8-1', 1, 'General', 'सामान्य'),
        chapter('water-8-2', 2, 'Gravity Water Supply System', 'ग्राभिटी खानेपानी आपूर्ति प्रणाली'),
        chapter('water-8-3', 3, 'Design of Sewer', 'ढलको डिजाइन'),
        chapter('water-8-4', 4, 'Excreta Disposal and Unsewered Area', 'दिशाजन्य फोहोर व्यवस्थापन तथा ढलविहीन क्षेत्र'),
      ]),
      unit('irrigation-engineering', 9, 'Irrigation Engineering', 'सिँचाइ इन्जिनियरिङ', 'leaf-outline', [
        chapter('irrigation-9-1', 1, 'General', 'सामान्य'),
        chapter('irrigation-9-2', 2, 'Crop Water Requirement', 'बालीको पानी आवश्यकता'),
        chapter('irrigation-9-3', 3, 'Irrigation Canals', 'सिँचाइ नहरहरू'),
      ]),
      unit('highway-engineering', 10, 'Highway Engineering', 'राजमार्ग इन्जिनियरिङ', 'git-network-outline', [
        chapter('highway-10-1', 1, 'General', 'सामान्य'),
        chapter('highway-10-2', 2, 'Geometric Design', 'ज्यामितीय डिजाइन'),
        chapter('highway-10-3', 3, 'Drainage System', 'ड्रेनेज प्रणाली'),
        chapter('highway-10-4', 4, 'Road Pavement', 'सडक पेभमेन्ट'),
        chapter('highway-10-5', 5, 'Road Machineries', 'सडक निर्माण मेसिनरी'),
        chapter('highway-10-6', 6, 'Road Construction Technology', 'सडक निर्माण प्रविधि'),
        chapter('highway-10-7', 7, 'Bridge', 'पुल'),
        chapter('highway-10-8', 8, 'Road Maintenance and Repair', 'सडक मर्मत तथा सम्भार'),
        chapter('highway-10-9', 9, 'Tracks and Trails', 'ट्र्याक तथा ट्रेल'),
      ]),
      unit('estimating-costing', 11, 'Estimating and Costing', 'इस्टिमेटिङ तथा कस्टिङ', 'calculator-outline', [
        chapter('estimating-11-1', 1, 'General', 'सामान्य'),
        chapter('estimating-11-2', 2, 'Rate Analysis', 'दर विश्लेषण'),
        chapter('estimating-11-3', 3, 'Specifications', 'स्पेसिफिकेसन'),
        chapter('estimating-11-4', 4, 'Valuation', 'मूल्याङ्कन'),
      ]),
      unit('construction-management', 12, 'Construction Management', 'निर्माण व्यवस्थापन', 'people-outline', [
        chapter('management-12-1', 1, 'Organization', 'सङ्गठन'),
        chapter('management-12-2', 2, 'Site Management', 'साइट व्यवस्थापन'),
        chapter('management-12-3', 3, 'Contract Procedure', 'ठेक्का प्रक्रिया'),
        chapter('management-12-4', 4, 'Accounts', 'लेखा'),
        chapter('management-12-5', 5, 'Planning and Control', 'योजना तथा नियन्त्रण'),
      ]),
      unit('airport-engineering', 13, 'Airport Engineering', 'एयरपोर्ट इन्जिनियरिङ', 'airplane-outline', [
        chapter('airport-13-1', 1, 'General', 'सामान्य'),
        chapter('airport-13-2', 2, 'Design', 'डिजाइन'),
        chapter('airport-13-3', 3, 'Airport Maintenance', 'एयरपोर्ट मर्मत तथा सम्भार'),
      ]),
    ],
  },
];

export function countLearningChapters(subject: LearningSubjectSeed): number {
  if (subject.hierarchy === 'direct-chapters') return subject.chapters?.length ?? 0;
  return (subject.units ?? []).reduce((total, currentUnit) => total + currentUnit.chapters.length, 0);
}

export function countLearningUnits(subject: LearningSubjectSeed): number {
  return subject.units?.length ?? 0;
}

export function countLearningQuestions(subject: LearningSubjectSeed): number {
  return 0;
}
