import { useFonts } from 'expo-font';

export const constitutionFontMap = {
  'Alkatra-Regular': require('../../../assets/fonts/Alkatra-Regular.ttf'),
  'Alkatra-Medium': require('../../../assets/fonts/Alkatra-Medium.ttf'),
  'Alkatra-SemiBold': require('../../../assets/fonts/Alkatra-SemiBold.ttf'),
  'Alkatra-Bold': require('../../../assets/fonts/Alkatra-Bold.ttf'),
};

export type ConstitutionFontWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

export function useConstitutionFonts(): boolean {
  const [loaded] = useFonts(constitutionFontMap);
  return loaded;
}

export function constitutionFontFamily(weight: ConstitutionFontWeight): string {
  switch (weight) {
    case 'bold':
      return 'Alkatra-Bold';
    case 'semiBold':
      return 'Alkatra-SemiBold';
    case 'medium':
      return 'Alkatra-Medium';
    default:
      return 'Alkatra-Regular';
  }
}
