/**
 * Sistema de logging para React Native
 * En producción, solo muestra errores críticos
 */
const IS_PRODUCTION = __DEV__ === false;

class Logger {
  constructor() {
    this.enabled = !IS_PRODUCTION; // Habilitado solo en desarrollo
  }

  debug(message, ...args) {
    if (this.enabled) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.enabled) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (this.enabled || IS_PRODUCTION) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message, ...args) {
    // Los errores siempre se muestran
    console.error(`[ERROR] ${message}`, ...args);
  }

  // Método para logging estructurado
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata
    };

    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else if (this.enabled) {
      console.log(JSON.stringify(logEntry));
    }
  }
}

export default new Logger();

