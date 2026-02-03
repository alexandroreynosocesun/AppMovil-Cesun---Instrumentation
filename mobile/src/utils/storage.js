import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { isWeb } from './platformUtils';
import logger from './logger';

/**
 * Módulo de almacenamiento unificado
 * Maneja automáticamente la diferencia entre web (AsyncStorage) y móvil (SecureStore)
 */
class StorageService {
  /**
   * Guardar un valor de forma segura
   * En web: AsyncStorage
   * En móvil: SecureStore
   */
  async setItem(key, value) {
    try {
      if (isWeb) {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`Error guardando ${key} en almacenamiento:`, error);
      return false;
    }
  }

  /**
   * Obtener un valor de forma segura
   * En web: AsyncStorage
   * En móvil: SecureStore, con fallback a AsyncStorage
   */
  async getItem(key) {
    try {
      if (isWeb) {
        return await AsyncStorage.getItem(key);
      } else {
        // En móvil intentar SecureStore primero
        let value = await SecureStore.getItemAsync(key);
        
        // Fallback a AsyncStorage si no está en SecureStore
        if (!value) {
          value = await AsyncStorage.getItem(key);
        }
        
        return value;
      }
    } catch (error) {
      logger.error(`Error obteniendo ${key} del almacenamiento:`, error);
      return null;
    }
  }

  /**
   * Eliminar un valor de forma segura
   * En web: AsyncStorage
   * En móvil: SecureStore y AsyncStorage (por compatibilidad)
   */
  async removeItem(key) {
    try {
      if (isWeb) {
        await AsyncStorage.removeItem(key);
      } else {
        // Eliminar de SecureStore
        await SecureStore.deleteItemAsync(key);
        // También eliminar de AsyncStorage por compatibilidad
        await AsyncStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      logger.error(`Error eliminando ${key} del almacenamiento:`, error);
      return false;
    }
  }

  /**
   * Guardar múltiples valores a la vez
   */
  async setMultiple(items) {
    try {
      if (isWeb) {
        await AsyncStorage.multiSet(Object.entries(items));
      } else {
        // En móvil usar SecureStore para cada item
        const promises = Object.entries(items).map(([key, value]) =>
          SecureStore.setItemAsync(key, value)
        );
        await Promise.all(promises);
        // También guardar en AsyncStorage por compatibilidad
        await AsyncStorage.multiSet(Object.entries(items));
      }
      return true;
    } catch (error) {
      logger.error('Error guardando múltiples valores:', error);
      return false;
    }
  }

  /**
   * Obtener múltiples valores a la vez
   */
  async getMultiple(keys) {
    try {
      if (isWeb) {
        const values = await AsyncStorage.multiGet(keys);
        return Object.fromEntries(values);
      } else {
        // En móvil intentar SecureStore primero
        const secureValues = await Promise.all(
          keys.map(async (key) => [key, await SecureStore.getItemAsync(key)])
        );
        
        // Buscar los que faltan en AsyncStorage
        const missing = secureValues
          .filter(([_, value]) => !value)
          .map(([key]) => key);
        
        if (missing.length > 0) {
          const asyncValues = await AsyncStorage.multiGet(missing);
          asyncValues.forEach(([key, value]) => {
            const index = secureValues.findIndex(([k]) => k === key);
            if (index !== -1) {
              secureValues[index][1] = value;
            }
          });
        }
        
        return Object.fromEntries(secureValues);
      }
    } catch (error) {
      logger.error('Error obteniendo múltiples valores:', error);
      return {};
    }
  }

  /**
   * Limpiar todo el almacenamiento
   */
  async clear() {
    try {
      if (isWeb) {
        await AsyncStorage.clear();
      } else {
        // En móvil, SecureStore no tiene método clear
        // Limpiar AsyncStorage como alternativa
        await AsyncStorage.clear();
        logger.warn('⚠️ SecureStore no tiene método clear. Se limpió AsyncStorage.');
      }
      return true;
    } catch (error) {
      logger.error('Error limpiando almacenamiento:', error);
      return false;
    }
  }
}

// Exportar instancia única
export const storage = new StorageService();

// Exportar métodos individuales para compatibilidad
export const setItem = (key, value) => storage.setItem(key, value);
export const getItem = (key) => storage.getItem(key);
export const removeItem = (key) => storage.removeItem(key);
export const setMultiple = (items) => storage.setMultiple(items);
export const getMultiple = (keys) => storage.getMultiple(keys);
export const clear = () => storage.clear();



