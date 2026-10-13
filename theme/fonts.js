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
import BigShouldersDisplay_800ExtraBold from '@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_800ExtraBold.ttf';

export const fontAssets = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
  BigShouldersDisplay_800ExtraBold,
};

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  labelMedium: 'WorkSans_500Medium',
  label: 'WorkSans_600SemiBold',
  number: 'WorkSans_700Bold',
  display: 'BigShouldersDisplay_800ExtraBold', // signage-style condensed display, titles only
};
