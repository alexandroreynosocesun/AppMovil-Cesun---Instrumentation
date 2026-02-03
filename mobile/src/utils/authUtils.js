import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';
import logger from './logger';

/**
 * Obtener token de autenticación de forma segura
 * Usa el módulo de storage unificado que maneja web/móvil automáticamente
 */
export const getAuthToken = async () => {
  try {
    // Intentar obtener desde storage principal
    let token = await storage.getItem('auth_token');
    
    // Fallback a AsyncStorage para compatibilidad
    if (!token) {
      token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('auth_token');
    }
    
    if (token) {
      logger.debug('✅ Token obtenido correctamente');
    } else {
      // Solo loguear como debug, no como warning, porque es normal si el usuario no está logueado
      logger.debug('ℹ️ No se encontró token en storage (usuario no autenticado)');
    }
    
    return token;
  } catch (error) {
    logger.error('Error obteniendo token de autenticación:', error);
    return null;
  }
};

/**
 * Guardar token de autenticación de forma segura
 * Usa el módulo de storage unificado
 */
export const saveAuthToken = async (token) => {
  try {
    // Guardar en storage principal (SecureStore en móvil, AsyncStorage en web)
    await storage.setItem('auth_token', token);
    
    // También guardar en AsyncStorage para compatibilidad
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('auth_token', token);
    
    return true;
  } catch (error) {
    logger.error('Error guardando token de autenticación:', error);
    return false;
  }
};

/**
 * Limpiar datos de autenticación de forma segura
 * Usa el módulo de storage unificado
 */
export const clearAuthData = async () => {
  try {
    // Limpiar desde storage principal
    await storage.removeItem('auth_token');
    await storage.removeItem('user_data');
    await storage.removeItem('user_signature');
    
    // También limpiar AsyncStorage por compatibilidad
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('user_data');
    
    logger.info('✅ Datos de autenticación eliminados de forma segura');
  } catch (error) {
    logger.error('Error limpiando datos de autenticación:', error);
  }
};






