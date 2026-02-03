import logger from '../utils/logger';
import { apiClient } from '../utils/apiClient';

class JigNGService {
  constructor() {
    // Usar instancia compartida de axios con interceptor de refresh token
    this.api = apiClient;
  }

  // Crear nuevo jig NG
  async createJigNG(jigNGData) {
    try {
      const response = await this.api.post('/jigs-ng/', jigNGData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creando jig NG:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // Obtener lista de jigs NG
  async getJigsNG(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
          const joined = value.filter(Boolean).join(',');
          if (joined) {
            params.append(key, joined);
          }
          return;
        }
        params.append(key, value);
      });

      const response = await this.api.get(`/jigs-ng/?${params.toString()}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo jigs NG:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // Obtener todos los jigs NG (alias para getJigsNG)
  async getAllJigsNG() {
    return this.getJigsNG();
  }

  // Obtener jigs NG por ID de jig
  async getJigsNGByJigId(jigId) {
    try {
      const response = await this.api.get(`/jigs-ng/jig/${jigId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo jigs NG por jig ID:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // Obtener jig NG por ID
  async getJigNGById(jigNGId) {
    try {
      const response = await this.api.get(`/jigs-ng/${jigNGId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo jig NG por ID:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // Actualizar jig NG (marcar como reparado, etc.)
  async updateJigNG(jigNGId, updateData) {
    try {
      const response = await this.api.put(`/jigs-ng/${jigNGId}`, updateData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error actualizando jig NG:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // Eliminar jig NG
  async deleteJigNG(jigNGId) {
    try {
      const response = await this.api.delete(`/jigs-ng/${jigNGId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error eliminando jig NG:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // Obtener estadísticas de jigs NG
  async getNGStats() {
    try {
      logger.info('Obteniendo estadísticas NG...');
      const response = await this.api.get('/jigs-ng/stats/summary');
      logger.info('Estadísticas NG obtenidas exitosamente');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas NG:', error);
      
      // Manejo específico de timeout
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Tiempo de espera agotado. Verifica tu conexión a internet.'
        };
      }
      
      // Manejo de errores de red
      if (error.message?.includes('Network Error')) {
        return {
          success: false,
          error: 'Error de red. Verifica tu conexión a internet.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Error de conexión'
      };
    }
  }

  // Verificar si un jig tiene NG activo
  async checkJigNGStatus(jigId) {
    try {
      const result = await this.getJigsNGByJigId(jigId);
      if (result.success) {
        const activeNG = result.data.find(ng => 
          ng.estado === 'pendiente' || ng.estado === 'en_reparacion'
        );
        return {
          success: true,
          hasActiveNG: !!activeNG,
          jigNG: activeNG
        };
      }
      return result;
    } catch (error) {
      logger.error('Error verificando estado NG:', error);
      return {
        success: false,
        error: error.message || 'Error de conexión'
      };
    }
  }
}

export const jigNGService = new JigNGService();

