import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { isWeb } from './platformUtils';
import logger from './logger';

/**
 * Obtener token de autenticación de forma segura
 * En web usa AsyncStorage, en móvil prioriza SecureStore
 */
export const getAuthToken = async () => {
  try {
    if (isWeb) {
      // En web usar AsyncStorage directamente
      return await AsyncStorage.getItem('auth_token') || await AsyncStorage.getItem('token');
    } else {
      // En móvil intentar SecureStore primero, luego AsyncStorage
      let token = await SecureStore.getItemAsync('auth_token');
      
      // Fallback a AsyncStorage si no está en SecureStore
      if (!token) {
        token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('auth_token');
      }
      
      return token;
    }
  } catch (error) {
    logger.error('Error obteniendo token de autenticación:', error);
    return null;
  }
};

/**
 * Guardar token de autenticación de forma segura
 * En web usa AsyncStorage, en móvil usa SecureStore
 */
export const saveAuthToken = async (token) => {
  try {
    if (isWeb) {
      // En web usar AsyncStorage
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('token', token); // Compatibilidad
    } else {
      // En móvil usar SecureStore
      await SecureStore.setItemAsync('auth_token', token);
      // También guardar en AsyncStorage por compatibilidad
      await AsyncStorage.setItem('token', token);
    }
    return true;
  } catch (error) {
    logger.error('Error guardando token de autenticación:', error);
    return false;
  }
};

/**
 * Limpiar datos de autenticación de forma segura
 */
export const clearAuthData = async () => {
  try {
    if (isWeb) {
      // En web solo limpiar AsyncStorage
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user_data');
      await AsyncStorage.removeItem('user');
    } else {
      // En móvil limpiar SecureStore y AsyncStorage
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_data');
      await SecureStore.deleteItemAsync('user_signature');
      
      // Limpiar AsyncStorage por compatibilidad
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('user_data');
    }
    
    logger.info('✅ Datos de autenticación eliminados de forma segura');
  } catch (error) {
    logger.error('Error limpiando datos de autenticación:', error);
  }
};






