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
 * Generar sugerencias de tipo de jig basado en el código QR
 * - Si empieza con "M" → manual
 * - Si empieza con "S" → semiautomatico
 * - Si empieza con "NS" → nuevo semiautomatico
 */
export const getJigTypeSuggestion = (qrCode) => {
  if (!qrCode) {
    return 'manual';
  }
  
  // Convertir a mayúsculas para comparación
  const upperQR = qrCode.toUpperCase().trim();
  
  // Verificar si empieza con "NS" (debe ser antes de verificar "S")
  if (upperQR.startsWith('NS')) {
    return 'new semiautomatic';
  }
  
  // Verificar si empieza con "S"
  if (upperQR.startsWith('S')) {
    return 'semiautomatic';
  }
  
  // Verificar si empieza con "M" (o por defecto manual)
  if (upperQR.startsWith('M')) {
    return 'manual';
  }
  
  // Por defecto, manual
  return 'manual';
};




