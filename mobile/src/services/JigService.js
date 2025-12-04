import axios from 'axios';
import { getAuthToken } from '../utils/authUtils';
import logger from '../utils/logger';

const API_BASE_URL = 'https://0a0075381ed5.ngrok-free.app/api';

class JigService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // Aumentado a 30 segundos
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar token
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
  }

  async getJigByQR(codigoQR) {
    try {
      const response = await this.api.get(`/jigs/qr/${codigoQR}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      // Solo loguear como error si no es un 404 (que es parte del flujo normal)
      if (error.response?.status !== 404) {
        logger.error('Error obteniendo jig por QR:', error);
      } else {
        logger.info('🔍 Jig no encontrado (404) - Flujo normal');
      }
      
      logger.info('🔍 Status code:', error.response?.status);
      logger.info('🔍 Error response:', error.response?.data);
      
      // Manejar diferentes tipos de errores
      if (error.response?.status === 404) {
        logger.info('🔍 Detectado error 404 - Jig no encontrado');
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'El código QR escaneado no corresponde a un jig registrado en el sistema.'
        };
      } else if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        };
      } else if (error.response?.status === 500) {
        return {
          success: false,
          error: 'SERVER_ERROR',
          message: 'Error del servidor. Por favor, intenta nuevamente en unos momentos.'
        };
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Sin conexión a internet. Verifica tu conexión e intenta nuevamente.'
        };
      } else {
        return {
          success: false,
          error: 'UNKNOWN_ERROR',
          message: error.response?.data?.detail || 'Error inesperado. Por favor, intenta nuevamente.'
        };
      }
    }
  }

  async getAllJigs() {
    try {
      const response = await this.api.get('/jigs/');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo jigs:', error);
      
      // Manejar diferentes tipos de errores
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        };
      } else if (error.response?.status === 500) {
        return {
          success: false,
          error: 'SERVER_ERROR',
          message: 'Error del servidor. Por favor, intenta nuevamente en unos momentos.'
        };
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Sin conexión a internet. Verifica tu conexión e intenta nuevamente.'
        };
      } else {
        return {
          success: false,
          error: 'UNKNOWN_ERROR',
          message: error.response?.data?.detail || 'Error inesperado. Por favor, intenta nuevamente.'
        };
      }
    }
  }

  async getJigById(jigId) {
    try {
      const response = await this.api.get(`/jigs/${jigId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo jig por ID:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async createJig(jigData) {
    try {
      const response = await this.api.post('/jigs/', jigData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creando jig:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // Eliminar jig
  async deleteJig(jigId) {
    try {
      logger.info('🗑️ Eliminando jig con ID:', jigId);
      
      const response = await this.api.delete(`/jigs/${jigId}`);
      
      logger.info('✅ Jig eliminado exitosamente');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ Error al eliminar jig:', error);
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED'
        };
      }
      
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'NOT_FOUND'
        };
      }
      
      if (error.response?.status === 500) {
        return {
          success: false,
          error: 'SERVER_ERROR'
        };
      }
      
      if (error.code === 'NETWORK_ERROR' || !error.response) {
        return {
          success: false,
          error: 'NETWORK_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }
}

export const jigService = new JigService();

