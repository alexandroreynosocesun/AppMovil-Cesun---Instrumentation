import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getAuthToken } from '../utils/authUtils';
import logger from '../utils/logger';
import { API_BASE_URL } from '../utils/apiClient';

// Re-exportar API_BASE_URL para compatibilidad con código que lo importa desde aquí
export { API_BASE_URL };

class AuthService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 30000, // Aumentado a 30 segundos para conexiones lentas
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar token a las peticiones
    this.api.interceptors.request.use(
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

    // Interceptor para manejar respuestas
    this.api.interceptors.response.use(
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
        if (error.response?.status === 401) {
          // Token expirado, limpiar storage seguro
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('user_data');
          await SecureStore.deleteItemAsync('user_signature');
          
          // Limpiar también AsyncStorage por compatibilidad
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
        }
        return Promise.reject(error);
      }
    );
  }

  async login(usuario, password) {
    try {
      const url = `${API_BASE_URL}/api/auth/login`;
      logger.info(`🔐 Intentando login en: ${url}`);

      const response = await this.api.post('/auth/login', {
        usuario,
        password
      });

      logger.info('✅ Login exitoso');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ Error en login:', error);
      logger.error('❌ URL completa:', `${API_BASE_URL}/api/auth/login`);
      logger.error('❌ Status:', error.response?.status);
      logger.error('❌ Status Text:', error.response?.statusText);
      logger.error('❌ Response Data:', error.response?.data);
      logger.error('❌ Error Code:', error.code);
      logger.error('❌ Error Message:', error.message);
      
      // Manejo específico de 401 (credenciales incorrectas)
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Usuario o contraseña incorrectos. Por favor, verifica tus credenciales e intenta nuevamente.'
        };
      }
      
      // Manejo específico de 404
      if (error.response?.status === 404) {
        return {
          success: false,
          error: `Endpoint no encontrado (404). Verifica que:\n1. El backend esté ejecutándose en http://localhost:8000\n2. Ngrok esté activo y apuntando al puerto 8000\n3. La URL base sea correcta: ${API_BASE_URL}\n4. La ruta /api/auth/login exista en el backend`
        };
      }
      
      // Manejo específico de timeout
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'El servidor tardó demasiado en responder. Verifica tu conexión a internet e intenta nuevamente.'
        };
      }
      
      // Manejo de errores de conexión (ERR_NETWORK, ECONNREFUSED, etc.)
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.message === 'Network Error') {
        return {
          success: false,
          error: 'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.'
        };
      }
      
      // Para otros errores, devolver mensaje genérico amigable
      return {
        success: false,
        error: 'Error al iniciar sesión. Por favor, intenta nuevamente.'
      };
    }
  }

  async register(registerData) {
    try {
      const response = await this.api.post('/auth/register', registerData);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error en registro:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async updateProfile(updateData) {
    try {
      const response = await this.api.put('/auth/me', updateData);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error actualizando perfil:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getProfile() {
    try {
      const response = await this.api.get('/auth/me');

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo perfil:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getSolicitudStatus(usuario) {
    try {
      const response = await this.api.get(`/auth/solicitud/${usuario}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al obtener estado de solicitud:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getUsersForLogin() {
    try {
      // Este endpoint es público, no necesita token, crear instancia sin interceptores
      const url = `${API_BASE_URL}/api/auth/users-for-login`;
      logger.info(`🔍 [getUsersForLogin] Intentando obtener usuarios desde: ${url}`);

      const publicAxios = axios.create({
        baseURL: API_BASE_URL,
        timeout: 10000,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
        },
      });

      const response = await publicAxios.get('/api/auth/users-for-login');
      
      // Verificar Content-Type de la respuesta
      const contentType = response.headers['content-type'] || '';
      logger.info(`📋 [getUsersForLogin] Content-Type recibido: ${contentType}`);
      
      // Verificar si la respuesta es HTML (significa que ngrok está apuntando a Expo, no al backend)
      const responseData = response.data;
      const isHTML = typeof responseData === 'string' && (
        responseData.trim().startsWith('<!DOCTYPE') || 
        responseData.trim().startsWith('<html') ||
        responseData.includes('<title>Hisense CheckApp') ||
        !contentType.includes('application/json')
      );
      
      if (isHTML) {
        logger.error('❌ [getUsersForLogin] La URL está apuntando a la página HTML de Expo, no al backend');
        logger.error('❌ [getUsersForLogin] Verifica que ngrok esté apuntando al puerto 8000 del backend');
        logger.error('❌ [getUsersForLogin] URL actual:', url);
        logger.error('❌ [getUsersForLogin] Content-Type recibido:', contentType);
        return {
          success: false,
          error: 'La URL del API está apuntando a la aplicación web de Expo en lugar del backend. Verifica que ngrok esté configurado correctamente y apuntando al puerto 8000 del backend.',
          data: { users: [], total: 0 }
        };
      }
      
      logger.info(`✅ [getUsersForLogin] Usuarios obtenidos exitosamente:`, responseData);
      return {
        success: true,
        data: responseData
      };
    } catch (error) {
      logger.error('❌ [getUsersForLogin] Error obteniendo usuarios para login:', error);
      logger.error('❌ [getUsersForLogin] Status:', error.response?.status);
      logger.error('❌ [getUsersForLogin] Status Text:', error.response?.statusText);
      logger.error('❌ [getUsersForLogin] Response Data:', error.response?.data);
      logger.error('❌ [getUsersForLogin] Error Code:', error.code);
      logger.error('❌ [getUsersForLogin] Error Message:', error.message);
      logger.error('❌ [getUsersForLogin] URL completa:', `${API_BASE_URL}/api/auth/users-for-login`);
      
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Error de conexión',
        data: { users: [], total: 0 }
      };
    }
  }

  // Métodos para sincronizar token entre SecureStore y AsyncStorage
  async syncTokenToAsyncStorage() {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        await AsyncStorage.setItem('token', token);
        logger.info('✅ Token sincronizado a AsyncStorage');
      }
    } catch (error) {
      logger.error('Error sincronizando token:', error);
    }
  }

  async syncTokenFromAsyncStorage() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        await SecureStore.setItemAsync('auth_token', token);
        logger.info('✅ Token sincronizado a SecureStore');
      }
    } catch (error) {
      logger.error('Error sincronizando token:', error);
    }
  }

  // Función para probar la conexión con el backend
  async testConnection() {
    try {
      logger.info(`🔍 Probando conexión con: ${API_BASE_URL}`);
      
      // Probar endpoint raíz
      const rootResponse = await this.api.get('/');
      logger.info('✅ Endpoint raíz responde:', rootResponse.data);
      
      // Probar health check
      try {
        const healthResponse = await this.api.get('/health');
        logger.info('✅ Health check responde:', healthResponse.data);
      } catch (healthError) {
        logger.warn('⚠️ Health check no disponible:', healthError.message);
      }
      
      return {
        success: true,
        message: 'Conexión exitosa con el backend',
        baseURL: API_BASE_URL
      };
    } catch (error) {
      logger.error('❌ Error probando conexión:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Error de conexión',
        baseURL: API_BASE_URL,
        status: error.response?.status,
        statusText: error.response?.statusText
      };
    }
  }
}

export const authService = new AuthService();
