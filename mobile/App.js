import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

// Contextos
import { AuthProvider } from './src/contexts/AuthContext';
import { ValidationProvider } from './src/contexts/ValidationContext';

// Navegador de autenticación
import AuthNavigator from './src/components/AuthNavigator';

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <ValidationProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <AuthNavigator />
          </NavigationContainer>
        </ValidationProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
