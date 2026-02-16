import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';

// Contextos
import { LanguageProvider } from './src/contexts/LanguageContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { ValidationProvider } from './src/contexts/ValidationContext';

// Navegador de autenticación
import AuthNavigator from './src/components/AuthNavigator';

export default function App() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  // Escuchar actualizaciones del Service Worker
  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          setShowUpdateBanner(true);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);

      // También detectar cuando hay un nuevo SW esperando
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdateBanner(true);
              }
            });
          }
        });
      });

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  // Manejar errores globales en web (especialmente errores de extensiones del navegador)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Función helper para detectar errores de extensiones del navegador
      const isExtensionError = (error) => {
        if (!error) return false;
        
        const errorMessage = (error.message || error.toString() || String(error)).toLowerCase();
        const errorStack = (error.stack || '').toLowerCase();
        const fullError = (errorMessage + ' ' + errorStack);
        
        // Patrones comunes de errores de extensiones del navegador
        const extensionErrorPatterns = [
          'message channel closed',
          'asynchronous response',
          'listener indicated',
          'message channel',
          'extension context invalidated',
          'receiving end does not exist',
          'could not establish connection',
          'message port closed',
          'a listener indicated an asynchronous response by returning true'
        ];
        
        return extensionErrorPatterns.some(pattern => fullError.includes(pattern));
      };

      // Manejar promesas rechazadas (unhandled promise rejections)
      const handleUnhandledRejection = (event) => {
        if (isExtensionError(event.reason)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }
      };

      // Manejar errores globales
      const handleError = (event) => {
        if (isExtensionError(event.error) || isExtensionError(event.message)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }
      };

      // También capturar errores de console.error si es necesario
      const originalConsoleError = console.error;
      console.error = (...args) => {
        const errorString = args.map(arg => 
          typeof arg === 'object' && arg !== null 
            ? (arg.message || arg.toString() || JSON.stringify(arg))
            : String(arg)
        ).join(' ').toLowerCase();
        
        if (isExtensionError({ message: errorString })) {
          // Suprimir este error, no hacer nada
          return;
        }
        
        // Si no es un error de extensión, mostrar normalmente
        originalConsoleError.apply(console, args);
      };

      window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
      window.addEventListener('error', handleError, true);

      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
        window.removeEventListener('error', handleError, true);
        console.error = originalConsoleError;
      };
    }
  }, []);

  // Aplicar estilos globales para web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Agregar estilos globales para mejorar la experiencia web
      const style = document.createElement('style');
      style.textContent = `
        * {
          box-sizing: border-box;
        }
        html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background-color: #0F0F0F;
        }
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background-color: #0F0F0F;
        }
        #root {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          background-color: #0F0F0F;
          position: relative;
          overflow: auto;
        }
        /* Forzar que los contenedores flex permitan scroll */
        #root > div {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }
        /* Mejorar scrollbar en web */
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #1A1A1A;
        }
        ::-webkit-scrollbar-thumb {
          background: #2196F3;
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #1976D2;
        }
        /* Firefox scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: #2196F3 #1A1A1A;
        }
        /* Mejorar selección de texto */
        ::selection {
          background-color: #2196F3;
          color: #FFFFFF;
        }
        ::-moz-selection {
          background-color: #2196F3;
          color: #FFFFFF;
        }
        /* Prevenir zoom en inputs en iOS */
        @media screen and (max-width: 768px) {
          input, select, textarea {
            font-size: 16px !important;
          }
        }
        /* Prevenir bounce/overscroll en iOS PWA */
        html, body {
          overscroll-behavior: none;
        }
      `;
      document.head.appendChild(style);

      // Asegurar que el viewport esté configurado correctamente
      const viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        document.head.appendChild(meta);
      } else {
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      }

      // iOS PWA meta tags - standalone sin barra de Safari
      const iosPwaTags = [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'CheckApp' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'theme-color', content: '#2196F3' },
      ];
      iosPwaTags.forEach(({ name, content }) => {
        if (!document.querySelector(`meta[name="${name}"]`)) {
          const meta = document.createElement('meta');
          meta.name = name;
          meta.content = content;
          document.head.appendChild(meta);
        }
      });

      // Apple touch icon para el icono en pantalla de inicio
      if (!document.querySelector('link[rel="apple-touch-icon"]')) {
        const touchIcon = document.createElement('link');
        touchIcon.rel = 'apple-touch-icon';
        touchIcon.href = '/icon.png';
        document.head.appendChild(touchIcon);
      }

      // Link al manifest
      if (!document.querySelector('link[rel="manifest"]')) {
        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = '/manifest.json';
        document.head.appendChild(manifestLink);
      }

      // Registrar Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
      }

      // Agregar favicon link para evitar errores 404/500
      let faviconLink = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.type = 'image/png';
        faviconLink.href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAFXSURBVHgB7Za9DcIwEIZPkTBkAA8ISgZsBBOwAxsADAGMAEzABEDBCCADMAEwQUvBE7SNAxGH7CRn6fslR47v/ru7OwMAAAAAAAAAAAAAAAAAAABAuGAXOk/nfUQE19DJe7nve5fDcZzvzjn1V/YtnfP+E3wOJGKdo9Fokc/ny7FYLJ1Op/+sVquZdV1PG40GRQ05Gf1Po+VymXHO5UKh0L2UUg0Gg2+U9XpdnMvlUvF4/O1oNPqCPM9zOOfo6EiLiBHR1+t18eFw8IV4vV7fz2azj9fr9aN2u31ebjQaKiLv+75SKpVuz+ezm2QymTQajcc8hHjf96fTaS6RSGy3220xm82OrNbyzGfU9jcvFovj4/F4liTJdhFZr9fV+Xx+JCKLx+Mxn8/nYjab/fM6PCPq/X7vOo6zWC6XjVLp/H6/H/X7/U9vOpmuUqn0cbvdXr1er+skEonX6/X63u12v+y9X1Kqg8GgXC6Xr4/H46ff73e73a4Tj8ff2+32K0bpGGOMuX4BUFVVrVQq1W63+zIajT6lUqnbaDRaOBwOLUQIIYQQQgghhBBCCCGEEEIIIYQQQgghhBAihPwDWCBvsHdrXBcAAAAASUVORK5CYII=';
        document.head.appendChild(faviconLink);
      }

      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, []);

  return (
    <LanguageProvider>
      <PaperProvider>
        <AuthProvider>
          <ValidationProvider>
            <NavigationContainer theme={{
              ...DefaultTheme,
              colors: {
                ...DefaultTheme.colors,
                background: '#0F0F0F',
                card: '#1A1A1A',
                text: '#FFFFFF',
                border: '#333333',
              },
            }}>
              <View style={styles.appContainer}>
                <StatusBar style="auto" />
                <AuthNavigator />
                {showUpdateBanner && Platform.OS === 'web' && (
                  <TouchableOpacity style={styles.updateBanner} onPress={handleUpdate} activeOpacity={0.8}>
                    <Text style={styles.updateText}>Nueva versión disponible</Text>
                    <View style={styles.updateButton}>
                      <Text style={styles.updateButtonText}>Actualizar</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </NavigationContainer>
          </ValidationProvider>
        </AuthProvider>
      </PaperProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      margin: 0,
      padding: 0,
      height: '100dvh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0F0F0F',
      position: 'relative',
    }),
  },
  updateBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 20px rgba(33, 150, 243, 0.4)',
      zIndex: 9999,
      bottom: 'calc(24px + env(safe-area-inset-bottom))',
    }),
  },
  updateText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  updateButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
