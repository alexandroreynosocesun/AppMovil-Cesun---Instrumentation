import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Text,
  TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  HelperText,
  ActivityIndicator,
  RadioButton,
  Divider,
  Chip
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authService } from '../services/AuthService';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import logger from '../utils/logger';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user, updateProfile, logout } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    numero_empleado: user?.numero_empleado || '',
    password: '',
    confirmPassword: '',
    turno_actual: user?.turno_actual || 'A'
  });

  // Actualizar formData cuando el usuario cambie
  React.useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || '',
        numero_empleado: user.numero_empleado || '',
        password: '',
        confirmPassword: '',
        turno_actual: user.turno_actual || 'A'
      });
      logger.info('Usuario actualizado en contexto:', user);
    }
  }, [user]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return false;
    }
    if (!formData.numero_empleado.trim()) {
      Alert.alert('Error', 'El número de empleado es requerido');
      return false;
    }
    if (formData.password && formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return false;
    }
    return true;
  };


  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      const updateData = {
        nombre: formData.nombre.trim(),
        numero_empleado: formData.numero_empleado.trim(),
        turno_actual: formData.turno_actual
      };

      // Solo incluir password si se proporcionó
      if (formData.password) {
        updateData.password = formData.password;
      }

      logger.info('Datos a enviar:', updateData);
      logger.info('Turno actual seleccionado:', formData.turno_actual);

      const result = await updateProfile(updateData);
      
      if (result.success) {
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
        setEditing(false);
        // Resetear formulario con los datos actualizados del contexto
        setFormData({
          nombre: user?.nombre || '',
          numero_empleado: user?.numero_empleado || '',
          password: '',
          confirmPassword: '',
          turno_actual: user?.turno_actual || 'A'
        });
      } else {
        Alert.alert('Error', result.error || 'Error al actualizar el perfil');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nombre: user?.nombre || '',
      numero_empleado: user?.numero_empleado || '',
      password: '',
      confirmPassword: '',
      turno_actual: user?.turno_actual || 'A'
    });
    setEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', onPress: logout }
      ]
    );
  };

  // Función para obtener color del turno
  const getTurnoColor = (turno) => {
    if (!turno) return '#757575';
    const turnoUpper = turno.toUpperCase().trim();
    switch (turnoUpper) {
      case 'A':
      case 'MAÑANA':
      case 'MANANA':
        return '#2196F3';
      case 'B':
      case 'NOCHE':
        return '#4CAF50';
      case 'C':
      case 'FINES':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  // Función para obtener nombre del turno
  const getTurnoName = (turno) => {
    if (!turno) return 'N/A';
    const turnoUpper = turno.toUpperCase().trim();
    switch (turnoUpper) {
      case 'A':
      case 'MAÑANA':
      case 'MANANA':
        return 'Turno A';
      case 'B':
      case 'NOCHE':
        return 'Turno B';
      case 'C':
      case 'FINES':
        return 'Turno C';
      default:
        return turno;
    }
  };

  const darkTheme = {
    colors: {
      primary: '#2196F3',
      background: '#121212',
      surface: '#1E1E1E',
      text: '#FFFFFF',
      placeholder: '#B0B0B0',
      error: '#F44336',
      onSurface: '#FFFFFF',
      onSurfaceVariant: '#E0E0E0',
      outline: '#3C3C3C',
    },
  };

  return (
    <ScrollView 
      style={[styles.container, isWeb && webStyles.container]}
      contentContainerStyle={[
        isWeb && {
          maxWidth: maxWidth,
          alignSelf: 'center',
          width: '100%',
          paddingHorizontal: containerPadding,
        }
      ]}
    >
      {/* Información del Usuario */}
      <Card style={[styles.card, isWeb && webStyles.card]}>
        <Card.Content>
          <Title style={styles.title}>👤 {t('profile')}</Title>
          
          <View style={styles.userInfo}>
            <View style={styles.userDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>👤 Usuario:</Text>
                <Text style={styles.detailValue}>{user?.usuario || 'N/A'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>📝 Nombre Completo:</Text>
                <Text style={styles.detailValue}>{user?.nombre || 'N/A'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🔢 Número de Empleado:</Text>
                <Text style={styles.detailValue}>{user?.numero_empleado || 'N/A'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>⏰ Turno:</Text>
                <Chip
                  style={[styles.turnoChip, { backgroundColor: getTurnoColor(user?.turno_actual) }]}
                  textStyle={styles.turnoChipText}
                >
                  {getTurnoName(user?.turno_actual)}
                </Chip>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🌐 {t('language')}:</Text>
                <Chip
                  style={[styles.turnoChip, { backgroundColor: language === 'es' ? '#2196F3' : '#4CAF50' }]}
                  textStyle={styles.turnoChipText}
                >
                  {language === 'es' ? '🇪🇸 Español' : '🇬🇧 English'}
                </Chip>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode={editing ? "outlined" : "contained"}
              onPress={() => setEditing(!editing)}
              style={styles.button}
              icon={editing ? "close" : "pencil"}
              buttonColor="#2196F3"
              textColor="#FFFFFF"
              borderColor="#666666"
            >
              {editing ? t('cancelEdit') : t('editProfile')}
            </Button>
          </View>
        </Card.Content>
      </Card>

      {editing && (
        <>
          {/* Cambio de Turno */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>⏰ Turno de Trabajo</Title>
              <Paragraph style={styles.helpText}>
                Selecciona tu turno actual de trabajo según el horario asignado
              </Paragraph>
              
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.turnoOption,
                    formData.turno_actual === 'A' && styles.turnoOptionSelected
                  ]}
                  onPress={() => handleInputChange('turno_actual', 'A')}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <RadioButton
                    value="A"
                    status={formData.turno_actual === 'A' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'A')}
                    disabled={loading}
                    color="#2196F3"
                    uncheckedColor="#666666"
                  />
                  <View style={styles.turnoTextContainer}>
                    <Text style={[
                      styles.turnoLabel,
                      formData.turno_actual === 'A' && styles.turnoLabelSelected
                    ]}>
                      Turno A - Día
                    </Text>
                    <Text style={[
                      styles.turnoSubLabel,
                      formData.turno_actual === 'A' && styles.turnoSubLabelSelected
                    ]}>
                      6:30 AM - 6:30 PM | Lun-Jue
                    </Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.turnoOption,
                    formData.turno_actual === 'B' && styles.turnoOptionSelected
                  ]}
                  onPress={() => handleInputChange('turno_actual', 'B')}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <RadioButton
                    value="B"
                    status={formData.turno_actual === 'B' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'B')}
                    disabled={loading}
                    color="#2196F3"
                    uncheckedColor="#666666"
                  />
                  <View style={styles.turnoTextContainer}>
                    <Text style={[
                      styles.turnoLabel,
                      formData.turno_actual === 'B' && styles.turnoLabelSelected
                    ]}>
                      Turno B - Noche
                    </Text>
                    <Text style={[
                      styles.turnoSubLabel,
                      formData.turno_actual === 'B' && styles.turnoSubLabelSelected
                    ]}>
                      6:30 PM - 6:30 AM | Lun-Jue
                    </Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.turnoOption,
                    formData.turno_actual === 'C' && styles.turnoOptionSelected
                  ]}
                  onPress={() => handleInputChange('turno_actual', 'C')}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <RadioButton
                    value="C"
                    status={formData.turno_actual === 'C' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'C')}
                    disabled={loading}
                    color="#2196F3"
                    uncheckedColor="#666666"
                  />
                  <View style={styles.turnoTextContainer}>
                    <Text style={[
                      styles.turnoLabel,
                      formData.turno_actual === 'C' && styles.turnoLabelSelected
                    ]}>
                      Turno C - Fines de Semana
                    </Text>
                    <Text style={[
                      styles.turnoSubLabel,
                      formData.turno_actual === 'C' && styles.turnoSubLabelSelected
                    ]}>
                      6:30 AM - 6:30 PM | Vie-Dom
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
        </Card.Content>
      </Card>

          {/* Cambio de Idioma */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>🌐 {t('language')}</Title>
              <Paragraph style={styles.helpText}>
                {language === 'es' 
                  ? 'Selecciona tu idioma preferido para la aplicación'
                  : 'Select your preferred language for the application'}
              </Paragraph>
              
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.turnoOption,
                    language === 'es' && styles.turnoOptionSelected
                  ]}
                  onPress={() => changeLanguage('es')}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <RadioButton
                    value="es"
                    status={language === 'es' ? 'checked' : 'unchecked'}
                    onPress={() => changeLanguage('es')}
                    disabled={loading}
                    color="#2196F3"
                    uncheckedColor="#666666"
                  />
                  <View style={styles.turnoTextContainer}>
                    <Text style={[
                      styles.turnoLabel,
                      language === 'es' && styles.turnoLabelSelected
                    ]}>
                      🇪🇸 {t('spanish')}
                    </Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.turnoOption,
                    language === 'en' && styles.turnoOptionSelected
                  ]}
                  onPress={() => changeLanguage('en')}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <RadioButton
                    value="en"
                    status={language === 'en' ? 'checked' : 'unchecked'}
                    onPress={() => changeLanguage('en')}
                    disabled={loading}
                    color="#2196F3"
                    uncheckedColor="#666666"
                  />
                  <View style={styles.turnoTextContainer}>
                    <Text style={[
                      styles.turnoLabel,
                      language === 'en' && styles.turnoLabelSelected
                    ]}>
                      🇬🇧 {t('english')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
        </Card.Content>
      </Card>

          {/* Botones de Acción */}
      <Card style={styles.card}>
        <Card.Content>
              <View style={styles.actionButtons}>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  style={styles.actionSaveButton}
                  disabled={loading}
                  loading={loading}
                  buttonColor="#2196F3"
                  textColor="#FFFFFF"
                >
                  {t('saveChanges')}
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={styles.actionCancelButton}
                  disabled={loading}
                  textColor="#B0B0B0"
                  borderColor="#666666"
                >
                  {t('cancel')}
                </Button>
              </View>
        </Card.Content>
      </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  card: {
    marginBottom: 20,
    elevation: 6,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  userInfo: {
    marginBottom: 20,
  },
  userDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2C2C2C',
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E0E0E0',
    flex: 1,
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 15,
    color: '#B0B0B0',
    fontWeight: '500',
    textAlign: 'right',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  button: {
    minWidth: 200,
    borderRadius: 12,
  },
  input: {
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#2C2C2C',
  },
  inputLabel: {
    color: '#E0E0E0',
  },
  helpText: {
    color: '#B0B0B0',
    fontStyle: 'italic',
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  radioGroup: {
    marginTop: 8,
  },
  turnoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#404040',
  },
  turnoOptionSelected: {
    backgroundColor: '#1A3A52',
    borderColor: '#2196F3',
  },
  turnoTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  turnoLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  turnoLabelSelected: {
    color: '#2196F3',
  },
  turnoSubLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    lineHeight: 20,
  },
  turnoSubLabelSelected: {
    color: '#90CAF9',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionSaveButton: {
    flex: 1,
    marginRight: 8,
  },
  actionCancelButton: {
    flex: 1,
    marginLeft: 8,
  },
  turnoChip: {
    borderRadius: 16,
    height: 32,
  },
  turnoChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
