import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, Platform } from 'react-native';
import { usePlatform } from '../hooks/usePlatform';

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
import AssignValidationScreen from '../screens/AssignValidationScreen';
import ActiveValidationsScreen from '../screens/ActiveValidationsScreen';
import AssignedValidationsScreen from '../screens/AssignedValidationsScreen';
import DamagedLabelScreen from '../screens/DamagedLabelScreen';
import DamagedLabelsListScreen from '../screens/DamagedLabelsListScreen';
import AuditoriaScreen from '../screens/AuditoriaScreen';
import StorageManagementScreen from '../screens/StorageManagementScreen';
import PDFPreviewScreen from '../screens/PDFPreviewScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { isWeb, isDesktop, maxWidth } = usePlatform();

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
          ...(isWeb && {
            maxWidth: maxWidth,
            alignSelf: 'center',
            width: '100%',
          }),
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        ...(isWeb && {
          headerMode: 'screen',
          cardStyle: {
            maxWidth: maxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        }),
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
            name="StorageManagement" 
            component={StorageManagementScreen} 
            options={{ title: 'Gestión de Almacenamiento' }}
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
          <Stack.Screen 
            name="AssignValidation" 
            component={AssignValidationScreen} 
            options={{ title: 'Asignar Validaciones' }}
          />
          <Stack.Screen 
            name="ActiveValidations" 
            component={ActiveValidationsScreen} 
            options={{ title: 'Estatus de Validaciones' }}
          />
          <Stack.Screen 
            name="AssignedValidations" 
            component={AssignedValidationsScreen} 
            options={{ title: 'Validaciones Asignadas' }}
          />
          <Stack.Screen 
            name="DamagedLabel" 
            component={DamagedLabelScreen} 
            options={{ title: 'Reportar Etiqueta NG' }}
          />
          <Stack.Screen 
            name="DamagedLabelsList" 
            component={DamagedLabelsListScreen} 
            options={{ title: 'Etiquetas NG Reportadas' }}
          />
          <Stack.Screen 
            name="Auditoria" 
            component={AuditoriaScreen} 
            options={{ title: 'Auditoría' }}
          />
          <Stack.Screen 
            name="PDFPreview" 
            component={PDFPreviewScreen} 
            options={{ title: 'Previsualización de PDF', headerShown: false }}
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
