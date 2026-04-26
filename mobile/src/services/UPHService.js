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

  async getTopOperadores(linea = null) {
    try {
      const params = linea ? `?linea=${encodeURIComponent(linea)}` : '';
      const response = await apiClient.get(`/uph/resumen/top-operadores${params}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' };
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

  async getEstadoDescanso(linea) {
    try {
      const response = await apiClient.get(`/uph/descanso/${encodeURIComponent(linea)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async iniciarDescanso(linea) {
    try {
      const response = await apiClient.post(`/uph/descanso/${encodeURIComponent(linea)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async terminarDescanso(linea) {
    try {
      const response = await apiClient.put(`/uph/descanso/${encodeURIComponent(linea)}/fin`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getPlanLinea(linea) {
    try {
      const response = await apiClient.get(`/uph/plan-linea/${encodeURIComponent(linea)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getPlanDia(linea) {
    try {
      const response = await apiClient.get(`/uph/plan-dia/${encodeURIComponent(linea)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async crearPlanLinea(linea, modelo_id, plan_total) {
    try {
      const response = await apiClient.post('/uph/plan-linea', { linea, modelo_id, plan_total });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getHistorialOperadorHoy(numEmpleado, linea) {
    try {
      const params = linea ? `?linea=${encodeURIComponent(linea)}` : '';
      const response = await apiClient.get(`/uph/operador/${encodeURIComponent(numEmpleado)}/horas-hoy${params}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async avanzarModelo(lineaId) {
    try {
      const response = await apiClient.post(`/uph/plan/avanzar/${lineaId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async cerrarPlanLinea(linea) {
    try {
      const response = await apiClient.delete(`/uph/plan-linea/${encodeURIComponent(linea)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async asignarBulk(linea, fecha, turno_id, modelo_id, asignaciones, plan_interno = null) {
    try {
      const response = await apiClient.post('/uph/asignacion/bulk', {
        linea, fecha, turno_id, modelo_id, asignaciones, plan_interno,
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

  async actualizarTurnoOperador(num_empleado, turno) {
    try {
      const response = await apiClient.patch(`/uph/operadores/${num_empleado}/turno?turno=${turno}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getLideresLista() {
    try {
      const response = await apiClient.get('/uph/lideres/lista');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async claimLider(num_empleado, session_id) {
    try {
      const response = await apiClient.post('/uph/lideres/claim', { num_empleado, session_id });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async releaseLider(num_empleado, session_id) {
    try {
      await apiClient.delete(`/uph/lideres/claim/${num_empleado}?session_id=${session_id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getSesionLider(session_id) {
    try {
      const response = await apiClient.get(`/uph/lideres/sesion/${session_id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async vincularLiderLinea(num_empleado, linea) {
    try {
      await apiClient.post('/uph/lideres/vincular-linea', { num_empleado, linea });
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  async getMonitorLineas() {
    try {
      const response = await apiClient.get('/uph/monitor/lineas');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }

  async getLideresLista() {
    try {
      const response = await apiClient.get('/uph/lideres/lista');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error de conexión' };
    }
  }
}

export const uphService = new UPHService();