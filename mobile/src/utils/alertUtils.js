import { Alert, Platform } from 'react-native';

/**
 * Muestra un alert compatible con web y móvil
 * En web usa window.alert, en móvil usa Alert.alert
 * 
 * @param {string} title - Título del alert
 * @param {string} message - Mensaje del alert
 * @param {Array} buttons - Array de botones (opcional). En web solo se muestra el mensaje.
 */
export const showAlert = (title, message, buttons = null) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // En web usar window.alert (solo muestra OK)
    window.alert(`${title}\n\n${message}`);
    
    // Si hay botones y el primero tiene onPress, ejecutarlo después del alert
    // (window.alert es síncrono, así que esto se ejecutará después de cerrar)
    if (buttons && buttons.length > 0) {
      const firstButton = buttons.find(b => b.style !== 'cancel' && b.text !== 'Cancelar');
      if (firstButton && firstButton.onPress) {
        // Ejecutar después de un pequeño delay para asegurar que el alert se cerró
        setTimeout(() => {
          firstButton.onPress();
        }, 100);
      }
    }
  } else {
    // En móvil usar Alert.alert normal
    if (buttons) {
      Alert.alert(title, message, buttons);
    } else {
      Alert.alert(title, message);
    }
  }
};

/**
 * Muestra un alert de confirmación (con Cancelar/Aceptar)
 * En web usa window.confirm, en móvil usa Alert.alert
 * 
 * @param {string} title - Título del alert
 * @param {string} message - Mensaje del alert
 * @param {Function} onConfirm - Función a ejecutar si se confirma
 * @param {Function} onCancel - Función a ejecutar si se cancela (opcional)
 */
export const showConfirm = (title, message, onConfirm, onCancel = null) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // En web usar window.confirm
    if (window.confirm(`${title}\n\n${message}`)) {
      if (onConfirm) onConfirm();
    } else {
      if (onCancel) onCancel();
    }
  } else {
    // En móvil usar Alert.alert
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: onCancel },
        { text: 'Aceptar', onPress: onConfirm }
      ]
    );
  }
};



