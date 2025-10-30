/**
 * Utilidad para parsear códigos QR de jigs
 * Formato esperado: M-51876-B-9
 * Posiciones: [0]-[1]-[2]-[3]
 */

export const parseQRCode = (qrCode) => {
  if (!qrCode) {
    return {
      numeroJig: '',
      modeloActual: '',
      isValid: false
    };
  }

  // Dividir el código QR por guiones
  const parts = qrCode.split('-');
  
  // Verificar que tenga exactamente 4 partes
  if (parts.length !== 4) {
    return {
      numeroJig: '',
      modeloActual: '',
      isValid: false,
      error: 'Formato de QR inválido. Se espera: X-XXXXX-X-X'
    };
  }

  // Extraer las partes según la lógica:
  // M-51876-B-9
  // [0] = M (prefijo)
  // [1] = 51876 (modelo actual)
  // [2] = B (categoría)
  // [3] = 9 (número de jig)
  
  const modeloActual = parts[1].trim(); // Segundo lugar después del primer guión
  const numeroJig = parts[3].trim();    // Cuarto lugar después del tercer guión
  
  return {
    numeroJig,
    modeloActual,
    isValid: true,
    originalCode: qrCode,
    parts: parts
  };
};

/**
 * Validar si un código QR tiene el formato correcto
 */
export const isValidQRFormat = (qrCode) => {
  const parsed = parseQRCode(qrCode);
  return parsed.isValid;
};

/**
 * Generar sugerencias de tipo de jig basado en el código
 */
export const getJigTypeSuggestion = (qrCode) => {
  const parsed = parseQRCode(qrCode);
  
  if (!parsed.isValid) {
    return 'manual';
  }
  
  // Lógica para determinar tipo basado en el código
  const prefix = parsed.parts[0].toUpperCase();
  const category = parsed.parts[2].toUpperCase();
  
  // Si contiene 'A' o 'S' en la categoría, podría ser semiautomático
  if (category.includes('A') || category.includes('S')) {
    return 'semiautomatico';
  }
  
  // Por defecto, manual
  return 'manual';
};
