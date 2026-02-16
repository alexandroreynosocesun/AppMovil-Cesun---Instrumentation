import { Alert, Platform } from 'react-native';

/**
 * Crea y muestra un modal HTML custom en web (evita el estilo oscuro de window.alert en iOS)
 */
function showWebModal(title, message, buttons) {
  // Remover modal anterior si existe
  const existing = document.getElementById('custom-alert-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'custom-alert-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 99999; padding: 20px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #FFFFFF; border-radius: 14px; padding: 24px;
    max-width: 320px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 17px; font-weight: 600; color: #1E293B;
      text-align: center; margin-bottom: 8px;
    `;
    titleEl.textContent = title;
    modal.appendChild(titleEl);
  }

  if (message) {
    const msgEl = document.createElement('div');
    msgEl.style.cssText = `
      font-size: 14px; color: #64748B; text-align: center;
      margin-bottom: 20px; line-height: 1.5; white-space: pre-line;
    `;
    msgEl.textContent = message;
    modal.appendChild(msgEl);
  }

  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = `
    display: flex; flex-direction: column; gap: 8px;
  `;

  const closeModal = () => overlay.remove();

  if (buttons && buttons.length > 0) {
    buttons.forEach((btn) => {
      const btnEl = document.createElement('button');
      const isCancel = btn.style === 'cancel' || btn.text === 'Cancelar';
      btnEl.style.cssText = `
        padding: 12px 16px; border-radius: 10px; border: none;
        font-size: 16px; font-weight: 500; cursor: pointer; width: 100%;
        background: ${isCancel ? '#F1F5F9' : '#2196F3'};
        color: ${isCancel ? '#64748B' : '#FFFFFF'};
      `;
      btnEl.textContent = btn.text || 'OK';
      btnEl.onclick = () => {
        closeModal();
        if (btn.onPress) setTimeout(btn.onPress, 100);
      };
      btnContainer.appendChild(btnEl);
    });
  } else {
    const okBtn = document.createElement('button');
    okBtn.style.cssText = `
      padding: 12px 16px; border-radius: 10px; border: none;
      font-size: 16px; font-weight: 500; cursor: pointer; width: 100%;
      background: #2196F3; color: #FFFFFF;
    `;
    okBtn.textContent = 'Cerrar';
    okBtn.onclick = closeModal;
    btnContainer.appendChild(okBtn);
  }

  modal.appendChild(btnContainer);
  overlay.appendChild(modal);
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.body.appendChild(overlay);
}

/**
 * Muestra un alert compatible con web y móvil
 */
export const showAlert = (title, message, buttons = null) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    showWebModal(title, message, buttons);
  } else {
    if (buttons) {
      Alert.alert(title, message, buttons);
    } else {
      Alert.alert(title, message);
    }
  }
};

/**
 * Muestra un alert de confirmación (con Cancelar/Aceptar)
 */
export const showConfirm = (title, message, onConfirm, onCancel = null) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    showWebModal(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: onCancel },
      { text: 'Aceptar', onPress: onConfirm },
    ]);
  } else {
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
