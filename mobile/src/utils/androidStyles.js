import { StyleSheet, Platform } from 'react-native';

/**
 * Estilos específicos para Android
 * Proporciona estilos optimizados para Material Design
 */
export const androidStyles = StyleSheet.create({
  // Contenedor principal
  container: {
    ...(Platform.OS === 'android' && {
      flex: 1,
    }),
  },

  // Cards con elevation en lugar de shadow
  card: {
    ...(Platform.OS === 'android' && {
      elevation: 4,
      backgroundColor: '#2A2A2A',
    }),
  },

  // Cards elevadas
  cardElevated: {
    ...(Platform.OS === 'android' && {
      elevation: 8,
    }),
  },

  // Botones con elevation
  button: {
    ...(Platform.OS === 'android' && {
      elevation: 2,
    }),
  },

  buttonElevated: {
    ...(Platform.OS === 'android' && {
      elevation: 6,
    }),
  },

  // Inputs con estilo Material
  input: {
    ...(Platform.OS === 'android' && {
      underlineColorAndroid: 'transparent',
    }),
  },

  // SafeArea para Android (ajustar por status bar)
  safeArea: {
    ...(Platform.OS === 'android' && {
      paddingTop: 24, // Status bar height en Android
    }),
  },

  // FAB (Floating Action Button) con elevation
  fab: {
    ...(Platform.OS === 'android' && {
      elevation: 6,
    }),
  },

  // Surface components
  surface: {
    ...(Platform.OS === 'android' && {
      elevation: 2,
    }),
  },

  surfaceElevated: {
    ...(Platform.OS === 'android' && {
      elevation: 8,
    }),
  },

  // AppBar/Header con elevation
  header: {
    ...(Platform.OS === 'android' && {
      elevation: 4,
    }),
  },

  // Dividers
  divider: {
    ...(Platform.OS === 'android' && {
      backgroundColor: '#333333',
      height: 1,
    }),
  },

  // Chips con elevation
  chip: {
    ...(Platform.OS === 'android' && {
      elevation: 1,
    }),
  },

  // Modal/Dialog backdrop
  modalBackdrop: {
    ...(Platform.OS === 'android' && {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    }),
  },
});

/**
 * Helper para obtener estilos combinados con Android
 */
export const getAndroidStyle = (baseStyle, androidStyle = {}) => {
  if (Platform.OS !== 'android') return baseStyle;
  
  return StyleSheet.create({
    ...baseStyle,
    ...androidStyle,
  });
};

/**
 * Helper para elevation en Android
 */
export const getElevation = (level = 2) => {
  if (Platform.OS !== 'android') return {};
  
  return {
    elevation: level,
  };
};

/**
 * Helper para ripple effect en Android
 */
export const getRippleConfig = (color = 'rgba(255, 255, 255, 0.1)') => {
  if (Platform.OS !== 'android') return {};
  
  return {
    android_ripple: {
      color,
      borderless: false,
    },
  };
};



