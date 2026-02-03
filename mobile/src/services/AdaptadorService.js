import logger from '../utils/logger';
import { apiClient } from '../utils/apiClient';

class AdaptadorService {
  constructor() {
    // Usar instancia compartida de axios con interceptor de refresh token
    this.api = apiClient;
  }

  async getAdaptadorByQR(codigoQR) {
    try {
      const response = await this.api.get(`/adaptadores/qr/${codigoQR}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      if (error.response?.status !== 404) {
        logger.error('Error obteniendo adaptador por QR:', error);
      }
      
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'El código QR escaneado no corresponde a un adaptador o convertidor registrado.'
        };
      }
      
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  async getAdaptadores(tipo = null, modelo = null, options = {}) {
    try {
      // Construir query params
      const params = {};
      if (tipo === 'adaptador') {
        // Para adaptadores, cargar todos sin filtrar por modelo por ahora
        // Los modelos de adaptadores son ADA20100_01, ADA20100_02
      } else if (tipo === 'convertidor') {
        // Para convertidores, cargar todos sin filtrar por modelo por ahora
        // Los modelos de convertidores son 11477, 11479
      }
      
      if (modelo) {
        params.modelo = modelo;
      }
      if (options.includeConectores) {
        params.include_conectores = true;
      }
      if (options.includeTecnicos) {
        params.include_tecnicos = true;
      }
      
      // Obtener todos los adaptadores con paginación
      let allItems = [];
      let page = 1;
      const pageSize = 100; // Máximo permitido por el backend
      let hasMorePages = true;
      
      while (hasMorePages) {
        const response = await this.api.get('/adaptadores/', {
          params: {
            page: page,
            page_size: pageSize,
            ...params
          }
        });
        
        const items = response.data.items || [];
        allItems = allItems.concat(items);
        
        // Verificar si hay más páginas
        const total = response.data.total || 0;
        const pages = response.data.pages || 1;
        
        if (page >= pages || items.length === 0) {
          hasMorePages = false;
        } else {
          page++;
        }
      }
      
      // Filtrar por tipo si es necesario
      if (tipo === 'adaptador') {
        allItems = allItems.filter(a =>
          a.modelo_adaptador === 'ADA20100_01' ||
          a.modelo_adaptador === 'ADA20100_02' ||
          a.modelo_adaptador === 'CSTH-100/ZH-S20'
        );
      } else if (tipo === 'convertidor') {
        allItems = allItems.filter(a => a.modelo_adaptador === '11477' || a.modelo_adaptador === '11479');
      }
      
      return {
        success: true,
        data: allItems
      };
    } catch (error) {
      logger.error('Error obteniendo adaptadores:', error);
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  async updateConectorEstado(conectorId, estado, comentario = null) {
    try {
      const data = { estado };
      if (comentario) {
        data.comentario = comentario;
      }
      const response = await this.api.put(`/adaptadores/conectores/${conectorId}/estado`, data);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error actualizando estado del conector:', error);
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  async toggleDualConector(adaptadorId) {
    try {
      const response = await this.api.put(`/adaptadores/${adaptadorId}/dual-conector`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error toggling dual conector:', error);
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  async bulkUpdateConectoresUso(conectorIds, { fecha_ok, linea, turno } = {}) {
    try {
      const payload = {
        conector_ids: conectorIds,
        fecha_ok,
        linea,
        turno
      };
      const response = await this.api.put('/adaptadores/conectores/uso-ultimo', payload);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error actualizando uso de conectores:', error);
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  async getModelosMainboardByConector(nombreConector) {
    try {
      const response = await this.api.get(`/adaptadores/conectores/${encodeURIComponent(nombreConector)}/modelos-mainboard`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo modelos mainboard:', error);
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  async createAdaptador(adaptadorData) {
    try {
      const response = await this.api.post('/adaptadores/', adaptadorData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creando adaptador:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Error de conexión';
      logger.error('Detalle del error:', error.response?.data);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async searchMainboardModels(query) {
    try {
      const response = await this.api.get('/adaptadores/mainboard/search', {
        params: { query }
      });
      return {
        success: true,
        data: response.data.suggestions || []
      };
    } catch (error) {
      logger.error('Error buscando modelos de mainboard:', error);
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  async getMainboardDetails(modeloMainboard) {
    try {
      const response = await this.api.get(`/adaptadores/mainboard/detalles`, {
        params: { modelo_mainboard: modeloMainboard }
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error obteniendo detalles del modelo mainboard:', error);
      return {
        success: false,
        error: this._handleError(error)
      };
    }
  }

  _handleError(error) {
    if (error.response?.status === 401) {
      return 'UNAUTHORIZED';
    } else if (error.response?.status === 404) {
      return 'NOT_FOUND';
    } else if (error.response?.status === 500) {
      return 'SERVER_ERROR';
    } else if (error.code === 'NETWORK_ERROR' || !error.response) {
      return 'NETWORK_ERROR';
    } else {
      return error.response?.data?.detail || 'UNKNOWN_ERROR';
    }
  }
}

export const adaptadorService = new AdaptadorService();
export default adaptadorService;
