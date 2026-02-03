import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getAuthToken } from './authUtils';
import { storage } from './storage';
import logger from './logger';

// URL base del API - desde variable de entorno
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Variables para evitar loops de refresh
let isRefreshing = false;
let failedQueue = [];

// Log la URL base al cargar el módulo
logger.info(`🌐 API Base URL configurada para ${Platform.OS}: ${API_BASE_URL}`);

/**
 * Instancia compartida de axios con interceptor de refresh token
 * Todos los servicios deben usar esta instancia para manejar automáticamente
 * la renovación de tokens cuando expiren
 */
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a las peticiones
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y refresh token
apiClient.interceptors.response.use(
  (response) => {
    // Si la respuesta viene como string, intentar parsearla como JSON
    if (typeof response.data === 'string') {
      // Si es HTML, es un error de configuración de URL
      if (response.data.trim().startsWith('<!DOCTYPE') || response.data.trim().startsWith('<html')) {
        logger.error('❌ Error: La URL del API está apuntando a una página HTML (probablemente Expo). Verifica que ngrok esté apuntando al puerto 8000 del backend.');
        throw new Error('URL del API incorrecta. Ejecuta start_all.ps1 para configurar correctamente.');
      }
      
      try {
        response.data = JSON.parse(response.data);
      } catch (parseError) {
        logger.error('Error parseando respuesta JSON:', parseError);
        throw new Error('Error procesando respuesta del servidor');
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Si es error 401 y no es una petición de refresh ni ya se intentó refrescar
    if (error.response?.status === 401 && 
        !originalRequest._retry && 
        !originalRequest.url?.includes('/auth/refresh')) {
      
      originalRequest._retry = true;
      
      // Si ya se está refrescando, esperar a que termine
      if (isRefreshing) {
        return new Promise((resolve) => {
          failedQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }
      
      isRefreshing = true;
      
      try {
        // Intentar refrescar el token
        const refreshResult = await refreshAccessToken();
        
        if (refreshResult.success) {
          // Procesar cola de peticiones fallidas
          failedQueue.forEach((prom) => prom(refreshResult.access_token));
          failedQueue = [];
          
          // Reintentar petición original con nuevo token
          originalRequest.headers.Authorization = `Bearer ${refreshResult.access_token}`;
          isRefreshing = false;
          return apiClient(originalRequest);
        } else {
          // Refresh token expirado - limpiar y rechazar
          failedQueue = [];
          isRefreshing = false;
          
          try {
            await storage.removeItem('auth_token');
            await storage.removeItem('refresh_token');
            await storage.removeItem('user_data');
            await storage.removeItem('user_signature');
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('refresh_token');
            await AsyncStorage.removeItem('user');
          } catch (cleanupError) {
            logger.error('Error limpiando storage en interceptor 401:', cleanupError);
          }
        }
      } catch (refreshError) {
        failedQueue = [];
        isRefreshing = false;
        logger.error('Error en proceso de refresh:', refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Función para refrescar el access token usando el refresh token
 */
async function refreshAccessToken() {
  try {
    const refreshToken = await storage.getItem('refresh_token');
    if (!refreshToken) {
      logger.warn('⚠️ No hay refresh token disponible');
      return { success: false, error: 'No hay refresh token disponible' };
    }
    
    logger.info('🔄 Intentando refrescar access token...');
    
    // Usar axios directamente sin interceptor para evitar loops
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken
    }, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });
    
    const newAccessToken = response.data.access_token;
    if (!newAccessToken) {
      logger.error('❌ No se recibió access token en la respuesta');
      return { success: false, error: 'Error al renovar token' };
    }
    
    // Guardar nuevo access token
    await storage.setItem('auth_token', newAccessToken);
    await AsyncStorage.setItem('token', newAccessToken);
    await AsyncStorage.setItem('auth_token', newAccessToken);
    
    logger.info('✅ Access token refrescado correctamente');
    
    return { 
      success: true, 
      access_token: newAccessToken 
    };
  } catch (error) {
    logger.error('❌ Error refrescando token:', error);
    
    if (error.response?.status === 401) {
      return { 
        success: false, 
        error: 'Refresh token expirado. Por favor, inicia sesión nuevamente.' 
      };
    }
    
    return { 
      success: false, 
      error: error.response?.data?.detail || error.message || 'Error al refrescar token' 
    };
  }
}

export default apiClient;


