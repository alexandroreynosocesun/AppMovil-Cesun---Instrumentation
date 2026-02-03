import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import logger from './logger';
import { storage } from './storage';

const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';

// Verificar si estamos en web
const isWeb = Platform.OS === 'web';

/**
 * Verifica si la autenticación biométrica está disponible en el dispositivo
 */
export const isBiometricAvailable = async () => {
  // La autenticación biométrica no está disponible en web
  if (isWeb) {
    return { available: false, reason: 'La autenticación biométrica no está disponible en web' };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, reason: 'El dispositivo no soporta autenticación biométrica' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { 
        available: false, 
        reason: Platform.OS === 'ios' 
          ? 'No hay Face ID o Touch ID configurado' 
          : 'No hay autenticación biométrica configurada' 
      };
    }

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return { 
      available: true, 
      supportedTypes,
      type: supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) 
        ? 'Face ID' 
        : supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? 'Touch ID / Huella'
        : 'Biométrica'
    };
  } catch (error) {
    logger.error('Error verificando autenticación biométrica:', error);
    return { available: false, reason: 'Error verificando disponibilidad' };
  }
};

/**
 * Guarda las credenciales de forma segura para autenticación biométrica
 */
export const saveBiometricCredentials = async (usuario, password) => {
  // En web, no se pueden guardar credenciales biométricas
  if (isWeb) {
    logger.debug('⚠️ Guardar credenciales biométricas no disponible en web');
    return false;
  }

  try {
    const credentials = JSON.stringify({ usuario, password });
    await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, credentials);
    logger.info('✅ Credenciales guardadas para autenticación biométrica');
    return true;
  } catch (error) {
    logger.error('Error guardando credenciales biométricas:', error);
    return false;
  }
};

/**
 * Obtiene las credenciales guardadas
 */
export const getBiometricCredentials = async () => {
  // En web, no hay credenciales biométricas guardadas
  if (isWeb) {
    return null;
  }

  try {
    const credentials = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    if (credentials) {
      return JSON.parse(credentials);
    }
    return null;
  } catch (error) {
    logger.error('Error obteniendo credenciales biométricas:', error);
    return null;
  }
};

/**
 * Elimina las credenciales guardadas
 */
export const removeBiometricCredentials = async () => {
  // En web, no hay credenciales biométricas que eliminar
  if (isWeb) {
    return true;
  }

  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    logger.info('✅ Credenciales biométricas eliminadas');
    return true;
  } catch (error) {
    logger.error('Error eliminando credenciales biométricas:', error);
    return false;
  }
};

/**
 * Autentica usando biometría (Face ID, Touch ID, etc.)
 */
export const authenticateWithBiometrics = async () => {
  // La autenticación biométrica no está disponible en web
  if (isWeb) {
    return {
      success: false,
      error: 'La autenticación biométrica no está disponible en web'
    };
  }

  try {
    const biometricStatus = await isBiometricAvailable();
    if (!biometricStatus.available) {
      return {
        success: false,
        error: biometricStatus.reason || 'Autenticación biométrica no disponible'
      };
    }

    logger.info('Iniciando autenticación biométrica. Tipo:', biometricStatus.type);

    // En iOS, si disableDeviceFallback es false, iOS puede saltar directamente al PIN
    // Si es true, fuerza Face ID/Touch ID primero, pero no permite fallback a PIN
    // Vamos a intentar primero SOLO con biometría (sin PIN como fallback)
    // Esto debería forzar a iOS a usar Face ID primero
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: Platform.OS === 'ios' 
        ? (biometricStatus.type === 'Face ID' ? 'Usa Face ID para iniciar sesión' : 'Usa Touch ID para iniciar sesión')
        : 'Autentícate para iniciar sesión',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: true, // TRUE = fuerza solo biometría, NO permite PIN
      // No usar fallbackLabel cuando disableDeviceFallback es true
    });

    logger.info('Resultado de autenticación biométrica:', result.success, result.error);

    if (result.success) {
      return { success: true };
    } else {
      if (result.error === 'user_cancel') {
        return { success: false, error: 'Autenticación cancelada' };
      }
      // Si falló y NO fue cancelado por el usuario, podría necesitar PIN
      // Pero con disableDeviceFallback: true, iOS debería forzar Face ID primero
      logger.warn('Autenticación biométrica falló:', result.error);
      return { success: false, error: 'Autenticación fallida. Por favor intenta de nuevo.' };
    }
  } catch (error) {
    logger.error('Error en autenticación biométrica:', error);
    return { success: false, error: 'Error en autenticación biométrica' };
  }
};

