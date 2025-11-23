import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getAuthToken } from '../utils/authUtils';

const API_BASE_URL = 'https://ecb2b679741f.ngrok-free.app/api';

class AuthService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
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
      (response) => response,
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
      console.error('Error en login:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
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
      console.error('Error en registro:', error);
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
      console.error('Error actualizando perfil:', error);
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
      console.error('Error obteniendo perfil:', error);
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
      console.error('Error al obtener estado de solicitud:', error);
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
        console.log('✅ Token sincronizado a AsyncStorage');
      }
    } catch (error) {
      console.error('Error sincronizando token:', error);
    }
  }

  async syncTokenFromAsyncStorage() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        await SecureStore.setItemAsync('auth_token', token);
        console.log('✅ Token sincronizado a SecureStore');
      }
    } catch (error) {
      console.error('Error sincronizando token:', error);
    }
  }
}

export const authService = new AuthService();
