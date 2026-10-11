/**
 * @module i18n
 * Initializes the shared i18next instance for React with the Spanish and English resources and the
 * detected device language (Spanish fallback). Imported once for its side effect by `App.js`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LANGUAGE, detectDeviceLanguage } from './deviceLanguage.js';
import en from './locales/en.json';
import es from './locales/es.json';

i18n.use(initReactI18next).init({
  lng: detectDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  interpolation: {
    escapeValue: false,
  },
});

/** @type {import('i18next').i18n} Configured instance; components translate through `useTranslation()`. */
export default i18n;
