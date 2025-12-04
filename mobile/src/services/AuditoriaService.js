import axios from 'axios';
import { getAuthToken } from '../utils/authUtils';
import { API_BASE_URL } from './AuthService';
import logger from '../utils/logger';

class AuditoriaService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
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
          logger.info('🔑 Token agregado a la petición:', token.substring(0, 20) + '...');
        } else {
          logger.warn('⚠️ No hay token disponible para la petición');
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor de respuesta para manejar errores 401
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          logger.error('❌ Error 401 (No autorizado):', {
            url: error.config?.url,
            message: error.response?.data?.detail || error.message
          });
          // El error se propagará y será manejado en cada método
        }
        return Promise.reject(error);
      }
    );
  }

  // Obtener PDFs de auditoría con filtros opcionales
  async getAuditoriaPDFs(filters = {}) {
    try {
      const params = {};
      if (filters.dia) params.dia = filters.dia;
      if (filters.mes) params.mes = filters.mes;
      if (filters.anio) params.anio = filters.anio;
      if (filters.turno) params.turno = filters.turno;
      if (filters.linea) params.linea = filters.linea;

      logger.info('📥 Obteniendo PDFs de auditoría con filtros:', params);
      const response = await this.api.get('/auditoria/', { params });
      
      // Manejar respuesta paginada o array directo
      let pdfsData = response.data;
      if (response.data?.items && Array.isArray(response.data.items)) {
        pdfsData = response.data.items;
        logger.info('✅ PDFs obtenidos (paginados):', pdfsData.length, 'de', response.data.total);
      } else if (Array.isArray(response.data)) {
        pdfsData = response.data;
        logger.info('✅ PDFs obtenidos (array directo):', pdfsData.length);
      }
      
      return {
        success: true,
        data: pdfsData
      };
    } catch (error) {
      logger.error('Error obteniendo PDFs de auditoría:', error);
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Sesión expirada. Por favor, inicia sesión nuevamente.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al obtener PDFs de auditoría'
      };
    }
  }

  // Descargar un PDF de auditoría
  async downloadPDF(pdfId) {
    try {
      const response = await this.api.get(`/auditoria/download/${pdfId}`, {
        responseType: 'blob'
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error descargando PDF:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al descargar PDF'
      };
    }
  }

  // Obtener estadísticas de auditoría
  async getStats() {
    try {
      logger.info('📊 Obteniendo estadísticas de auditoría...');
      const response = await this.api.get('/auditoria/stats');
      logger.info('✅ Estadísticas obtenidas exitosamente');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      
      if (error.response?.status === 401) {
        logger.warn('⚠️ Error 401 al obtener estadísticas - Sesión expirada');
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Sesión expirada. Por favor, inicia sesión nuevamente.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al obtener estadísticas'
      };
    }
  }

  // Eliminar un PDF de auditoría (solo adminAlex)
  async deletePDF(pdfId) {
    try {
      const response = await this.api.delete(`/auditoria/${pdfId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error eliminando PDF:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al eliminar PDF'
      };
    }
  }

  // Obtener estado del almacenamiento (solo adminAlex)
  async getStorageStatus() {
    try {
      const response = await this.api.get('/storage/status');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo estado de almacenamiento:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al obtener estado'
      };
    }
  }

  // Limpiar PDFs antiguos (solo adminAlex)
  async cleanupPDFs(days = 365) {
    try {
      const response = await this.api.post(`/storage/cleanup?days=${days}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error limpiando PDFs:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al limpiar PDFs'
      };
    }
  }

  // Comprimir PDFs antiguos (solo adminAlex)
  async compressPDFs(days = 180) {
    try {
      const response = await this.api.post(`/storage/compress?days=${days}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error comprimiendo PDFs:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al comprimir PDFs'
      };
    }
  }

  // Obtener uso del disco (solo adminAlex)
  async getDiskUsage() {
    try {
      const response = await this.api.get('/storage/disk-usage');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo uso del disco:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión',
        message: error.response?.data?.detail || 'Error al obtener uso del disco'
      };
    }
  }
}

export default new AuditoriaService();

