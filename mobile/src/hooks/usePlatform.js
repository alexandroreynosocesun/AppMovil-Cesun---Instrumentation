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
      
      // Configuraciones específicas
      canUseCamera: !isWeb,
      canUseQRScanner: !isWeb,
      canUseFileSystem: !isWeb,
      useDesktopLayout: isWeb,
      useSecureStore: !isWeb,
      
      // Configuraciones de UI
      maxWidth: isWeb ? 1400 : '100%',
      containerPadding: isWeb ? 24 : 16,
      gridColumns: isDesktop ? 3 : isTablet ? 2 : 1,
      cardMaxWidth: isDesktop ? 400 : isTablet ? 350 : '100%',
      
      // Helper functions
      getResponsiveStyle: (mobileStyle, webStyle) => {
        return isWeb ? { ...mobileStyle, ...webStyle } : mobileStyle;
      },
    };
  }, []);
  
  return platform;
};

