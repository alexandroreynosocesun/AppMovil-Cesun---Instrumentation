import logger from '../utils/logger';
import { apiClient } from '../utils/apiClient';

class ArduinoSequenceService {
  constructor() {
    this.api = apiClient;
  }

  async getSequences(params = {}) {
    try {
      logger.info('🔍 Buscando secuencias con params:', JSON.stringify(params));
      const response = await this.api.get('/arduino-sequences/', { params });
      logger.info('✅ Respuesta:', JSON.stringify(response.data));
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('❌ Error obteniendo secuencias Arduino:', error);
      logger.error('❌ Response:', error.response?.data);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async createSequence(payload) {
    try {
      const response = await this.api.post('/arduino-sequences/', payload);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error creando secuencia Arduino:', error);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async deleteSequence(sequenceId) {
    try {
      const response = await this.api.delete(`/arduino-sequences/${sequenceId}`);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error eliminando secuencia Arduino:', error);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }
}

export const arduinoSequenceService = new ArduinoSequenceService();
export default arduinoSequenceService;
