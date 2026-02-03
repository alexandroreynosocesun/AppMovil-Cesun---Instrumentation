import { useMemo } from 'react';
import { Platform, Dimensions } from 'react-native';

/**
 * Hook personalizado para detectar la plataforma y obtener configuraciones
 * @returns {Object} Configuración de plataforma y utilidades
 */
export const usePlatform = () => {
  const platform = useMemo(() => {
    const isWeb = Platform.OS === 'web';
    const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';
    const isIOS = Platform.OS === 'ios';
    const isAndroid = Platform.OS === 'android';
    
    const { width, height } = Dimensions.get('window');
    const isTablet = width >= 768;
    const isDesktop = isWeb && width >= 1024;
    
    return {
      // Detección de plataforma
      isWeb,
      isMobile,
      isIOS,
      isAndroid,
      isTablet,
      isDesktop,
      platform: Platform.OS,
      
      // Dimensiones
      width,
      height,
      
      // Configuraciones específicas de funcionalidad
      canUseCamera: !isWeb,
      canUseQRScanner: !isWeb,
      canUseFileSystem: !isWeb,
      useDesktopLayout: isWeb,
      useSecureStore: !isWeb,
      
      // Configuraciones de UI por plataforma
      // Android
      elevation: isAndroid ? 4 : 0,
      elevationCard: isAndroid ? 4 : 0,
      elevationButton: isAndroid ? 2 : 0,
      elevationFab: isAndroid ? 6 : 0,
      useRipple: isAndroid,
      useMaterialDesign: isAndroid,
      statusBarHeight: isAndroid ? 24 : isIOS ? 44 : 0,
      
      // iOS
      shadowOpacity: isIOS ? 0.3 : 0,
      shadowRadius: isIOS ? 8 : 0,
      shadowOffset: isIOS ? { width: 0, height: 4 } : { width: 0, height: 0 },
      shadowColor: isIOS ? '#000000' : 'transparent',
      useBlurEffect: isIOS,
      safeAreaInsets: isIOS,
      
      // Web
      maxWidth: isWeb ? 1400 : '100%',
      containerPadding: isWeb ? 24 : 16,
      gridColumns: isDesktop ? 3 : isTablet ? 2 : 1,
      cardMaxWidth: isDesktop ? 400 : isTablet ? 350 : '100%',
      
      // Helper functions para estilos
      getResponsiveStyle: (baseStyle, webStyle, androidStyle, iosStyle) => {
        let style = { ...baseStyle };
        if (isWeb && webStyle) style = { ...style, ...webStyle };
        if (isAndroid && androidStyle) style = { ...style, ...androidStyle };
        if (isIOS && iosStyle) style = { ...style, ...iosStyle };
        return style;
      },
      
      getPlatformStyle: (baseStyle, platformStyles = {}) => {
        const { android, ios, web } = platformStyles;
        let style = { ...baseStyle };
        if (isWeb && web) style = { ...style, ...web };
        if (isAndroid && android) style = { ...style, ...android };
        if (isIOS && ios) style = { ...style, ...ios };
        return style;
      },
      
      getElevation: (level = 2) => {
        return isAndroid ? { elevation: level } : {};
      },
      
      getShadow: (opacity = 0.3, radius = 8, offset = { width: 0, height: 4 }) => {
        return isIOS ? {
          shadowColor: '#000000',
          shadowOffset: offset,
          shadowOpacity: opacity,
          shadowRadius: radius,
        } : {};
      },
    };
  }, []);
  
  return platform;
};

