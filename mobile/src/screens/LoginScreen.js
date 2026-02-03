import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
  Modal,
  StatusBar
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  Surface,
  Text
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { authService } from '../services/AuthService';
import logger from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isBiometricAvailable,
  saveBiometricCredentials,
  getBiometricCredentials,
  authenticateWithBiometrics,
  removeBiometricCredentials
} from '../utils/biometricAuth';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { t, changeLanguage, hasLanguagePreference } = useLanguage();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  
  // Estados para selector de usuarios
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Estados para autenticación biométrica
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  
  // Estados para selector de idioma
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  // Animaciones
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Verificar si hay idioma guardado
    checkLanguagePreference();
    
    // Cargar usuarios al montar
    loadUsers();
    
    // Verificar autenticación biométrica
    checkBiometricAvailability();
    checkSavedCredentials();
  }, []);
  
  // Verificar preferencia de idioma
  const checkLanguagePreference = async () => {
    try {
      const hasPreference = await hasLanguagePreference();
      if (!hasPreference) {
        // Primera vez - mostrar modal de idioma
        setShowLanguageModal(true);
      }
    } catch (error) {
      logger.error('Error checking language preference:', error);
      // En caso de error, mostrar modal para asegurar que el usuario elija
      setShowLanguageModal(true);
    }
  };
  
  // Manejar selección de idioma
  const handleLanguageSelect = async (lang) => {
    try {
      await changeLanguage(lang);
      setShowLanguageModal(false);
    } catch (error) {
      logger.error('Error selecting language:', error);
    }
  };

  // Cargar usuarios para el selector
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      logger.info('🔄 [loadUsers] Iniciando carga de usuarios para selector...');
      const result = await authService.getUsersForLogin();
      
      if (result.success) {
        // El endpoint puede devolver { users: [...] } o directamente un array
        const usersData = result.data?.users || (Array.isArray(result.data) ? result.data : []);
        
        if (usersData.length > 0) {
          setUsers(usersData);
          logger.info(`✅ [loadUsers] ${usersData.length} usuarios cargados para selector`);
        } else {
          logger.warn('⚠️ [loadUsers] No se encontraron usuarios en la respuesta');
          setUsers([]);
        }
      } else {
        logger.warn(`⚠️ [loadUsers] No se pudieron cargar usuarios para selector. Error: ${result.error || 'Desconocido'}`);
        setUsers([]);
      }
    } catch (error) {
      logger.error('❌ [loadUsers] Error cargando usuarios:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };


  // Seleccionar usuario
  const handleSelectUser = (selectedUser) => {
    setUsuario(selectedUser.usuario);
    setShowUserModal(false);
  };

  // Verificar disponibilidad de autenticación biométrica
  const checkBiometricAvailability = async () => {
    const status = await isBiometricAvailable();
    setBiometricAvailable(status.available);
    setBiometricType(status.type || '');
  };

  // Verificar si hay credenciales guardadas
  const checkSavedCredentials = async () => {
    const credentials = await getBiometricCredentials();
    setHasSavedCredentials(credentials !== null);
  };

  // Función para login biométrico
  const handleBiometricLogin = async () => {
    try {
      // Primero autenticar con biometría
      const authResult = await authenticateWithBiometrics();
      if (!authResult.success) {
        if (authResult.error !== 'Autenticación cancelada') {
          Alert.alert('Error', authResult.error);
        }
        return;
      }

      // Obtener credenciales guardadas
      const credentials = await getBiometricCredentials();
      if (!credentials) {
        Alert.alert('Error', 'No hay credenciales guardadas');
        return;
      }

      // Hacer login con las credenciales guardadas
      setLoading(true);
      const result = await login(credentials.usuario, credentials.password);
      
      if (result.success) {
        setTimeout(() => {
          navigation.navigate('ModuleSelection');
        }, 100);
      } else {
        Alert.alert('Error', result.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      logger.error('Error en login biométrico:', error);
      Alert.alert('Error', 'Error en autenticación biométrica');
    } finally {
      setLoading(false);
    }
  };

  // Función para guardar credenciales después del login exitoso
  const handleSaveBiometricCredentials = async () => {
    Alert.alert(
      'Guardar credenciales',
      `¿Deseas guardar tus credenciales para usar ${biometricType} en futuros inicios de sesión?`,
      [
        {
          text: 'No',
          style: 'cancel'
        },
        {
          text: 'Sí',
          onPress: async () => {
            const saved = await saveBiometricCredentials(usuario, password);
            if (saved) {
              setHasSavedCredentials(true);
              Alert.alert('Éxito', 'Credenciales guardadas. Podrás usar autenticación biométrica en futuros inicios de sesión.');
            } else {
              Alert.alert('Error', 'No se pudieron guardar las credenciales');
            }
          }
        }
      ]
    );
  };

  const handleLogin = async () => {
    if (!usuario.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const result = await login(usuario, password);
      
      if (result.success) {
        // Si no hay credenciales guardadas y la biometría está disponible, ofrecer guardar
        if (!hasSavedCredentials && biometricAvailable) {
          setTimeout(() => {
            handleSaveBiometricCredentials();
          }, 500);
        }
        
        // Pequeño delay para asegurar que el contexto se actualice
        setTimeout(() => {
          navigation.navigate('ModuleSelection');
        }, 100);
      } else {
        Alert.alert('Error', result.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
      >
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContainer,
            isWeb && {
              maxWidth: maxWidth,
              alignSelf: 'center',
              width: '100%',
              paddingHorizontal: containerPadding,
            }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header con animación */}
          <Animated.View 
            style={[
              styles.headerContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#1A1A1A', '#2D2D2D', '#1A1A1A']}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.headerContent}>
              <Title style={styles.headerTitle}>{t('appName')}</Title>
              <Paragraph style={styles.headerSubtitle}>
                {t('appSubtitle')}
              </Paragraph>
              <View style={styles.headerLine} />
            </View>
          </Animated.View>

          {/* Card principal con animación */}
          <Animated.View
            style={[
              styles.cardContainer,
              isWeb && webStyles.authCard,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            <Surface style={[styles.card, isWeb && webStyles.authCard]} elevation={8}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.formContainer}>
                  <TouchableOpacity 
                    onPress={() => setShowUserModal(true)}
                    activeOpacity={0.7}
                  >
                    <View pointerEvents="none">
                      <TextInput
                        label={t('username')}
                        value={usuario}
                        mode="outlined"
                        style={[styles.input, { color: '#F5F5F5' }]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={false}
                        textContentType="username"
                        autoComplete="username"
                        theme={{
                          colors: {
                            primary: '#4A4A4A',
                            background: 'transparent',
                            surface: '#0F0F0F',
                            text: '#F5F5F5',
                            placeholder: '#666666',
                            onSurface: '#F5F5F5',
                          }
                        }}
                        outlineColor="#333333"
                        activeOutlineColor="#4A4A4A"
                        textColor="#F5F5F5"
                        right={<TextInput.Icon icon="chevron-down" color="#888888" />}
                      />
                    </View>
                  </TouchableOpacity>
                  
                  <TextInput
                    label={t('password')}
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    style={[styles.input, { color: '#F5F5F5' }]}
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="password"
                    autoComplete="password"
                    passwordRules="required: upper; required: lower; required: digit; minlength: 6;"
                    theme={{
                      colors: {
                        primary: '#4A4A4A',
                        background: 'transparent',
                        surface: '#0F0F0F',
                        text: '#F5F5F5',
                        placeholder: '#666666',
                        onSurface: '#F5F5F5',
                      }
                    }}
                    outlineColor="#333333"
                    activeOutlineColor="#4A4A4A"
                    textColor="#F5F5F5"
                  />
                  
                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#2D2D2D', '#1A1A1A', '#0F0F0F']}
                      style={styles.loginButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#E0E0E0" size="small" />
                      ) : (
                        <Text style={styles.loginButtonText}>
                          {t('loginButton')}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Botón de Login Biométrico */}
                  {biometricAvailable && hasSavedCredentials && (
                    <View style={styles.biometricContainer}>
                      <TouchableOpacity
                        style={styles.biometricButton}
                        onPress={handleBiometricLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name={Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint'}
                          size={32}
                          color="#FFFFFF"
                          style={styles.biometricIcon}
                        />
                        <Text style={styles.biometricButtonText}>
                          Usar {biometricType}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Opción para eliminar credenciales guardadas */}
                  {hasSavedCredentials && (
                    <TouchableOpacity
                      onPress={async () => {
                        Alert.alert(
                          'Eliminar credenciales',
                          '¿Deseas eliminar las credenciales guardadas?',
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Eliminar',
                              style: 'destructive',
                              onPress: async () => {
                                await removeBiometricCredentials();
                                setHasSavedCredentials(false);
                                Alert.alert('Éxito', 'Credenciales eliminadas');
                              }
                            }
                          ]
                        );
                      }}
                      style={styles.removeCredentialsButton}
                    >
                      <Text style={styles.removeCredentialsText}>
                        Eliminar credenciales guardadas
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => navigation.navigate('Register')}
                    disabled={loading}
                  >
                    <Text style={styles.registerButtonText}>
                      {t('registerButton')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Surface>
          </Animated.View>

          {/* Footer decorativo */}
          <Animated.View 
            style={[
              styles.footerContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#1A1A1A', '#2D2D2D', '#1A1A1A']}
              style={styles.footerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Text style={styles.footerText}>
              Version 1.0 · Todos los derechos reservados · © 2026.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal para seleccionar usuario */}
      <Modal
        visible={showUserModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowUserModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalScrollContainer}>
              <ScrollView 
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {loadingUsers ? (
                  <View style={styles.emptyState}>
                    <ActivityIndicator color="#4A7BA7" size="large" />
                    <Text style={styles.emptyStateText}>Cargando usuarios...</Text>
                  </View>
                ) : users.length > 0 ? (
                  users.map((user, index) => {
                    const isSelected = usuario === user.usuario;
                    return (
                      <TouchableOpacity
                        key={`user-${user.usuario}-${index}`}
                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        onPress={() => handleSelectUser(user)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.modalItemContent}>
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                            {user.usuario}
                          </Text>
                          {user.numero_empleado && (
                            <Text style={[styles.modalItemSubtext, isSelected && styles.modalItemSubtextSelected]}>
                              Empleado: {user.numero_empleado}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No hay usuarios disponibles</Text>
                  </View>
                )}
              </ScrollView>
            </View>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowUserModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar idioma (primera vez) */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}} // No permitir cerrar sin seleccionar
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalLanguageContent}>
            <View style={styles.modalLanguageHeader}>
              <Title style={styles.modalLanguageTitle}>
                {t('selectLanguage')}
              </Title>
            </View>
            
            <View style={styles.modalLanguageOptions}>
              <TouchableOpacity
                style={[styles.modalLanguageOption]}
                onPress={() => handleLanguageSelect('es')}
                activeOpacity={0.7}
              >
                <View style={styles.modalLanguageOptionContent}>
                  <Text style={styles.modalLanguageOptionText}>🇪🇸 {t('spanish')}</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalLanguageOption]}
                onPress={() => handleLanguageSelect('en')}
                activeOpacity={0.7}
              >
                <View style={styles.modalLanguageOptionContent}>
                  <Text style={styles.modalLanguageOptionText}>🇬🇧 {t('english')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
      height: '100%',
    }),
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }),
  },
  // Header styles
  headerContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerContent: {
    padding: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#F5F5F5',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 20,
  },
  headerLine: {
    width: 60,
    height: 3,
    backgroundColor: '#4A4A4A',
    borderRadius: 2,
  },
  // Card styles
  cardContainer: {
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  cardContent: {
    padding: 30,
  },
  formContainer: {
    gap: 20,
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#333333',
  },
  // Button styles
  loginButton: {
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  registerButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#1F1F1F',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  // Footer styles
  footerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    height: 2,
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    width: '100%',
    maxWidth: 520,
    height: '80%',
    maxHeight: 650,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  modalScrollContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  modalList: {
    flex: 1,
  },
  modalListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#0F0F0F',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  modalItemSelected: {
    backgroundColor: '#1E3A5F',
    borderColor: '#4A7BA7',
    borderWidth: 2.5,
    elevation: 6,
    shadowColor: '#4A7BA7',
    shadowOpacity: 0.4,
  },
  modalItemContent: {
    flexDirection: 'column',
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E8E8E8',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  modalItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: '#999999',
    letterSpacing: 0.1,
  },
  modalItemSubtextSelected: {
    color: '#CCDDFF',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  modalCloseButton: {
    padding: 20,
    borderTopWidth: 1.5,
    borderTopColor: '#2A2A2A',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  modalCloseButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E8E8E8',
    letterSpacing: 0.5,
  },
  biometricContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  biometricIcon: {
    marginRight: 8,
  },
  biometricButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  removeCredentialsButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  removeCredentialsText: {
    color: '#888888',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  // Modal de idioma styles
  modalLanguageContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  modalLanguageHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    backgroundColor: '#1F1F1F',
  },
  modalLanguageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  modalLanguageOptions: {
    padding: 20,
  },
  modalLanguageOption: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#0F0F0F',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  modalLanguageOptionContent: {
    alignItems: 'center',
  },
  modalLanguageOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8E8E8',
    letterSpacing: 0.3,
  },
});
