import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  StatusBar,
  Dimensions,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Platform
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
import { useValidation } from '../contexts/ValidationContext';
import { offlineService } from '../services/OfflineService';
import logger from '../utils/logger';
import { validationService } from '../services/ValidationService';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { validations, getValidationsByModel } = useValidation();
  const { isWeb, isDesktop, isTablet, maxWidth, containerPadding, gridColumns } = usePlatform();
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [hasAssignedValidations, setHasAssignedValidations] = useState(false);
  const [checkingAssignedValidations, setCheckingAssignedValidations] = useState(false);

  // Detectar validaciones en curso (modelos con validaciones pero sin completar)
  const getInProgressValidations = () => {
    if (!validations || validations.length === 0) {
      return [];
    }

    // Agrupar validaciones por modelo
    const modelGroups = validations.reduce((groups, validation) => {
      const model = validation.modelo_actual;
      if (model) {
        if (!groups[model]) {
          groups[model] = [];
        }
        groups[model].push(validation);
      }
      return groups;
    }, {});

    // Encontrar modelos que tienen validaciones pero menos de 14 (no completados)
    const inProgress = Object.keys(modelGroups).filter(model => {
      const count = modelGroups[model].length;
      return count > 0 && count < 14; // Tiene validaciones pero no está completo
    });

    // Retornar el primer modelo en progreso (o el más reciente)
    return inProgress.length > 0 ? [inProgress[0]] : [];
  };

  const inProgressModels = getInProgressValidations();
  const currentInProgressModel = inProgressModels.length > 0 ? inProgressModels[0] : null;

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
  }, [user]);

  // Función para verificar si el usuario tiene validaciones asignadas PENDIENTES
  // Solo cuenta las validaciones que:
  // 1. Están asignadas a este usuario (tecnico_asignado_id === user.id)
  // 2. NO están completadas (completada === false)
  // Estas validaciones son asignadas por ingenieros con rol "asignaciones"
  const checkAssignedValidations = async () => {
    try {
      setCheckingAssignedValidations(true);
      logger.info('🔄 [HomeScreen] Verificando validaciones asignadas PENDIENTES...');
      logger.info(`🔄 [HomeScreen] Usuario: ${user?.usuario} (ID: ${user?.id}), tipo: ${user?.tipo_usuario}`);
      
      const result = await validationService.getValidations();
      
      if (result.success) {
        // Manejar respuesta paginada o array directo
        let all = [];
        if (result.data) {
          if (Array.isArray(result.data)) {
            all = result.data;
            logger.info('✅ [HomeScreen] Data es un array directo');
          } else if (result.data.items && Array.isArray(result.data.items)) {
            all = result.data.items;
            logger.info('✅ [HomeScreen] Data es un objeto paginado, extrayendo items');
          } else {
            logger.warn('⚠️ [HomeScreen] Formato de datos inesperado:', result.data);
            all = [];
          }
        }
        
        logger.info(`📊 [HomeScreen] Total de validaciones recibidas: ${all.length}`);
        
        // Filtrar SOLO las validaciones asignadas a este usuario y que NO estén completadas (pendientes)
        // Estas son las asignadas por ingenieros con rol "asignaciones"
        const assignedPending = all.filter(v => {
          const isAssigned = v.tecnico_asignado_id === user?.id;
          const isPending = !v.completada;
          const matches = isAssigned && isPending;
          
          if (!matches) {
            logger.debug(`❌ [HomeScreen] Excluyendo validación ${v.id}: tecnico_asignado_id=${v.tecnico_asignado_id} !== user.id=${user?.id} O completada=${v.completada}`);
          }
          return matches;
        });
        
        logger.info(`✅ [HomeScreen] Validaciones asignadas PENDIENTES encontradas: ${assignedPending.length}`);
        logger.info(`📋 [HomeScreen] Detalles de validaciones pendientes:`);
        assignedPending.forEach(v => {
          logger.info(`  - ID: ${v.id}, Modelo: ${v.modelo_actual || 'N/A'}, Completada: ${v.completada}, Técnico asignado: ${v.tecnico_asignado_id}`);
        });
        
        // El botón solo se habilita si hay al menos una validación pendiente asignada
        setHasAssignedValidations(assignedPending.length > 0);
      } else {
        logger.error('❌ [HomeScreen] Error verificando validaciones:', result.error);
        setHasAssignedValidations(false);
      }
    } catch (error) {
      logger.error('❌ [HomeScreen] Error verificando validaciones:', error);
      setHasAssignedValidations(false);
    } finally {
      setCheckingAssignedValidations(false);
    }
  };

  useEffect(() => {
    // Verificar validaciones asignadas al cargar si es técnico/validaciones
    if (user && (user.tipo_usuario === 'tecnico' || user.tipo_usuario === 'validaciones' || user.tipo_usuario === 'validacion')) {
      checkAssignedValidations();
    }
  }, [user]);

  // Verificar validaciones asignadas cuando la pantalla recibe foco (al regresar de otra pantalla)
  useFocusEffect(
    React.useCallback(() => {
      if (user && (user.tipo_usuario === 'tecnico' || user.tipo_usuario === 'validaciones' || user.tipo_usuario === 'validacion')) {
        logger.info('🔄 [HomeScreen] Pantalla recibió foco, verificando validaciones asignadas...');
        checkAssignedValidations();
      }
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    // Verificar validaciones asignadas si es técnico/validaciones
    if (user?.tipo_usuario === 'tecnico' || user?.tipo_usuario === 'validaciones' || user?.tipo_usuario === 'validacion') {
      await checkAssignedValidations();
    }
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

  // Normalizar rol del usuario para comparaciones seguras
  const normalizedRole = (user?.tipo_usuario || '').toLowerCase().trim();

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      
      {/* Fondo con gradiente */}
      <LinearGradient
        colors={['#1A1A1A', '#2C2C2C', '#3C3C3C']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Header superior con diseño oscuro cool */}
      <View style={[styles.header, isWeb && { paddingHorizontal: containerPadding }]}>
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
        style={[styles.scrollView, isWeb && webStyles.scrollContainer]}
        contentContainerStyle={[
          styles.scrollContent,
          isWeb && {
            maxWidth: maxWidth,
            alignSelf: 'center',
            width: '100%',
            paddingHorizontal: containerPadding,
            paddingBottom: isWeb ? 100 : 180,
          }
        ]}
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
              <View style={styles.userInfoContainer}>
                <IconButton icon="account-badge" size={16} iconColor="#FFFFFF" />
                <Text style={styles.userInfo}>Rol: {user?.tipo_usuario}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Botón de Continuar Validación en Curso - Solo para técnicos */}
        {currentInProgressModel && (normalizedRole === 'tecnico' || normalizedRole === 'validaciones') && (
          <Animated.View
            style={[
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              { marginBottom: 12 }
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                const modelValidations = getValidationsByModel(currentInProgressModel);
                navigation.navigate('Reporte', {
                  modelValidations: modelValidations,
                  currentModel: currentInProgressModel
                });
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF9800', '#F57C00', '#E65100']}
                style={styles.assignButtonCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.assignButtonContent}>
                  <View style={styles.assignButtonLeft}>
                    <IconButton icon="play-circle-outline" size={32} iconColor="#FFFFFF" />
                    <View style={styles.assignButtonTextContainer}>
                      <Text style={styles.assignButtonTitle}>
                        Continuar validación {currentInProgressModel}
                      </Text>
                      <Text style={styles.assignButtonSubtitle}>
                        {getValidationsByModel(currentInProgressModel).length} validaciones registradas
                      </Text>
                    </View>
                  </View>
                  <IconButton icon="chevron-right" size={24} iconColor="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Botones para Asignaciones */}
        {normalizedRole === 'asignaciones' && (
          <>
            {/* Botón de Asignar Validaciones */}
            <Animated.View
              style={[
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                { marginBottom: 12 }
              ]}
            >
              <TouchableOpacity
                onPress={() => navigation.navigate('AssignValidation')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2196F3', '#1976D2', '#0D47A1']}
                  style={styles.assignButtonCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.assignButtonContent}>
                    <View style={styles.assignButtonLeft}>
                      <IconButton icon="account-plus" size={32} iconColor="#FFFFFF" />
                      <View style={styles.assignButtonTextContainer}>
                        <Text style={styles.assignButtonTitle}>Asignar Validaciones</Text>
                        <Text style={styles.assignButtonSubtitle}>
                          Asigna validaciones a técnicos por número de empleado
                        </Text>
                      </View>
                    </View>
                    <IconButton icon="chevron-right" size={24} iconColor="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Botón de Estatus de Validaciones */}
            <Animated.View
              style={[
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                { marginBottom: 20 }
              ]}
            >
              <TouchableOpacity
                onPress={() => navigation.navigate('ActiveValidations')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#4CAF50', '#388E3C', '#1B5E20']}
                  style={styles.assignButtonCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.assignButtonContent}>
                    <View style={styles.assignButtonLeft}>
                      <IconButton icon="check-circle-outline" size={32} iconColor="#FFFFFF" />
                      <View style={styles.assignButtonTextContainer}>
                        <Text style={styles.assignButtonTitle}>Estatus de Validaciones</Text>
                        <Text style={styles.assignButtonSubtitle}>
                          Revisa las validaciones que has asignado
                        </Text>
                      </View>
                    </View>
                    <IconButton icon="chevron-right" size={24} iconColor="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {/* Botón para técnicos / validaciones: Validaciones asignadas */}
        {(normalizedRole === 'tecnico' || normalizedRole === 'validaciones' || normalizedRole === 'validacion') && (
          <Animated.View
            style={[
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              { marginBottom: 20 }
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                if (hasAssignedValidations) {
                  navigation.navigate('AssignedValidations');
                }
              }}
              activeOpacity={hasAssignedValidations ? 0.8 : 0.5}
              disabled={!hasAssignedValidations}
            >
              <LinearGradient
                colors={hasAssignedValidations 
                  ? ['#4CAF50', '#388E3C', '#1B5E20']
                  : ['#666666', '#555555', '#444444']
                }
                style={[
                  styles.assignButtonCard,
                  !hasAssignedValidations && styles.assignButtonCardDisabled
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.assignButtonContent}>
                  <View style={styles.assignButtonLeft}>
                    <IconButton 
                      icon="clipboard-text-outline" 
                      size={32} 
                      iconColor={hasAssignedValidations ? "#FFFFFF" : "#CCCCCC"} 
                    />
                    <View style={styles.assignButtonTextContainer}>
                      <Text style={[
                        styles.assignButtonTitle,
                        !hasAssignedValidations && styles.assignButtonTitleDisabled
                      ]}>
                        Validaciones asignadas
                      </Text>
                      <Text style={[
                        styles.assignButtonSubtitle,
                        !hasAssignedValidations && styles.assignButtonSubtitleDisabled
                      ]}>
                        {hasAssignedValidations 
                          ? 'Consulta y valida las asignaciones pendientes'
                          : 'No tienes validaciones pendientes asignadas'
                        }
                      </Text>
                    </View>
                  </View>
                  {checkingAssignedValidations ? (
                    <ActivityIndicator size="small" color={hasAssignedValidations ? "#FFFFFF" : "#CCCCCC"} />
                  ) : (
                    <IconButton 
                      icon="chevron-right" 
                      size={24} 
                      iconColor={hasAssignedValidations ? "#FFFFFF" : "#CCCCCC"} 
                    />
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

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
                    <Text style={styles.infoTitle}>Sistema de Auditoría</Text>
                    <Text style={styles.infoText}>Todos los PDFs se almacenan para auditoría</Text>
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

          {/* Botón de Auditoría */}
          <TouchableOpacity 
            style={styles.bottomButtonTouchable}
            onPress={() => navigation.navigate('Auditoria')}
          >
            <View style={styles.bottomButtonContent}>
              <IconButton icon="file-document-multiple" size={24} iconColor="#9C27B0" />
              <Text style={styles.bottomButtonLabel}>Auditoría</Text>
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
          {/* Si es adminAlex, solo mostrar Admin y Salir */}
          {user?.usuario === 'adminAlex' ? (
            <>
              {/* Botón de administración - solo para adminAlex */}
              <TouchableOpacity 
                style={[styles.additionalButtonTouchable, { borderColor: '#FF9800' }]}
                onPress={() => navigation.navigate('Admin')}
              >
                <IconButton icon="shield-account" size={20} iconColor="#FF9800" />
                <Text style={[styles.additionalButtonText, { color: '#FF9800' }]}>Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.logoutButtonTouchable}
                onPress={handleLogout}
              >
                <IconButton icon="logout" size={20} iconColor="#F44336" />
                <Text style={[styles.additionalButtonText, { color: '#F44336' }]}>Salir</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Botón Escanear NG - Solo para técnicos */}
              {(normalizedRole === 'tecnico' || normalizedRole === 'validaciones') && (
                <TouchableOpacity 
                  style={[styles.additionalButtonTouchable, { borderColor: '#F44336' }]}
                  onPress={() => navigation.navigate('QRScanner', { mode: 'ng' })}
                >
                  <IconButton icon="qrcode-scan" size={20} iconColor="#F44336" />
                  <Text style={[styles.additionalButtonText, { color: '#F44336' }]}>Escanear NG</Text>
                </TouchableOpacity>
              )}

              {/* Botón de asignar validaciones - solo para asignaciones */}
              {user?.tipo_usuario === 'asignaciones' && (
                <TouchableOpacity 
                  style={[styles.additionalButtonTouchable, { borderColor: '#9C27B0' }]}
                  onPress={() => navigation.navigate('AssignValidation')}
                >
                  <IconButton icon="account-plus" size={20} iconColor="#9C27B0" />
                  <Text style={[styles.additionalButtonText, { color: '#9C27B0' }]}>Asignar</Text>
                </TouchableOpacity>
              )}

              {/* Botón para reportar etiqueta NG - técnicos y gestión (no adminAlex) */}
              {(normalizedRole === 'tecnico' || normalizedRole === 'validaciones' || user?.tipo_usuario === 'gestion' || user?.tipo_usuario === 'Gestion') && user?.usuario !== 'adminAlex' && (
                <TouchableOpacity 
                  style={[styles.additionalButtonTouchable, { borderColor: '#FF5722' }]}
                  onPress={() => navigation.navigate('DamagedLabel')}
                >
                  <IconButton icon="label-off" size={20} iconColor="#FF5722" />
                  <Text style={[styles.additionalButtonText, { color: '#FF5722' }]}>Etiqueta NG</Text>
                </TouchableOpacity>
              )}

              {/* Botón para ver reportes - solo gestión */}
              {(user?.tipo_usuario === 'gestion' || user?.tipo_usuario === 'Gestion') && (
                <TouchableOpacity 
                  style={[styles.additionalButtonTouchable, { borderColor: '#9C27B0' }]}
                  onPress={() => navigation.navigate('DamagedLabelsList')}
                >
                  <IconButton icon="format-list-bulleted" size={20} iconColor="#9C27B0" />
                  <Text style={[styles.additionalButtonText, { color: '#9C27B0' }]}>Ver Reportes</Text>
                </TouchableOpacity>
              )}

              {/* Botón de administración - solo para usuarios admin (no adminAlex aquí, ya está arriba) */}
              {(user?.usuario === 'admin' || user?.usuario === 'superadmin') && (
                <TouchableOpacity 
                  style={[styles.additionalButtonTouchable, { borderColor: '#FF9800' }]}
                  onPress={() => navigation.navigate('Admin')}
                >
                  <IconButton icon="shield-account" size={20} iconColor="#FF9800" />
                  <Text style={[styles.additionalButtonText, { color: '#FF9800' }]}>Admin</Text>
                </TouchableOpacity>
              )}

              {/* Botón de gestión de almacenamiento - solo para adminAlex */}
              {user?.usuario === 'adminAlex' && (
                <TouchableOpacity 
                  style={[styles.additionalButtonTouchable, { borderColor: '#4CAF50' }]}
                  onPress={() => navigation.navigate('StorageManagement')}
                >
                  <IconButton icon="database" size={20} iconColor="#4CAF50" />
                  <Text style={[styles.additionalButtonText, { color: '#4CAF50' }]}>Almacenamiento</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.logoutButtonTouchable}
                onPress={handleLogout}
              >
                <IconButton icon="logout" size={20} iconColor="#F44336" />
                <Text style={[styles.additionalButtonText, { color: '#F44336' }]}>Salir</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    // Estilos responsive se aplican dinámicamente desde webStyles
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
    // Padding responsive se aplica dinámicamente
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
    // En web, centrar y limitar ancho
    ...(Platform.OS === 'web' && {
      maxWidth: 1400,
      alignSelf: 'center',
      width: '100%',
    }),
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#B0B0B0',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  assignButtonCardDisabled: {
    opacity: 0.6,
  },
  assignButtonCard: {
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 20,
  },
  assignButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  assignButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assignButtonTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  assignButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  assignButtonSubtitleDisabled: {
    color: '#999999',
  },
  assignButtonSubtitle: {
    fontSize: 14,
    color: '#E1BEE7',
    lineHeight: 18,
  },
  assignButtonSubtitleDisabled: {
    color: '#999999',
  },
});
