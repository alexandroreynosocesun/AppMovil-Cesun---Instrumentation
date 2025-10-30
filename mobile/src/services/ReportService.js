import axios from 'axios';
import { getAuthToken } from '../utils/authUtils';

const API_BASE_URL = 'https://cc2541746551.ngrok-free.app/api';

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
      console.log('Enviando petición al servidor:', {
        url: `${API_BASE_URL}/validations/generate-batch-report`,
        data: reportData
      });
      
      // Primero intentar con datos mínimos para probar la conexión
      const testData = {
        fecha: reportData.fecha,
        turno: reportData.turno,
        tecnico: reportData.tecnico,
        tecnico_id: reportData.tecnico_id,
        modelo: reportData.modelo,
        validaciones: reportData.validaciones.slice(0, 1) // Solo una validación para probar
      };
      
      console.log('Datos de prueba (1 validación):', JSON.stringify(testData, null, 2));
      
      const response = await this.api.post('/validations/generate-batch-report', testData);
      console.log('Respuesta exitosa del servidor:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error generando reporte:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
      
      // Si falla con datos de prueba, intentar con datos completos
      if (error.response?.status === 500) {
        console.log('🔄 Error 500 con datos de prueba, intentando con datos completos...');
        try {
          const response = await this.api.post('/validations/generate-batch-report', reportData);
          console.log('Respuesta exitosa con datos completos:', response.data);
          return { success: true, data: response.data };
        } catch (fullError) {
          console.error('Error también con datos completos:', fullError);
          return { success: false, error: 'Error interno del servidor (500). El backend tiene un problema.' };
        }
      }
      
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
      console.error('Error obteniendo historial de reportes:', error);
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  // Método para diagnosticar problemas del backend
  async testBackendConnection() {
    try {
      console.log('🔍 Probando conexión con el backend...');
      
      // Probar endpoint básico
      const response = await this.api.get('/health');
      console.log('✅ Backend responde correctamente:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Backend no responde:', error);
      
      // Probar con endpoint alternativo
      try {
        const response = await this.api.get('/validations/');
        console.log('✅ Endpoint alternativo funciona:', response.data);
        return { success: true, data: response.data };
      } catch (altError) {
        console.error('❌ Ningún endpoint funciona:', altError);
        return { 
          success: false, 
          error: 'Backend completamente no disponible. Verifique que el servidor esté ejecutándose.' 
        };
      }
    }
  }
}

export const reportService = new ReportService();
