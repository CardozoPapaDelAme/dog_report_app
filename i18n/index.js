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

export default i18n;
