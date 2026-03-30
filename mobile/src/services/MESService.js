import { apiClient } from '../utils/apiClient';

class MESService {
  async getDashboard(estacionId = 'FCT-1') {
    try {
      const r = await apiClient.get(`/mes/dashboard?estacion_id=${encodeURIComponent(estacionId)}`);
      return { success: true, data: r.data };
    } catch (e) {
      return { success: false, error: e.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getEstaciones() {
    try {
      const r = await apiClient.get('/mes/estaciones');
      return { success: true, data: r.data };
    } catch (e) {
      return { success: false, error: e.response?.data?.detail || 'Error de conexión' };
    }
  }
}

export const mesService = new MESService();
