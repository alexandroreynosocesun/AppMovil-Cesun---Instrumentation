import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getAuthToken } from '../utils/authUtils';
import logger from '../utils/logger';

export const API_BASE_URL = 'https://0a0075381ed5.ngrok-free.app/api';

class AuthService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
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
      const response = await this.api.post('/auth/login', {
        usuario,
        password
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error en login:', error);
      
      // Manejo específico de timeout
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Timeout: El servidor tardó demasiado en responder. Verifica tu conexión a internet y que el backend esté funcionando.'
        };
      }
      
      // Manejo de errores de conexión
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Error de conexión: No se pudo conectar al servidor. Verifica que el backend esté ejecutándose y que ngrok esté activo.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Error de conexión'
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
}

export const authService = new AuthService();

