import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://ecb2b679741f.ngrok-free.app/api';

class AdminService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar el token de autenticación
    this.api.interceptors.request.use(
      async (config) => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error obteniendo token:', error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
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
      console.error('Error al obtener usuarios:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
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
      console.error('Error al obtener usuario:', error);
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
      console.error('Error al crear usuario:', error);
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
      console.error('Error al actualizar usuario:', error);
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
      console.error('Error al eliminar usuario:', error);
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
      console.error('Error al obtener estadísticas:', error);
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
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }

  async getSolicitudesPendientes() {
    try {
      const response = await this.api.get('/admin/solicitudes/pendientes');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error al obtener solicitudes pendientes:', error);
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
      console.error('Error al obtener detalle de solicitud:', error);
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
      console.error('Error al aprobar solicitud:', error);
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
      console.error('Error al rechazar solicitud:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error de conexión'
      };
    }
  }
}

export default new AdminService();
