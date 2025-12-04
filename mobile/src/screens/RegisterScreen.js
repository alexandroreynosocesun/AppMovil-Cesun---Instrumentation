import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Animated,
  TouchableOpacity,
  Text,
  Modal
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  HelperText,
  ActivityIndicator,
  Surface,
  Divider
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../services/AuthService';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    usuario: '',
    nombre: '',
    numero_empleado: '',
    password: '',
    confirmPassword: '',
    tipo_usuario: 'validaciones' // validaciones, asignaciones, gestion
  });
  const [dropdownVisible, setDropdownVisible] = useState(false);
  
  // Mapeo de valores mostrados a valores del backend
  const tipoUsuarioMap = {
    'asignaciones': 'ingeniero',
    'validaciones': 'tecnico',
    'gestion': 'gestion'
  };
  
  const tipoUsuarioOptions = [
    { value: 'asignaciones', label: 'Asignaciones' },
    { value: 'validaciones', label: 'Validaciones' },
    { value: 'gestion', label: 'Gestión' }
  ];
  
  const getSelectedLabel = () => {
    const option = tipoUsuarioOptions.find(opt => opt.value === formData.tipo_usuario);
    return option ? option.label : 'Selecciona un tipo';
  };
  const [loading, setLoading] = useState(false);
  
  // Animaciones
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

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
    ]).start();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.usuario.trim()) {
      Alert.alert('Error', 'El usuario es requerido');
      return false;
    }
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return false;
    }
    if (!formData.numero_empleado.trim()) {
      Alert.alert('Error', 'El número de empleado es requerido');
      return false;
    }
    if (formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      const registerData = {
        usuario: formData.usuario.trim(),
        nombre: formData.nombre.trim(),
        numero_empleado: formData.numero_empleado.trim(),
        password: formData.password,
        tipo_usuario: tipoUsuarioMap[formData.tipo_usuario] || 'tecnico', // Mapear al valor del backend
      };

      const result = await authService.register(registerData);
      
      if (result.success) {
        Alert.alert(
          'Solicitud Enviada',
          'Tu solicitud de registro ha sido enviada al administrador. Recibirás una notificación cuando sea aprobada.',
          [
            {
              text: 'Ver Estado',
              onPress: () => navigation.navigate('SolicitudStatus', { usuario: formData.usuario })
            },
            {
              text: 'Ir a Login',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Error enviando solicitud de registro');
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
            <Text style={styles.headerIcon}>👤</Text>
            <Title style={styles.headerTitle}>Registro de Usuario</Title>
            <Paragraph style={styles.headerSubtitle}>
            Completa tus datos para solicitar acceso al sistema
          </Paragraph>
            <View style={styles.headerLine} />
          </View>
        </Animated.View>

        {/* Formulario principal */}
        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Surface style={styles.card} elevation={8}>
            <Card.Content style={styles.cardContent}>
          
          <TextInput
            label="Usuario *"
            value={formData.usuario}
            onChangeText={(text) => handleInputChange('usuario', text)}
                style={[styles.input, { color: '#F5F5F5' }]}
            mode="outlined"
            autoCapitalize="none"
            placeholder="Ej: juan.perez"
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
            label="Nombre Completo *"
            value={formData.nombre}
            onChangeText={(text) => handleInputChange('nombre', text)}
                style={[styles.input, { color: '#F5F5F5' }]}
            mode="outlined"
            placeholder="Ej: Juan Pérez García"
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
            label="Número de Empleado *"
            value={formData.numero_empleado}
            onChangeText={(text) => handleInputChange('numero_empleado', text)}
                style={[styles.input, { color: '#F5F5F5' }]}
            mode="outlined"
            keyboardType="numeric"
            placeholder="Ej: 12345"
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
            label="Contraseña *"
            value={formData.password}
            onChangeText={(text) => handleInputChange('password', text)}
                style={[styles.input, { color: '#F5F5F5' }]}
            mode="outlined"
            secureTextEntry
            placeholder="Mínimo 6 caracteres"
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
            label="Confirmar Contraseña *"
            value={formData.confirmPassword}
            onChangeText={(text) => handleInputChange('confirmPassword', text)}
                style={[styles.input, { color: '#F5F5F5' }]}
            mode="outlined"
            secureTextEntry
            placeholder="Repite tu contraseña"
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

          {/* Selector de Tipo de Usuario */}
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>Tipo de Usuario *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setDropdownVisible(true)}
            >
              <Text style={[
                styles.dropdownButtonText,
                !formData.tipo_usuario && styles.dropdownButtonTextPlaceholder
              ]}>
                {getSelectedLabel()}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Modal del Dropdown */}
          <Modal
            visible={dropdownVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setDropdownVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setDropdownVisible(false)}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Selecciona Tipo de Usuario</Text>
                  <TouchableOpacity
                    onPress={() => setDropdownVisible(false)}
                    style={styles.modalCloseButton}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Divider style={styles.modalDivider} />
                {tipoUsuarioOptions.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modalOption,
                      formData.tipo_usuario === option.value && styles.modalOptionSelected,
                      index === tipoUsuarioOptions.length - 1 && styles.modalOptionLast
                    ]}
                    onPress={() => {
                      handleInputChange('tipo_usuario', option.value);
                      setDropdownVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      formData.tipo_usuario === option.value && styles.modalOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    {formData.tipo_usuario === option.value && (
                      <Text style={styles.modalOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </Card.Content>
          </Surface>
        </Animated.View>


      {/* Botones */}
        <Animated.View
          style={[
            styles.buttonsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Surface style={styles.card} elevation={8}>
            <Card.Content style={styles.cardContent}>
              <TouchableOpacity
                style={styles.submitButton}
            onPress={handleRegister}
            disabled={loading}
              >
                <LinearGradient
                  colors={['#2D2D2D', '#1A1A1A', '#0F0F0F']}
                  style={styles.submitButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#E0E0E0" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      Enviar Solicitud de Registro
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
            onPress={() => navigation.navigate('Login')}
          >
                <Text style={styles.cancelButtonText}>
            Ya tengo cuenta
                </Text>
              </TouchableOpacity>
        </Card.Content>
          </Surface>
        </Animated.View>
      </ScrollView>

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  // Header styles
  headerContainer: {
    marginBottom: 30,
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
  // Form styles
  formContainer: {
    marginBottom: 20,
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
    padding: 25,
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F5F5F5',
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonsContainer: {
    marginBottom: 20,
  },
  submitButton: {
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 16,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  cancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F1F1F',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  dropdownContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    minHeight: 56,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#F5F5F5',
    flex: 1,
  },
  dropdownButtonTextPlaceholder: {
    color: '#666666',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    width: width * 0.85,
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5F5F5',
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#B0B0B0',
    lineHeight: 24,
  },
  modalDivider: {
    backgroundColor: '#333333',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalOptionLast: {
    borderBottomWidth: 0,
  },
  modalOptionSelected: {
    backgroundColor: '#2A2A2A',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#F5F5F5',
  },
  modalOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  modalOptionCheck: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
  },
});
