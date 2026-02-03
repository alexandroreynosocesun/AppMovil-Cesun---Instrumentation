import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, Platform, StyleSheet } from 'react-native';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';

// Pantallas de autenticación
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SolicitudStatusScreen from '../screens/SolicitudStatusScreen';

// Pantallas principales
import ModuleSelectionScreen from '../screens/ModuleSelectionScreen';
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
import QuickRepairJigScreen from '../screens/QuickRepairJigScreen';
import AllJigsScreen from '../screens/AllJigsScreen';
import AssignValidationScreen from '../screens/AssignValidationScreen';
import ActiveValidationsScreen from '../screens/ActiveValidationsScreen';
import AssignedValidationsScreen from '../screens/AssignedValidationsScreen';
import DamagedLabelScreen from '../screens/DamagedLabelScreen';
import DamagedLabelsListScreen from '../screens/DamagedLabelsListScreen';
import AuditoriaScreen from '../screens/AuditoriaScreen';
import StorageManagementScreen from '../screens/StorageManagementScreen';
import PDFPreviewScreen from '../screens/PDFPreviewScreen';
// Pantallas de Adaptadores
import AdaptadoresHomeScreen from '../screens/AdaptadoresHomeScreen';
import QRScannerAdaptadores from '../screens/QRScannerAdaptadores';
import ListAdaptadoresScreen from '../screens/ListAdaptadoresScreen';
import ListConvertidoresScreen from '../screens/ListConvertidoresScreen';
import AdaptadorDetailScreen from '../screens/AdaptadorDetailScreen';
import AdaptadorModelDetailScreen from '../screens/AdaptadorModelDetailScreen';
import UpdateAdaptadorConectoresScreen from '../screens/UpdateAdaptadorConectoresScreen';
import AddAdaptadorScreen from '../screens/AddAdaptadorScreen';
import SearchMainboardScreen from '../screens/SearchMainboardScreen';
import ArduinoSequencesScreen from '../screens/ArduinoSequencesScreen';
// Pantallas VByOne / Mini LVDS / 2K LVDS
import VByOneHomeScreen from '../screens/VByOneHomeScreen';
import QRScannerVByOne from '../screens/QRScannerVByOne';
import ListVByOneCategoryScreen from '../screens/ListVByOneCategoryScreen';
import AddVByOneScreen from '../screens/AddVByOneScreen';
import UpdateVByOneUsageScreen from '../screens/UpdateVByOneUsageScreen';
// Pantalla de Inventario
import InventarioScreen from '../screens/InventarioScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { isWeb, isDesktop, maxWidth } = usePlatform();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, isWeb && webStyles.container]}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={[styles.navigatorContainer, isWeb && webStyles.container]}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1A1A1A',
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
              backgroundColor: '#0F0F0F',
            },
          }),
        }}
      >
      {isAuthenticated ? (
        // Pantallas cuando está autenticado
        <>
          <Stack.Screen 
            name="ModuleSelection" 
            component={ModuleSelectionScreen} 
            options={{ title: 'Seleccionar Módulo', headerShown: false }}
          />
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ headerShown: false }}
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
            name="QuickRepairJig" 
            component={QuickRepairJigScreen} 
            options={{ title: 'Reparar Jig Rápido' }}
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
          {/* Pantallas de Adaptadores */}
          <Stack.Screen 
            name="AdaptadoresHome" 
            component={AdaptadoresHomeScreen} 
            options={{ title: 'Adaptadores y Convertidores' }}
          />
          <Stack.Screen 
            name="QRScannerAdaptadores" 
            component={QRScannerAdaptadores} 
            options={{ title: 'Escanear QR' }}
          />
          <Stack.Screen 
            name="ListAdaptadores" 
            component={ListAdaptadoresScreen} 
            options={{ title: 'Adaptadores' }}
          />
          <Stack.Screen 
            name="ListConvertidores" 
            component={ListConvertidoresScreen} 
            options={{ title: 'Convertidores' }}
          />
          <Stack.Screen 
            name="AdaptadorDetail" 
            component={AdaptadorDetailScreen} 
            options={{ title: 'Detalles' }}
          />
          <Stack.Screen 
            name="AdaptadorModelDetail" 
            component={AdaptadorModelDetailScreen} 
            options={{ title: 'Detalles del Modelo' }}
          />
          <Stack.Screen 
            name="AddAdaptador" 
            component={AddAdaptadorScreen} 
            options={{ title: 'Agregar Adaptador/Convertidor' }}
          />
          <Stack.Screen 
            name="UpdateAdaptadorConectores" 
            component={UpdateAdaptadorConectoresScreen}
            options={{ title: 'Actualizar conectores' }}
          />
          <Stack.Screen 
            name="SearchMainboard" 
            component={SearchMainboardScreen} 
            options={{ title: 'Buscar Modelo Mainboard' }}
          />
          <Stack.Screen
            name="ArduinoSequences"
            component={ArduinoSequencesScreen}
            options={{ title: 'Arduino' }}
          />
          {/* Pantallas VByOne / Mini LVDS / 2K LVDS */}
          <Stack.Screen
            name="VByOneHome"
            component={VByOneHomeScreen}
            options={{ title: 'VByOne / Mini LVDS / 2K LVDS' }}
          />
          <Stack.Screen
            name="QRScannerVByOne"
            component={QRScannerVByOne}
            options={{ title: 'Escanear QR' }}
          />
          <Stack.Screen
            name="ListVByOneCategory"
            component={ListVByOneCategoryScreen}
            options={{ title: 'Lista' }}
          />
          <Stack.Screen
            name="AddVByOne"
            component={AddVByOneScreen}
            options={{ title: 'Agregar VByOne / Mini LVDS / 2K LVDS' }}
          />
          <Stack.Screen
            name="UpdateVByOneUsage"
            component={UpdateVByOneUsageScreen}
            options={{ title: 'Actualizar uso' }}
          />
          {/* Pantalla de Inventario */}
          <Stack.Screen
            name="Inventario"
            component={InventarioScreen}
            options={{ title: 'Inventario' }}
          />
        </>
      ) : (
        // Pantallas cuando no está autenticado
        <>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ title: 'Iniciar Sesión', headerShown: false }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  navigatorContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      minHeight: '100vh',
    }),
  },
});
