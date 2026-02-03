import logger from '../utils/logger';
import { apiClient, API_BASE_URL } from '../utils/apiClient';

class AuditoriaService {
  constructor() {
    // Usar instancia compartida de axios con interceptor de refresh token
    this.api = apiClient;
  }

  // Obtener PDFs de auditoría con filtros opcionales
  // Carga todas las páginas automáticamente
  async getAuditoriaPDFs(filters = {}, loadAllPages = true) {
    try {
      const params = {};
      if (filters.dia) params.dia = filters.dia;
      if (filters.mes) params.mes = filters.mes;
      if (filters.anio) params.anio = filters.anio;
      if (filters.turno) params.turno = filters.turno;
      if (filters.tecnico_id) params.tecnico_id = filters.tecnico_id;
      if (filters.linea) params.linea = filters.linea;
      // tecnico_sin_reportes se maneja en el frontend, no se envía al backend

      logger.info('📥 Obteniendo PDFs de auditoría con filtros:', params);
      
      let allPdfs = [];
      let currentPage = 1;
      let totalPages = 1;
      const pageSize = 100; // Máximo permitido por el backend
      
      do {
        params.page = currentPage;
        params.page_size = pageSize;
        
        const response = await this.api.get('/auditoria/', { params });
        
        // Manejar respuesta paginada o array directo
        let pdfsData = response.data;
        let total = 0;
        
        if (response.data?.items && Array.isArray(response.data.items)) {
          pdfsData = response.data.items;
          total = response.data.total || pdfsData.length;
          totalPages = response.data.pages || 1;
          logger.info(`✅ Página ${currentPage}/${totalPages}: ${pdfsData.length} PDFs obtenidos (total: ${total})`);
        } else if (Array.isArray(response.data)) {
          pdfsData = response.data;
          total = pdfsData.length;
          totalPages = 1;
          logger.info('✅ PDFs obtenidos (array directo):', pdfsData.length);
        }
        
        allPdfs = [...allPdfs, ...pdfsData];
        
        // Si no hay más páginas o no queremos cargar todas, salir
        if (!loadAllPages || currentPage >= totalPages || pdfsData.length === 0) {
          break;
        }
        
        currentPage++;
      } while (currentPage <= totalPages);
      
      logger.info(`✅ Total PDFs cargados: ${allPdfs.length}`);
      
      return {
        success: true,
        data: allPdfs
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

  // Obtener técnicos con reportes
  async getTecnicosConReportes() {
    try {
      logger.info('👥 Obteniendo técnicos con reportes...');
      const response = await this.api.get('/auditoria/tecnicos');
      logger.info('✅ Técnicos obtenidos exitosamente:', response.data.total);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo técnicos:', error);
      
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
        message: error.response?.data?.detail || 'Error al obtener técnicos'
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

  // Eliminar todos los PDFs de auditoría (solo para admin)
  async deleteAllPDFs() {
    try {
      logger.info('⚠️ Eliminando TODOS los PDFs de auditoría...');
      
      // Usar apiClient con timeout personalizado
      const response = await apiClient.delete('/auditoria/delete-all', {
        timeout: 120000 // 2 minutos para operaciones grandes
      });
      
      logger.info('✅ Todos los PDFs eliminados exitosamente');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ Error al eliminar todos los PDFs:', error);
      
      // Manejar timeout específicamente
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'TIMEOUT',
          message: 'La operación está tomando demasiado tiempo. Los PDFs pueden estar eliminándose en segundo plano. Por favor, espera unos momentos y recarga la pantalla.'
        };
      }
      
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
          message: 'Solo administradores pueden eliminar todos los PDFs.'
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
        message: error.response?.data?.detail || 'Error inesperado al eliminar PDFs'
      };
    }
  }
}

export default new AuditoriaService();

