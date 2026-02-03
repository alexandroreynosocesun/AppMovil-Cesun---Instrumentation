import logger from '../utils/logger';
import { apiClient } from '../utils/apiClient';

const damagedLabelService = {
  async createDamagedLabel(data) {
    try {
      const response = await apiClient.post('/damaged-labels/', data);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error creando reporte de etiqueta NG:', error);
      if (error.response) {
        logger.error('Status:', error.response.status);
        logger.error('Data:', JSON.stringify(error.response.data, null, 2));
        logger.error('Headers:', error.response.headers);
      }
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
      const response = await apiClient.get('/damaged-labels/');
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
      const response = await apiClient.put(`/damaged-labels/${id}`, data);
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

