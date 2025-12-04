import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';

// Contextos
import { AuthProvider } from './src/contexts/AuthContext';
import { ValidationProvider } from './src/contexts/ValidationContext';

// Navegador de autenticación
import AuthNavigator from './src/components/AuthNavigator';

export default function App() {
  // Aplicar estilos globales para web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Agregar estilos globales para mejorar la experiencia web
      const style = document.createElement('style');
      style.textContent = `
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow-x: hidden;
        }
        #root {
          width: 100%;
          min-height: 100vh;
        }
        /* Mejorar scrollbar en web */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1A1A1A;
        }
        ::-webkit-scrollbar-thumb {
          background: #2196F3;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #1976D2;
        }
      `;
      document.head.appendChild(style);

      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, []);

  return (
    <PaperProvider>
      <AuthProvider>
        <ValidationProvider>
          <NavigationContainer>
            <View style={styles.appContainer}>
              <StatusBar style="auto" />
              <AuthNavigator />
            </View>
          </NavigationContainer>
        </ValidationProvider>
      </AuthProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
      width: '100%',
    }),
  },
});
