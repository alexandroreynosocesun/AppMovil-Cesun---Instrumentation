import { apiClient } from '../utils/apiClient';

class UPHService {
  async getResumen() {
    try {
      const response = await apiClient.get('/uph/resumen');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getReporteSemanalCompleto() {
    try {
      const response = await apiClient.get('/uph/reporte/semanal/completo');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getHistorialOperador(numEmpleado, dias = 7) {
    try {
      const response = await apiClient.get(`/uph/historial/${numEmpleado}?dias=${dias}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getAndonLinea(linea) {
    try {
      const response = await apiClient.get(`/uph/andon/${linea}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getModelos() {
    try {
      const response = await apiClient.get('/uph/modelos');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getModelosPorLinea(lineaNombre) {
    try {
      const response = await apiClient.get(`/uph/modelos/linea/${lineaNombre}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getLineas() {
    try {
      const response = await apiClient.get('/uph/lineas');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async crearModelo(payload) {
    try {
      const response = await apiClient.post('/uph/modelos', payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async actualizarModelo(id, payload) {
    try {
      const response = await apiClient.put(`/uph/modelos/${id}`, payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async eliminarModelo(id) {
    try {
      await apiClient.delete(`/uph/modelos/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getTurnos() {
    try {
      const response = await apiClient.get('/uph/turnos');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getTurnoActual() {
    try {
      const response = await apiClient.get('/uph/turno/actual');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getEstacionesPorLinea(lineaNombre) {
    try {
      const response = await apiClient.get(`/uph/lineas/${lineaNombre}/estaciones`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getAsignacionHoy(linea) {
    try {
      const response = await apiClient.get(`/uph/asignacion/hoy?linea=${encodeURIComponent(linea)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async actualizarModeloHoy(linea, modelo_id) {
    try {
      const response = await apiClient.patch(
        `/uph/asignacion/hoy/modelo?linea=${encodeURIComponent(linea)}&modelo_id=${modelo_id}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async limpiarAsignacionHoy(linea) {
    try {
      const response = await apiClient.delete(`/uph/asignacion/hoy?linea=${encodeURIComponent(linea)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async asignarBulk(linea, fecha, turno_id, modelo_id, asignaciones) {
    try {
      const response = await apiClient.post('/uph/asignacion/bulk', {
        linea, fecha, turno_id, modelo_id, asignaciones,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getScoreboardHoy(linea = null) {
    try {
      const params = linea ? `?linea=${linea}` : '';
      const response = await apiClient.get(`/uph/scoreboard/hoy${params}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getOperadores() {
    try {
      const response = await apiClient.get('/uph/operadores');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async crearOperador(num_empleado, nombre) {
    try {
      const response = await apiClient.post('/uph/operadores', { num_empleado, nombre, activo: true });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }
}

export const uphService = new UPHService();