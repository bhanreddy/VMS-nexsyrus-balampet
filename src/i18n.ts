import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './Locale/en.json';
import te from './Locale/te.json';

import AsyncStorage from '@react-native-async-storage/async-storage';

const MODULE_ID = 'appLanguage';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(MODULE_ID);
      if (savedLanguage) {
        return callback(savedLanguage);
      }
      return callback('en');
    } catch (error) {

      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(MODULE_ID, language);
    } catch (error) {

    }
  }
};

i18n.
use(languageDetector as any).
use(initReactI18next).
init({
  resources: {
    en: { translation: en },
    te: { translation: te }
  },
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
});

export default i18n;