import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { usePlatform } from '../hooks/usePlatform';

/**
 * Componente wrapper para contenedores web
 * Proporciona un contenedor responsive centrado para web
 */
export default function WebContainer({ children, style }) {
  const { isWeb, isDesktop, maxWidth, containerPadding } = usePlatform();

  if (!isWeb) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={[styles.webContainer, { maxWidth, paddingHorizontal: containerPadding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
    }),
  },
});

