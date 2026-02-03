import logger from '../utils/logger';
import { apiClient, API_BASE_URL } from '../utils/apiClient';
import { Platform } from 'react-native';
import { getAuthToken } from '../utils/authUtils';
import { downloadAsync, documentDirectory } from 'expo-file-system/legacy';

class InventarioService {
  constructor() {
    this.api = apiClient;
  }

  /**
   * Obtiene el resumen del inventario (sin PDF)
   */
  async getResumen() {
    try {
      logger.info('Obteniendo resumen de inventario');
      const response = await this.api.get('/inventario/resumen');
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error obteniendo resumen de inventario:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Error obteniendo inventario'
      };
    }
  }

  /**
   * Genera y descarga el PDF del inventario
   */
  async generarPDF(nombreInventario = 'Inventario General') {
    try {
      logger.info('Generando PDF de inventario:', nombreInventario);

      const token = await getAuthToken();
      const url = `${API_BASE_URL}/api/inventario/generar-pdf?nombre_inventario=${encodeURIComponent(nombreInventario)}`;
      const filename = `inventario_${new Date().toISOString().split('T')[0]}_${Date.now()}.pdf`;

      if (Platform.OS === 'web') {
        // En web, usar blob
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Error generando PDF');
        }

        const blob = await response.blob();
        return { success: true, data: blob, isBlob: true };
      } else {
        // En mobile, usar downloadAsync de expo-file-system/legacy
        const fileUri = `${documentDirectory}${filename}`;

        const downloadResult = await downloadAsync(url, fileUri, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (downloadResult.status !== 200) {
          throw new Error('Error descargando PDF');
        }

        return { success: true, data: downloadResult.uri, isFileUri: true };
      }
    } catch (error) {
      logger.error('Error generando PDF de inventario:', error);
      return {
        success: false,
        error: error.message || 'Error generando PDF'
      };
    }
  }
}

export const inventarioService = new InventarioService();
export default inventarioService;
