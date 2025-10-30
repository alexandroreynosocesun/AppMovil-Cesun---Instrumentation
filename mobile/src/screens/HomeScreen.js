import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  StatusBar,
  Dimensions,
  Animated,
  TouchableOpacity
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  FAB,
  Chip,
  Surface,
  Text,
  IconButton,
  Avatar,
  Divider
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { offlineService } from '../services/OfflineService';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    // Verificar estado de conexión
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    // Animaciones de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Aquí se podrían cargar datos actualizados
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          onPress: logout
        }
      ]
    );
  };

  const handleScanQR = () => {
    navigation.navigate('QRScanner');
  };

  const handleViewAllJigs = () => {
    navigation.navigate('AllJigs');
  };

  const handleViewProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      
      {/* Fondo con gradiente */}
      <LinearGradient
        colors={['#1A1A1A', '#2C2C2C', '#3C3C3C']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Header superior con diseño oscuro cool */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#1A1A1A', '#2C2C2C', '#1A1A1A']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Animated.Text 
              style={[
                styles.headerTitle,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              🔧 Validación de Jigs
            </Animated.Text>
            <Animated.Text 
              style={[
                styles.headerSubtitle,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              Departamento de Instrumentación
            </Animated.Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]} />
              <Chip 
                icon={isOnline ? "wifi" : "wifi-off"}
                mode="outlined"
                style={[styles.statusChip, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}
                textStyle={{ color: isOnline ? '#4CAF50' : '#F44336', fontSize: 12, fontWeight: 'bold' }}
              >
                {isOnline ? 'Online' : 'Offline'}
              </Chip>
            </View>
          </View>
        </View>
        {/* Línea decorativa inferior con gradiente */}
        <LinearGradient
          colors={['#2196F3', '#4CAF50', '#FF9800', '#F44336']}
          style={styles.headerBottomLine}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </View>

      {/* Contenido principal */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Mensaje de bienvenida con gradiente */}
        <Animated.View 
          style={[
            styles.welcomeSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#2196F3', '#1976D2', '#0D47A1']}
            style={styles.welcomeCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeText}>¡Bienvenido!</Text>
              <Text style={styles.userName}>{user?.nombre}</Text>
              <View style={styles.userInfoContainer}>
                <IconButton icon="clock-outline" size={16} iconColor="#FFFFFF" />
                <Text style={styles.userInfo}>Turno: {user?.turno_actual || 'N/A'}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Información del sistema con mejor diseño */}
        <Animated.View
          style={[
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Card style={styles.infoCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <IconButton icon="information" size={24} iconColor="#2196F3" />
                <Title style={styles.cardTitle}>Información del Sistema</Title>
              </View>
              <Divider style={styles.divider} />
              <View style={styles.infoList}>
                <TouchableOpacity style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <IconButton icon="qrcode-scan" size={24} iconColor="#2196F3" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoTitle}>Escanear QR</Text>
                    <Text style={styles.infoText}>Escanea el código QR del jig para validar</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <IconButton icon="wifi-off" size={24} iconColor="#4CAF50" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoTitle}>Modo Offline</Text>
                    <Text style={styles.infoText}>Funciona offline y sincroniza automáticamente</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <IconButton icon="file-pdf-box" size={24} iconColor="#F44336" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoTitle}>Reportes PDF</Text>
                    <Text style={styles.infoText}>Genera reportes PDF automáticamente</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <IconButton icon="upload" size={24} iconColor="#FF9800" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoTitle}>Integración Asana</Text>
                    <Text style={styles.infoText}>Se suben automáticamente a Asana</Text>
                  </View>
                </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
        </Animated.View>
      </ScrollView>


      {/* Barra de botones inferior con gradiente */}
      <LinearGradient
        colors={['#2C2C2C', '#1A1A1A']}
        style={styles.bottomBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.bottomButtons}>
          {/* Botón de Todos los Jigs */}
          <TouchableOpacity 
            style={styles.bottomButtonTouchable}
            onPress={handleViewAllJigs}
          >
            <View style={styles.bottomButtonContent}>
              <IconButton icon="package-variant" size={24} iconColor="#FFFFFF" />
              <Text style={styles.bottomButtonLabel}>Todos los Jigs</Text>
            </View>
          </TouchableOpacity>

          {/* Botón de Jigs NG */}
          <TouchableOpacity 
            style={styles.bottomButtonTouchable}
            onPress={() => navigation.navigate('JigNG')}
          >
            <View style={styles.bottomButtonContent}>
              <IconButton icon="alert-circle" size={24} iconColor="#FF9800" />
              <Text style={styles.bottomButtonLabel}>Jigs NG</Text>
            </View>
          </TouchableOpacity>

          {/* Botón central de Escanear QR */}
          <TouchableOpacity 
            style={styles.centerBottomButtonTouchable}
              onPress={handleScanQR}
          >
            <LinearGradient
              colors={['#2196F3', '#1976D2', '#0D47A1']}
              style={styles.centerBottomButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <IconButton icon="qrcode-scan" size={28} iconColor="#FFFFFF" />
              <Text style={styles.centerBottomButtonText}>Escanear</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Botón de Reportes */}
          <TouchableOpacity 
            style={styles.bottomButtonTouchable}
            onPress={() => navigation.navigate('Reporte')}
          >
            <View style={styles.bottomButtonContent}>
              <IconButton icon="file-document" size={24} iconColor="#4CAF50" />
              <Text style={styles.bottomButtonLabel}>Reportes</Text>
            </View>
          </TouchableOpacity>

          {/* Botón de Perfil */}
          <TouchableOpacity 
            style={styles.bottomButtonTouchable}
              onPress={handleViewProfile}
          >
            <View style={styles.bottomButtonContent}>
              <IconButton icon="account" size={24} iconColor="#2196F3" />
              <Text style={styles.bottomButtonLabel}>Perfil</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Botones adicionales */}
        <View style={styles.additionalButtons}>
          <TouchableOpacity 
            style={[styles.additionalButtonTouchable, { borderColor: '#F44336' }]}
              onPress={() => navigation.navigate('QRScanner', { mode: 'ng' })}
          >
            <IconButton icon="qrcode-scan" size={20} iconColor="#F44336" />
            <Text style={[styles.additionalButtonText, { color: '#F44336' }]}>Escanear NG</Text>
          </TouchableOpacity>

            {/* Botón de administración - solo para usuarios admin */}
            {(user?.usuario === 'admin' || user?.usuario === 'superadmin') && (
            <TouchableOpacity 
              style={[styles.additionalButtonTouchable, { borderColor: '#FF9800' }]}
                onPress={() => navigation.navigate('Admin')}
            >
              <IconButton icon="shield-account" size={20} iconColor="#FF9800" />
              <Text style={[styles.additionalButtonText, { color: '#FF9800' }]}>Admin</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.logoutButtonTouchable}
          onPress={handleLogout}
          >
            <IconButton icon="logout" size={20} iconColor="#F44336" />
            <Text style={[styles.additionalButtonText, { color: '#F44336' }]}>Salir</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    paddingTop: 15,
    paddingBottom: 20,
    position: 'relative',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  statusChip: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerBottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 180,
  },
  welcomeSection: {
    marginBottom: 30,
  },
  welcomeCard: {
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  welcomeContent: {
    alignItems: 'center',
    paddingVertical: 25,
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  userName: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    fontSize: 16,
    color: '#E3F2FD',
    marginLeft: 4,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#2C2C2C',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  divider: {
    backgroundColor: '#3C3C3C',
    marginBottom: 15,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#3C3C3C',
    marginBottom: 8,
  },
  infoIconContainer: {
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoText: {
    color: '#B0B0B0',
    fontSize: 14,
    lineHeight: 20,
  },
  centerBottomButtonTouchable: {
    elevation: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  centerBottomButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  centerBottomButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingTop: 20,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  bottomButtonTouchable: {
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  bottomButtonContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  bottomButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  additionalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  additionalButtonTouchable: {
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  additionalButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  logoutButtonTouchable: {
    marginLeft: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
