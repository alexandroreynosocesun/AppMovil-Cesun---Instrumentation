import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Obtener token de autenticación de forma segura
 * Prioriza SecureStore, fallback a AsyncStorage
 */
export const getAuthToken = async () => {
  try {
    // Intentar obtener token de SecureStore primero
    let token = await SecureStore.getItemAsync('auth_token');
    
    // Fallback a AsyncStorage si no está en SecureStore
    if (!token) {
      token = await AsyncStorage.getItem('token');
    }
    
    return token;
  } catch (error) {
    console.error('Error obteniendo token de autenticación:', error);
    return null;
  }
};

/**
 * Limpiar datos de autenticación de forma segura
 */
export const clearAuthData = async () => {
  try {
    // Limpiar SecureStore
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('user_signature');
    
    // Limpiar AsyncStorage por compatibilidad
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    
    console.log('✅ Datos de autenticación eliminados de forma segura');
  } catch (error) {
    console.error('Error limpiando datos de autenticación:', error);
  }
};





