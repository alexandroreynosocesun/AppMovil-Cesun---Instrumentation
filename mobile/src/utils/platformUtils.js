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

// Configuración específica para Android
export const androidConfig = {
  // Estilos específicos de Android (Material Design)
  elevation: 4,
  elevationCard: 4,
  elevationButton: 2,
  elevationFab: 6,
  rippleColor: 'rgba(255, 255, 255, 0.1)',
  useRippleEffect: true,
  useMaterialDesign: true,
  
  // Espaciado y padding
  statusBarHeight: 24,
  navigationBarHeight: 0,
  
  // Tipografía
  fontFamily: 'Roboto',
  
  // Comportamiento
  useUnderlineInput: false,
  defaultElevation: 2,
};

// Configuración específica para iOS
export const iosConfig = {
  // Estilos específicos de iOS
  shadowOpacity: 0.3,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  shadowColor: '#000000',
  
  // Espaciado
  statusBarHeight: 44,
  safeAreaInsets: true,
  
  // Tipografía
  fontFamily: 'System',
  
  // Comportamiento
  useRippleEffect: false,
  useMaterialDesign: false,
  useBlurEffect: true,
};

// Configuración específica para web
export const webConfig = {
  // Deshabilitar funcionalidades que no funcionan bien en web
  enableCamera: !isWeb,
  enableQRScanner: !isWeb,
  enableFileSystem: !isWeb,
  
  // Configuraciones de UI para web
  useDesktopLayout: isWeb,
  maxWidth: isWeb ? 1400 : '100%',
  containerPadding: isWeb ? 24 : 16,
  showDesktopMenu: isWeb && isDesktop,
  
  // Configuraciones de almacenamiento
  useSecureStore: !isWeb,
  useAsyncStorage: true,
  
  // Configuraciones de grid/columnas
  gridColumns: isDesktop ? 3 : isTablet ? 2 : 1,
  cardMaxWidth: isDesktop ? 400 : isTablet ? 350 : '100%',
};

// Configuración general de la app según plataforma
export const appConfig = {
  platform: Platform.OS,
  isWeb,
  isMobile,
  isIOS,
  isAndroid,
  isTablet,
  isDesktop,
  width,
  height,
  ...(isWeb ? webConfig : isAndroid ? androidConfig : iosConfig),
};

// Función helper para obtener estilos responsive por plataforma
export const getResponsiveStyle = (baseStyle, webStyle, androidStyle, iosStyle) => {
  let style = { ...baseStyle };
  
  if (isWeb && webStyle) {
    style = { ...style, ...webStyle };
  } else if (isAndroid && androidStyle) {
    style = { ...style, ...androidStyle };
  } else if (isIOS && iosStyle) {
    style = { ...style, ...iosStyle };
  }
  
  return style;
};

// Función helper específica para obtener estilos según plataforma
export const getPlatformStyle = (baseStyle, platformStyles = {}) => {
  const { android, ios, web } = platformStyles;
  return getResponsiveStyle(baseStyle, web, android, ios);
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

