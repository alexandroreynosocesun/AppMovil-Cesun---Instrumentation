import logger from '../utils/logger';
import { apiClient } from '../utils/apiClient';

class JigService {
  constructor() {
    // Usar instancia compartida de axios con interceptor de refresh token
    this.api = apiClient;
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

  async getAllJigs(params = {}) {
    try {
      const response = await this.api.get('/jigs/', { params });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Error obteniendo jigs:', error);
      
      // Manejar diferentes tipos de errores
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        };
      } else if (error.response?.status === 500) {
        return {
          success: false,
          error: 'SERVER_ERROR',
          message: 'Error del servidor. Por favor, intenta nuevamente en unos momentos.',
        };
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Sin conexión a internet. Verifica tu conexión e intenta nuevamente.',
        };
      } else {
        return {
          success: false,
          error: 'UNKNOWN_ERROR',
          message: error.response?.data?.detail || 'Error inesperado. Por favor, intenta nuevamente.',
        };
      }
    }
  }

  async searchJigs(query, page = 1, pageSize = 1500) {
    try {
      const response = await this.api.get('/jigs/', {
        params: {
          search: query,
          page,
          page_size: pageSize,
        },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Error buscando jigs:', error);
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        };
      } else if (error.response?.status === 500) {
        return {
          success: false,
          error: 'SERVER_ERROR',
          message: 'Error del servidor. Por favor, intenta nuevamente en unos momentos.',
        };
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Sin conexión a internet. Verifica tu conexión e intenta nuevamente.',
        };
      }
      return {
        success: false,
        error: 'UNKNOWN_ERROR',
        message: error.response?.data?.detail || 'Error inesperado. Por favor, intenta nuevamente.',
      };
    }
  }

  /**
   * Obtener jigs para el autocompletado en formularios (por ejemplo, reporte de etiqueta NG)
   * Devuelve directamente el array de jigs (items) sin la metadata de paginación.
   */
  async getJigsForAutocomplete() {
    try {
      const response = await this.api.get('/jigs/', {
        params: {
          page: 1,
          // El backend valida que page_size sea <= 100, así que usamos el máximo permitido
          page_size: 100,
        },
      });

      const data = response.data;
      let items = [];

      if (Array.isArray(data?.items)) {
        items = data.items;
      } else if (Array.isArray(data)) {
        items = data;
      }

      return {
        success: true,
        data: items,
      };
    } catch (error) {
      logger.error('Error obteniendo jigs para autocompletado:', error);

      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        };
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Sin conexión a internet. Verifica tu conexión e intenta nuevamente.',
        };
      }

      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
      };
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

  // Eliminar todos los jigs
  async deleteAllJigs() {
    try {
      logger.info('🗑️ Eliminando todos los jigs...');
      
      const response = await this.api.delete('/jigs/all');
      
      logger.info('✅ Todos los jigs eliminados exitosamente');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ Error al eliminar todos los jigs:', error);
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED'
        };
      }
      
      if (error.response?.status === 403) {
        return {
          success: false,
          error: 'FORBIDDEN',
          message: 'Solo administradores e ingenieros pueden eliminar todos los jigs'
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

  // Eliminar TODOS los jigs (solo para admin - TEMPORAL)
  async deleteAllJigs() {
    try {
      logger.info('⚠️ Eliminando TODOS los jigs...');
      
      const response = await this.api.delete('/jigs/all');
      
      logger.info('✅ Todos los jigs eliminados exitosamente');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ Error al eliminar todos los jigs:', error);
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        };
      }
      
      if (error.response?.status === 403) {
        return {
          success: false,
          error: 'FORBIDDEN',
          message: 'Solo administradores pueden eliminar todos los jigs.'
        };
      }
      
      if (error.response?.status === 500) {
        return {
          success: false,
          error: 'SERVER_ERROR',
          message: 'Error del servidor. Por favor, intenta nuevamente.'
        };
      }
      
      if (error.code === 'NETWORK_ERROR' || !error.response) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Sin conexión a internet. Verifica tu conexión e intenta nuevamente.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error inesperado al eliminar jigs'
      };
    }
  }

  async getModelos() {
    try {
      logger.info('📋 Obteniendo modelos disponibles...');
      const response = await this.api.get('/jigs/modelos');
      logger.info('✅ Modelos obtenidos exitosamente:', response.data.length);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ Error obteniendo modelos:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getModelosConTipos() {
    try {
      logger.info('📋 Obteniendo modelos con tipos disponibles...');
      const response = await this.api.get('/jigs/modelos-con-tipos');
      logger.info('✅ Modelos con tipos obtenidos exitosamente');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ Error obteniendo modelos con tipos:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }
}

export const jigService = new JigService();

