/**
 * @module theme/fonts
 * Font assets and family names. `fontAssets` is passed to `useFonts` in App.js; web test fixtures register
 * the same family names via @font-face.
 */
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { WorkSans_500Medium } from '@expo-google-fonts/work-sans/500Medium';
import { WorkSans_600SemiBold } from '@expo-google-fonts/work-sans/600SemiBold';
import { WorkSans_700Bold } from '@expo-google-fonts/work-sans/700Bold';
import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';

export const fontAssets = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
};

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  labelMedium: 'WorkSans_500Medium',
  label: 'WorkSans_600SemiBold',
  number: 'WorkSans_700Bold',
  display: 'Fredoka_600SemiBold', // friendly rounded display: titles
  displayMedium: 'Fredoka_500Medium', // friendly rounded display: key buttons
};
