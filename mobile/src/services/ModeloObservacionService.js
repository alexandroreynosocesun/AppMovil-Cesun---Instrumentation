import logger from '../utils/logger';
import { apiClient } from '../utils/apiClient';

class ModeloObservacionService {
  constructor() {
    this.api = apiClient;
  }

  async getObservaciones(modelo_mainboard) {
    try {
      const response = await this.api.get('/modelo-observaciones/', { params: { modelo_mainboard } });
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error obteniendo observaciones:', error);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async createObservacion(modelo_mainboard, texto, foto = null) {
    try {
      const response = await this.api.post('/modelo-observaciones/', { modelo_mainboard, texto, foto });
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error creando observación:', error);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async deleteObservacion(obsId) {
    try {
      const response = await this.api.delete(`/modelo-observaciones/${obsId}`);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error eliminando observación:', error);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }
}

export const modeloObservacionService = new ModeloObservacionService();
export default modeloObservacionService;
