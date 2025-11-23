import axios from 'axios';
import { getAuthToken } from '../utils/authUtils';
import { offlineService } from './OfflineService';

const API_BASE_URL = 'https://ecb2b679741f.ngrok-free.app/api';

class ValidationService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
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
      console.error('Error creando validación:', error);
      
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
      console.error('Error obteniendo validaciones:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
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
      console.error('Error sincronizando validaciones:', error);
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
      console.error('Error obteniendo reporte de turno:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }
}

export const validationService = new ValidationService();
