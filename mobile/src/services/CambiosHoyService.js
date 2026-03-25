import { API_BASE_URL } from '../utils/apiClient';
import { getAuthToken } from '../utils/authUtils';

export const cambiosHoyService = {
  async analizar(imageUri) {
    const token = await getAuthToken();

    const fetched = await fetch(imageUri);
    const blob = await fetched.blob();

    const form = new FormData();
    form.append('imagen', blob, 'imagen.jpg');

    const res = await fetch(`${API_BASE_URL}/api/cambios-hoy/analizar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
      throw { response: { status: res.status, data: err } };
    }
    return res.json();
  },
};
