import axios from 'axios';
import { getAuthToken } from '../utils/authUtils';
import { API_BASE_URL } from './AuthService';
import logger from '../utils/logger';

const damagedLabelService = {
  async createDamagedLabel(data) {
    try {
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_BASE_URL}/damaged-labels/`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error creando reporte de etiqueta NG:', error);
      if (error.response?.status === 401) {
        return { success: false, error: 'UNAUTHORIZED', message: 'Tu sesión ha expirado' };
      }
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Error al crear el reporte' 
      };
    }
  },

  async getDamagedLabels() {
    try {
      const token = await getAuthToken();
      const response = await axios.get(
        `${API_BASE_URL}/damaged-labels/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error obteniendo reportes de etiquetas NG:', error);
      if (error.response?.status === 401) {
        return { success: false, error: 'UNAUTHORIZED', message: 'Tu sesión ha expirado' };
      }
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Error al obtener los reportes' 
      };
    }
  },

  async updateDamagedLabel(id, data) {
    try {
      const token = await getAuthToken();
      const response = await axios.put(
        `${API_BASE_URL}/damaged-labels/${id}`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error actualizando reporte de etiqueta NG:', error);
      if (error.response?.status === 401) {
        return { success: false, error: 'UNAUTHORIZED', message: 'Tu sesión ha expirado' };
      }
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Error al actualizar el reporte' 
      };
    }
  },

};

export const getImageUrl = (relativePath) => {
  if (!relativePath) {
    return null;
  }
  
  // Si ya es una URL completa o Base64, devolverla tal cual
  if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
    return relativePath;
  }
  
  // Si es Base64 sin el prefijo data:, agregarlo
  if (relativePath.length > 100 && !relativePath.startsWith('data:')) {
    return `data:image/jpeg;base64,${relativePath}`;
  }
  
  return relativePath;
};

export default damagedLabelService;

