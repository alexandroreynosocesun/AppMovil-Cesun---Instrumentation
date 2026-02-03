import logger from '../utils/logger';
import { apiClient } from '../utils/apiClient';

class AdminService {
  constructor() {
    // Usar instancia compartida de axios con interceptor de refresh token
    this.api = apiClient;
  }

  // ===== GESTIÓN DE USUARIOS =====

  async getUsers() {
    try {
      const response = await this.api.get('/admin/users');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al obtener usuarios:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getTecnicos() {
    try {
      logger.info('📡 [AdminService] Llamando a /admin/tecnicos...');
      logger.info('📡 [AdminService] URL completa:', `${this.api.defaults.baseURL}/admin/tecnicos`);
      
      const response = await this.api.get('/admin/tecnicos');
      
      logger.info('✅ [AdminService] Respuesta recibida - Status:', response.status);
      logger.info('✅ [AdminService] Respuesta recibida - Data:', response.data);
      logger.info('✅ [AdminService] Cantidad de técnicos:', response.data?.length || 0);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('❌ [AdminService] Error completo:', error);
      logger.error('❌ [AdminService] Status:', error.response?.status);
      logger.error('❌ [AdminService] Status Text:', error.response?.statusText);
      logger.error('❌ [AdminService] Data:', JSON.stringify(error.response?.data, null, 2));
      logger.error('❌ [AdminService] Headers:', error.response?.headers);
      logger.error('❌ [AdminService] Message:', error.message);
      logger.error('❌ [AdminService] Stack:', error.stack);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Error de conexión';
      
      logger.error('❌ [AdminService] Mensaje de error final:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getUser(userId) {
    try {
      const response = await this.api.get(`/admin/users/${userId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al obtener usuario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async createUser(userData) {
    try {
      const response = await this.api.post('/admin/users', userData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al crear usuario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async updateUser(userId, userData) {
    try {
      const response = await this.api.put(`/admin/users/${userId}`, userData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al actualizar usuario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async deleteUser(userId) {
    try {
      const response = await this.api.delete(`/admin/users/${userId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al eliminar usuario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getStats() {
    try {
      const response = await this.api.get('/admin/stats');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al obtener estadísticas:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  // ===== GESTIÓN DE SOLICITUDES DE REGISTRO =====

  async getSolicitudes() {
    try {
      const response = await this.api.get('/admin/solicitudes');
      logger.info('📡 [AdminService] Respuesta de solicitudes:', response.data);
      
      // El backend devuelve una respuesta paginada con estructura:
      // { items: [...], total: ..., page: ..., page_size: ..., pages: ... }
      // Extraer los items del objeto paginado
      const data = response.data;
      const solicitudes = data.items || data; // Si viene paginado, usar items, sino usar data directamente
      
      logger.info('📡 [AdminService] Solicitudes extraídas:', solicitudes);
      logger.info('📡 [AdminService] Cantidad de solicitudes:', solicitudes?.length || 0);
      
      return {
        success: true,
        data: solicitudes,
        pagination: data.total ? {
          total: data.total,
          page: data.page,
          page_size: data.page_size,
          pages: data.pages
        } : null
      };
    } catch (error) {
      logger.error('Error al obtener solicitudes:', error);
      logger.error('Error completo:', JSON.stringify(error.response?.data, null, 2));
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getSolicitudesPendientes() {
    try {
      const response = await this.api.get('/admin/solicitudes/pendientes');
      logger.info('📡 [AdminService] Respuesta de solicitudes pendientes:', response.data);
      
      // El backend devuelve una respuesta paginada con estructura:
      // { items: [...], total: ..., page: ..., page_size: ..., pages: ... }
      // Extraer los items del objeto paginado
      const data = response.data;
      const solicitudes = data.items || data; // Si viene paginado, usar items, sino usar data directamente
      
      logger.info('📡 [AdminService] Solicitudes extraídas:', solicitudes);
      logger.info('📡 [AdminService] Cantidad de solicitudes:', solicitudes?.length || 0);
      
      return {
        success: true,
        data: solicitudes,
        pagination: data.total ? {
          total: data.total,
          page: data.page,
          page_size: data.page_size,
          pages: data.pages
        } : null
      };
    } catch (error) {
      logger.error('Error al obtener solicitudes pendientes:', error);
      logger.error('Error completo:', JSON.stringify(error.response?.data, null, 2));
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getSolicitudDetalle(solicitudId) {
    try {
      const response = await this.api.get(`/admin/solicitudes/${solicitudId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al obtener detalle de solicitud:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async aprobarSolicitud(solicitudId, comentarios = '') {
    try {
      const response = await this.api.post(`/admin/solicitudes/${solicitudId}/aprobar`, {
        comentarios: comentarios
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al aprobar solicitud:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async rechazarSolicitud(solicitudId, comentarios) {
    try {
      const response = await this.api.post(`/admin/solicitudes/${solicitudId}/rechazar`, {
        comentarios: comentarios
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error al rechazar solicitud:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }
}

export default new AdminService();

