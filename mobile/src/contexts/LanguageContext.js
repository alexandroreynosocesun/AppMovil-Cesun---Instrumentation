import React, { createContext, useState, useContext, useEffect } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('es');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage && (savedLanguage === 'es' || savedLanguage === 'en')) {
        setLanguage(savedLanguage);
      } else {
        // Si no hay idioma guardado, intentar detectar del dispositivo
        try {
          const deviceLanguage = Localization.locale?.split('-')[0] || 'es';
          const lang = translations[deviceLanguage] ? deviceLanguage : 'es';
          setLanguage(lang);
        } catch (localizationError) {
          // Si expo-localization no está disponible, usar español por defecto
          setLanguage('es');
        }
      }
    } catch (error) {
      console.error('Error loading language:', error);
      setLanguage('es'); // Default a español si hay error
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = async (lang) => {
    if (lang !== 'es' && lang !== 'en') {
      console.warn('Invalid language:', lang);
      return;
    }
    
    try {
      await AsyncStorage.setItem('app_language', lang);
      setLanguage(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key, params = {}) => {
    let text = translations[language]?.[key] || key;
    
    // Reemplazar parámetros si existen (ej: {type} -> "Face ID")
    if (params && Object.keys(params).length > 0) {
      Object.keys(params).forEach(param => {
        text = text.replace(`{${param}}`, params[param]);
      });
    }
    
    return text;
  };

  const hasLanguagePreference = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      return savedLanguage !== null;
    } catch (error) {
      return false;
    }
  };

  return (
    <LanguageContext.Provider 
      value={{ 
        language, 
        changeLanguage, 
        t, 
        translations: translations[language] || translations.es,
        isLoading,
        hasLanguagePreference
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
