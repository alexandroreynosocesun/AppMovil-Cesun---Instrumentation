import { Platform, Dimensions } from 'react-native';

// Detectar si estamos en web
export const isWeb = Platform.OS === 'web';

// Detectar si estamos en móvil (iOS o Android)
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

// Detectar si estamos en iOS
export const isIOS = Platform.OS === 'ios';

// Detectar si estamos en Android
export const isAndroid = Platform.OS === 'android';

// Obtener dimensiones de la pantalla
const { width, height } = Dimensions.get('window');

// Detectar si es una pantalla grande (tablet o desktop)
export const isTablet = width >= 768;
export const isDesktop = isWeb && width >= 1024;

// Configuración específica para web
export const webConfig = {
  // Deshabilitar funcionalidades que no funcionan bien en web
  enableCamera: !isWeb, // La cámara puede tener limitaciones en web
  enableQRScanner: !isWeb, // El escáner QR puede necesitar configuración especial
  enableFileSystem: !isWeb, // FileSystem puede tener limitaciones
  
  // Configuraciones de UI para web
  useDesktopLayout: isWeb,
  maxWidth: isWeb ? 1400 : '100%',
  containerPadding: isWeb ? 24 : 16,
  showDesktopMenu: isWeb && isDesktop,
  
  // Configuraciones de almacenamiento
  useSecureStore: !isWeb, // En web usar localStorage en lugar de SecureStore
  useAsyncStorage: true, // AsyncStorage funciona en web también
  
  // Configuraciones de grid/columnas
  gridColumns: isDesktop ? 3 : isTablet ? 2 : 1,
  cardMaxWidth: isDesktop ? 400 : isTablet ? 350 : '100%',
};

// Configuración general de la app según plataforma
export const appConfig = {
  platform: Platform.OS,
  isWeb,
  isMobile,
  isTablet,
  isDesktop,
  width,
  height,
  ...webConfig,
};

// Función helper para obtener estilos responsive
export const getResponsiveStyle = (mobileStyle, webStyle) => {
  return isWeb ? { ...mobileStyle, ...webStyle } : mobileStyle;
};

// Función helper para obtener número de columnas según tamaño de pantalla
export const getGridColumns = () => {
  if (isDesktop) return 3;
  if (isTablet) return 2;
  return 1;
};

// Función helper para obtener padding responsive
export const getResponsivePadding = () => {
  if (isDesktop) return 24;
  if (isTablet) return 20;
  return 16;
};

