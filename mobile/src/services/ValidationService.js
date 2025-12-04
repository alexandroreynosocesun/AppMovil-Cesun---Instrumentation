import axios from 'axios';
import { getAuthToken } from '../utils/authUtils';
import { offlineService } from './OfflineService';
import logger from '../utils/logger';

const API_BASE_URL = 'https://0a0075381ed5.ngrok-free.app/api';

class ValidationService {
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

  async createValidation(validationData) {
    try {
      const response = await this.api.post('/validations/', validationData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creando validación:', error);
      
      // Si hay error de conexión, guardar offline
      if (!error.response) {
        await offlineService.saveValidationOffline(validationData);
        return {
          success: true,
          data: { ...validationData, sincronizado: false },
          offline: true
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getValidations(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await this.api.get(`/validations/?${params.toString()}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo validaciones:', error);
      
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
      }
      
      return {
        success: false,
        error: error.response?.status || 'UNKNOWN_ERROR',
        message: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async syncPendingValidations() {
    try {
      const response = await this.api.get('/validations/sync-pending');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error sincronizando validaciones:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getTurnReport(turno, fecha) {
    try {
      const params = new URLSearchParams({ turno });
      if (fecha) {
        params.append('fecha', fecha);
      }

      const response = await this.api.get(`/validations/reports/turno/${turno}?${params.toString()}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo reporte de turno:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async asignarValidacion(validationId, numeroEmpleado) {
    try {
      const response = await this.api.post(`/validations/asignar`, {
        validation_id: validationId,
        numero_empleado: numeroEmpleado
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error asignando validación:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error asignando validación'
      };
    }
  }

  async marcarCompletada(validationId) {
    try {
      const response = await this.api.put(`/validations/${validationId}/completar`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error marcando validación como completada:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error marcando validación como completada'
      };
    }
  }
}

export const validationService = new ValidationService();

