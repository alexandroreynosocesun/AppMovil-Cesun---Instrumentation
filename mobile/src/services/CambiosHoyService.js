import { apiClient } from '../utils/apiClient';

export const cambiosHoyService = {
  async analizar(imagenBase64) {
    const res = await apiClient.post('/cambios-hoy/analizar', {
      imagen_base64: imagenBase64,
    }, {
      timeout: 120000, // 2 minutos — Claude Vision puede tardar
    });
    return res.data;
  },
};
