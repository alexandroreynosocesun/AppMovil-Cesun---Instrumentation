import axios from 'axios';
import { getAuthToken } from '../utils/authUtils';
import logger from '../utils/logger';

const API_BASE_URL = 'https://0a0075381ed5.ngrok-free.app/api';

class ReportService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // Aumentar timeout para generación de PDF
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use(
      async (config) => {
        const token = await getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  async generateValidationReport(reportData) {
    try {
      logger.info('📤 Enviando petición al servidor con TODAS las validaciones:');
      logger.info(`   URL: ${API_BASE_URL}/validations/generate-batch-report`);
      logger.info(`   Total validaciones: ${reportData.validaciones.length}`);
      logger.info(`   Validaciones:`, reportData.validaciones.map(v => ({
        jig_id: v.jig_id,
        numero_jig: v.numero_jig,
        estado: v.estado
      })));
      
      // Enviar TODAS las validaciones directamente
      const response = await this.api.post('/validations/generate-batch-report', reportData);
      logger.info('✅ Respuesta exitosa del servidor:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('❌ Error generando reporte:', error);
      logger.error('Error response:', error.response?.data);
      logger.error('Error status:', error.response?.status);
      logger.error('Error headers:', error.response?.headers);
      
      let errorMessage = 'Error de conexión';
      
      if (error.response?.status === 500) {
        errorMessage = 'Error interno del servidor (500). El backend tiene un problema.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Datos inválidos (400). Verifique la información enviada.';
      } else if (error.response?.status === 401) {
        errorMessage = 'No autorizado (401). Verifique su sesión.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Endpoint no encontrado (404).';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout: El servidor tardó demasiado en responder.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async getReportHistory() {
    try {
      const response = await this.api.get('/validations/reports');
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error obteniendo historial de reportes:', error);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  // Método para diagnosticar problemas del backend
  async testBackendConnection() {
    try {
      logger.info('🔍 Probando conexión con el backend...');
      
      // Probar endpoint básico
      const response = await this.api.get('/health');
      logger.info('✅ Backend responde correctamente:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('❌ Backend no responde:', error);
      
      // Probar con endpoint alternativo
      try {
        const response = await this.api.get('/validations/');
        logger.info('✅ Endpoint alternativo funciona:', response.data);
        return { success: true, data: response.data };
      } catch (altError) {
        logger.error('❌ Ningún endpoint funciona:', altError);
        return { 
          success: false, 
          error: 'Backend completamente no disponible. Verifique que el servidor esté ejecutándose.' 
        };
      }
    }
  }
}

export const reportService = new ReportService();

