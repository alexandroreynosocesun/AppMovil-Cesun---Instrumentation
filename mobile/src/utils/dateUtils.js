// Utilidades para formato de fecha y hora en formato 12 horas (AM/PM)

/**
 * Formatea una fecha en formato DD/MM/YYYY
 * @param {string|Date} dateString - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
const normalizeDateString = (dateString) => {
  if (!dateString) return null;
  let fechaStr = String(dateString);

  // NO agregar 'Z' para tratar las fechas sin zona horaria como hora local
  // Solo agregar 'T00:00:00' si es solo una fecha sin hora
  if (!/[Zz]$|[+-]\d{2}:\d{2}$/.test(fechaStr) && !fechaStr.includes('T')) {
    fechaStr = fechaStr + 'T00:00:00';
  }

  return fechaStr;
};

export const formatDate = (dateString) => {
  const normalized = normalizeDateString(dateString);
  if (!normalized) return '';
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
};

/**
 * Formatea una hora en formato 12 horas con AM/PM
 * @param {string|Date} dateString - Fecha/hora a formatear
 * @returns {string} - Hora formateada (ej: "02:30 PM")
 */
export const formatTime12Hour = (dateString) => {
  if (!dateString) return '';
  
  try {
    const fechaStr = normalizeDateString(dateString);
    
    const date = new Date(fechaStr);
    
    // Verificar que la fecha es válida
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  } catch (e) {
    console.error('Error formateando hora:', e);
    return '';
  }
};

/**
 * Formatea fecha y hora en formato 12 horas
 * @param {string|Date} dateString - Fecha/hora a formatear
 * @returns {string} - Fecha y hora formateada (ej: "15/12/2024 02:30 PM")
 */
export const formatDateTime12Hour = (dateString) => {
  const normalized = normalizeDateString(dateString);
  if (!normalized) return '';
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';
  const dateStr = date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  return `${dateStr} ${timeStr}`;
};

/**
 * Formatea una fecha completa con hora en formato 12 horas
 * @param {string|Date} dateString - Fecha/hora a formatear
 * @returns {string} - Fecha completa formateada (ej: "15 de diciembre de 2024 02:30 PM")
 */
export const formatFullDateTime12Hour = (dateString) => {
  const normalized = normalizeDateString(dateString);
  if (!normalized) return '';
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';
  const dateStr = date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  return `${dateStr} ${timeStr}`;
};

/**
 * Obtiene la hora actual en formato 12 horas
 * @returns {string} - Hora actual (ej: "02:30 PM")
 */
export const getCurrentTime12Hour = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Obtiene la fecha y hora actual en formato 12 horas
 * @returns {string} - Fecha y hora actual (ej: "15/12/2024 02:30 PM")
 */
export const getCurrentDateTime12Hour = () => {
  const now = new Date();
  return formatDateTime12Hour(now);
};
