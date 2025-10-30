// Utilidades para formato de fecha y hora en formato 12 horas (AM/PM)

/**
 * Formatea una fecha en formato DD/MM/YYYY
 * @param {string|Date} dateString - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Formatea una hora en formato 12 horas con AM/PM
 * @param {string|Date} dateString - Fecha/hora a formatear
 * @returns {string} - Hora formateada (ej: "02:30 PM")
 */
export const formatTime12Hour = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Formatea fecha y hora en formato 12 horas
 * @param {string|Date} dateString - Fecha/hora a formatear
 * @returns {string} - Fecha y hora formateada (ej: "15/12/2024 02:30 PM")
 */
export const formatDateTime12Hour = (dateString) => {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return `${dateStr} ${timeStr}`;
};

/**
 * Formatea una fecha completa con hora en formato 12 horas
 * @param {string|Date} dateString - Fecha/hora a formatear
 * @returns {string} - Fecha completa formateada (ej: "15 de diciembre de 2024 02:30 PM")
 */
export const formatFullDateTime12Hour = (dateString) => {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
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
