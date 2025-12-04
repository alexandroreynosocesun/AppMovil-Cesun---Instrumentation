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
  TouchableOpacity
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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  
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
  }, []);

  const handleLogin = async () => {
    if (!usuario.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const result = await login(usuario, password);
      
      if (result.success) {
        // Pequeño delay para asegurar que el contexto se actualice
        setTimeout(() => {
          navigation.navigate('Home');
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
              <Text style={styles.headerIcon}>🔧</Text>
              <Title style={styles.headerTitle}>Validación de Jigs</Title>
              <Paragraph style={styles.headerSubtitle}>
                Sistema de digitalización de validaciones
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
                  <TextInput
                    label="Usuario"
                    value={usuario}
                    onChangeText={setUsuario}
                    mode="outlined"
                    style={[styles.input, { color: '#F5F5F5' }]}
                    autoCapitalize="none"
                    autoCorrect={false}
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
                  
                  <TextInput
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    style={[styles.input, { color: '#F5F5F5' }]}
                    secureTextEntry
                    autoCapitalize="none"
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
                          Iniciar Sesión
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => navigation.navigate('Register')}
                    disabled={loading}
                  >
                    <Text style={styles.registerButtonText}>
                      Crear Nueva Cuenta
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
              Departamento de Instrumentación
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F5F5F5',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
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
});
