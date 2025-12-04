import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isDesktop = isWeb && width >= 1024;
const isTablet = width >= 768;

/**
 * Estilos responsive para web
 * Proporciona estilos optimizados para diferentes tamaños de pantalla
 */
export const webStyles = StyleSheet.create({
  // Contenedor principal responsive
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isDesktop ? 1400 : '100%',
      alignSelf: 'center',
      width: '100%',
      paddingHorizontal: isDesktop ? 24 : isTablet ? 20 : 16,
    }),
  },

  // Contenedor de contenido con scroll
  scrollContainer: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isDesktop ? 1400 : '100%',
      alignSelf: 'center',
      width: '100%',
    }),
  },

  // Contenedor de cards en grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    ...(isWeb && {
      justifyContent: isDesktop ? 'flex-start' : 'center',
      gap: isDesktop ? 16 : 12,
    }),
  },

  // Card responsive
  card: {
    ...(isWeb && {
      maxWidth: isDesktop ? 400 : isTablet ? 350 : '100%',
      minWidth: isDesktop ? 300 : isTablet ? 280 : '100%',
      margin: isDesktop ? 8 : isTablet ? 6 : 4,
    }),
  },

  // Botones responsive
  button: {
    ...(isWeb && {
      minWidth: isDesktop ? 200 : 150,
      paddingVertical: isDesktop ? 12 : 10,
    }),
  },

  // Inputs responsive
  input: {
    ...(isWeb && {
      maxWidth: isDesktop ? 500 : '100%',
    }),
  },

  // Header responsive
  header: {
    ...(isWeb && {
      paddingHorizontal: isDesktop ? 24 : 20,
      paddingVertical: isDesktop ? 16 : 12,
    }),
  },

  // Sidebar para desktop
  sidebar: {
    ...(isDesktop && {
      width: 250,
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100%',
    }),
  },

  // Contenido principal con sidebar
  mainContent: {
    ...(isDesktop && {
      marginLeft: 250,
      paddingLeft: 24,
    }),
  },

  // Formularios responsive
  formContainer: {
    ...(isWeb && {
      maxWidth: isDesktop ? 600 : isTablet ? 500 : '100%',
      alignSelf: 'center',
      width: '100%',
    }),
  },

  // Login/Register card responsive
  authCard: {
    ...(isWeb && {
      maxWidth: isDesktop ? 450 : isTablet ? 400 : '100%',
      alignSelf: 'center',
      width: '100%',
    }),
  },

  // ScrollView content responsive
  scrollContent: {
    ...(isWeb && {
      paddingHorizontal: isDesktop ? 24 : isTablet ? 20 : 16,
      paddingVertical: isDesktop ? 24 : 20,
    }),
  },

  // Modal/Dialog responsive
  modal: {
    ...(isWeb && {
      maxWidth: isDesktop ? 800 : isTablet ? 600 : '90%',
      alignSelf: 'center',
    }),
  },

  // List items responsive
  listItem: {
    ...(isWeb && {
      paddingHorizontal: isDesktop ? 24 : isTablet ? 20 : 16,
    }),
  },

  // Table responsive
  table: {
    ...(isWeb && {
      maxWidth: '100%',
      overflowX: 'auto',
    }),
  },

  // Image/Photo container responsive
  imageContainer: {
    ...(isWeb && {
      maxWidth: isDesktop ? 600 : isTablet ? 500 : '100%',
      alignSelf: 'center',
    }),
  },

  // Bottom bar/footer responsive
  bottomBar: {
    ...(isWeb && {
      maxWidth: isDesktop ? 1400 : '100%',
      alignSelf: 'center',
      width: '100%',
      paddingHorizontal: isDesktop ? 24 : isTablet ? 20 : 16,
    }),
  },

  // Text responsive
  title: {
    ...(isWeb && {
      fontSize: isDesktop ? 32 : isTablet ? 28 : 24,
    }),
  },

  subtitle: {
    ...(isWeb && {
      fontSize: isDesktop ? 18 : isTablet ? 16 : 14,
    }),
  },

  // Spacing responsive
  sectionSpacing: {
    ...(isWeb && {
      marginBottom: isDesktop ? 32 : isTablet ? 24 : 20,
    }),
  },

  // Grid item responsive
  gridItem: {
    ...(isWeb && {
      flexBasis: isDesktop ? '32%' : isTablet ? '48%' : '100%',
      maxWidth: isDesktop ? '32%' : isTablet ? '48%' : '100%',
    }),
  },
});

/**
 * Función helper para obtener estilos responsive
 */
export const getResponsiveStyle = (baseStyle, webStyle = {}) => {
  if (!isWeb) return baseStyle;
  
  return StyleSheet.create({
    ...baseStyle,
    ...webStyle,
  });
};

/**
 * Función helper para obtener número de columnas según tamaño
 */
export const getGridColumns = () => {
  if (isDesktop) return 3;
  if (isTablet) return 2;
  return 1;
};

/**
 * Función helper para obtener padding responsive
 */
export const getResponsivePadding = () => {
  if (isDesktop) return 24;
  if (isTablet) return 20;
  return 16;
};

/**
 * Función helper para obtener maxWidth responsive
 */
export const getResponsiveMaxWidth = () => {
  if (isDesktop) return 1400;
  if (isTablet) return 900;
  return '100%';
};

/**
 * Función helper para obtener fontSize responsive
 */
export const getResponsiveFontSize = (desktop, tablet, mobile) => {
  if (isDesktop) return desktop;
  if (isTablet) return tablet;
  return mobile;
};

/**
 * Función helper para obtener padding responsive
 */
export const getResponsiveSpacing = (desktop, tablet, mobile) => {
  if (isDesktop) return desktop;
  if (isTablet) return tablet;
  return mobile;
};

/**
 * Función helper para crear estilos de grid responsive
 */
export const getGridItemStyle = () => {
  if (isDesktop) {
    return {
      flexBasis: '32%',
      maxWidth: '32%',
      margin: '0.5%',
    };
  }
  if (isTablet) {
    return {
      flexBasis: '48%',
      maxWidth: '48%',
      margin: '1%',
    };
  }
  return {
    flexBasis: '100%',
    maxWidth: '100%',
    margin: 0,
  };
};

/**
 * Función helper para centrar contenido en web
 */
export const getCenteredContainerStyle = (maxWidth = null) => {
  if (!isWeb) return {};
  
  return {
    maxWidth: maxWidth || getResponsiveMaxWidth(),
    alignSelf: 'center',
    width: '100%',
  };
};

