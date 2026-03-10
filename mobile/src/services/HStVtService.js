import { apiClient } from '../utils/apiClient';

class HStVtService {
  async getScripts() {
    try {
      const response = await apiClient.get('/hstvt/list');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Error de conexión' };
    }
  }
}

export const hstvtService = new HStVtService();
