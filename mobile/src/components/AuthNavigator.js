import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// Pantallas de autenticación
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SolicitudStatusScreen from '../screens/SolicitudStatusScreen';

// Pantallas principales
import HomeScreen from '../screens/HomeScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import ValidationScreen from '../screens/ValidationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddJigScreen from '../screens/AddJigScreen';
import AdminScreen from '../screens/AdminScreen';
import AdminSolicitudesScreen from '../screens/AdminSolicitudesScreen';
import ReporteScreen from '../screens/ReporteScreen';
import JigNGScreen from '../screens/JigNGScreen';
import AddJigNGScreen from '../screens/AddJigNGScreen';
import JigNGDetailScreen from '../screens/JigNGDetailScreen';
import RepairJigScreen from '../screens/RepairJigScreen';
import AllJigsScreen from '../screens/AllJigsScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {isAuthenticated ? (
        // Pantallas cuando está autenticado
        <>
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'Validación de Jigs' }}
          />
          <Stack.Screen 
            name="QRScanner" 
            component={QRScannerScreen} 
            options={{ title: 'Escanear QR' }}
          />
          <Stack.Screen 
            name="Validation" 
            component={ValidationScreen} 
            options={{ title: 'Validar Jig' }}
          />
          <Stack.Screen 
            name="Profile" 
            component={ProfileScreen} 
            options={{ title: 'Perfil' }}
          />
          <Stack.Screen 
            name="AddJig" 
            component={AddJigScreen} 
            options={{ title: 'Agregar Jig' }}
          />
          <Stack.Screen 
            name="Admin" 
            component={AdminScreen} 
            options={{ title: 'Panel de Administración' }}
          />
          <Stack.Screen 
            name="AdminSolicitudes" 
            component={AdminSolicitudesScreen} 
            options={{ title: 'Solicitudes de Registro' }}
          />
          <Stack.Screen 
            name="Reporte" 
            component={ReporteScreen} 
            options={{ title: 'Reporte de Validación' }}
          />
          <Stack.Screen 
            name="JigNG" 
            component={JigNGScreen} 
            options={{ title: 'Jigs NG' }}
          />
          <Stack.Screen 
            name="AddJigNG" 
            component={AddJigNGScreen} 
            options={{ title: 'Agregar Jig NG' }}
          />
          <Stack.Screen 
            name="JigNGDetail" 
            component={JigNGDetailScreen} 
            options={{ title: 'Detalles Jig NG' }}
          />
          <Stack.Screen 
            name="RepairJig" 
            component={RepairJigScreen} 
            options={{ title: 'Reparar Jig' }}
          />
          <Stack.Screen 
            name="AllJigs" 
            component={AllJigsScreen} 
            options={{ title: 'Todos los Jigs' }}
          />
        </>
      ) : (
        // Pantallas cuando no está autenticado
        <>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ title: 'Iniciar Sesión' }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen} 
            options={{ title: 'Registro de Usuario' }}
          />
          <Stack.Screen 
            name="SolicitudStatus" 
            component={SolicitudStatusScreen} 
            options={{ title: 'Estado de Solicitud' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
