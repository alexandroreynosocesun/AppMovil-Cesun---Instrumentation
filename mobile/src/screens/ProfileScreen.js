import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Text
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
  Divider
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/AuthService';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import logger from '../utils/logger';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user, updateProfile, logout } = useAuth();
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
          <Title style={styles.title}>👤 Perfil de Usuario</Title>
          
          <View style={styles.userInfo}>
            <View style={styles.userHeader}>
              <Text style={styles.userName}>{user?.nombre || 'Sin nombre'}</Text>
              <Text style={styles.userRole}>{user?.tipo_tecnico || 'Técnico'}</Text>
            </View>
            
            <View style={styles.userDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>👤 Usuario:</Text>
                <Text style={styles.detailValue}>{user?.usuario || 'N/A'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🔢 Empleado:</Text>
                <Text style={styles.detailValue}>{user?.numero_empleado || 'N/A'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>⏰ Turno:</Text>
                <Text style={styles.detailValue}>
                  {user?.turno_actual === 'A' ? 'A - Día (Lun-Jue)' : 
                   user?.turno_actual === 'B' ? 'B - Noche (Lun-Jue)' : 
                   user?.turno_actual === 'C' ? 'C - Fines de semana (Vie-Dom)' : 'N/A'}
                </Text>
              </View>
              
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode={editing ? "outlined" : "contained"}
              onPress={() => setEditing(!editing)}
              style={styles.button}
              icon={editing ? "close" : "pencil"}
            >
              {editing ? 'Cancelar Edición' : 'Editar Perfil'}
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleLogout}
              style={[styles.button, styles.logoutButton]}
              textColor="#d32f2f"
              icon="logout"
            >
              Cerrar Sesión
            </Button>
          </View>
        </Card.Content>
      </Card>

      {editing && (
        <>
          {/* Información Personal */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Información Personal</Title>
              
              <TextInput
                label="Nombre Completo *"
                value={formData.nombre}
                onChangeText={(text) => handleInputChange('nombre', text)}
                style={styles.input}
                mode="outlined"
                disabled={loading}
              />
              
              <TextInput
                label="Número de Empleado *"
                value={formData.numero_empleado}
                onChangeText={(text) => handleInputChange('numero_empleado', text)}
                style={styles.input}
                mode="outlined"
                keyboardType="numeric"
                disabled={loading}
              />
            </Card.Content>
          </Card>

          {/* Cambio de Turno */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Turno de Trabajo</Title>
              <Paragraph style={styles.helpText}>
                Selecciona tu turno actual de trabajo según el horario asignado
              </Paragraph>
              
              <View style={styles.radioGroup}>
                <View style={styles.radioItem}>
                  <RadioButton
                    value="A"
                    status={formData.turno_actual === 'A' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'A')}
                    disabled={loading}
                  />
                  <Text style={styles.radioLabel}>Turno A - Día (6:30 AM - 6:30 PM) Lun-Jue</Text>
                </View>
                
                <View style={styles.radioItem}>
                  <RadioButton
                    value="B"
                    status={formData.turno_actual === 'B' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'B')}
                    disabled={loading}
                  />
                  <Text style={styles.radioLabel}>Turno B - Noche (6:30 PM - 6:30 AM) Lun-Jue</Text>
                </View>
                
                <View style={styles.radioItem}>
                  <RadioButton
                    value="C"
                    status={formData.turno_actual === 'C' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'C')}
                    disabled={loading}
                  />
                  <Text style={styles.radioLabel}>Turno C - Fines de semana (6:30 AM - 6:30 PM) Vie-Dom</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

          {/* Cambio de Contraseña */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Cambiar Contraseña</Title>
              <Paragraph style={styles.helpText}>
                Deja en blanco si no quieres cambiar la contraseña
              </Paragraph>
              
              <TextInput
                label="Nueva Contraseña"
                value={formData.password}
                onChangeText={(text) => handleInputChange('password', text)}
                style={styles.input}
                mode="outlined"
                secureTextEntry
                disabled={loading}
                placeholder="Mínimo 6 caracteres"
              />
              
              <TextInput
                label="Confirmar Nueva Contraseña"
                value={formData.confirmPassword}
                onChangeText={(text) => handleInputChange('confirmPassword', text)}
                style={styles.input}
                mode="outlined"
                secureTextEntry
                disabled={loading}
                placeholder="Repite la nueva contraseña"
              />
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
                >
                  Guardar Cambios
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={styles.actionCancelButton}
                  disabled={loading}
                >
                  Cancelar
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
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  card: {
    marginBottom: 20,
    elevation: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  userInfo: {
    marginBottom: 20,
  },
  userHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  userRole: {
    fontSize: 16,
    color: '#64748B',
    fontStyle: 'italic',
    fontWeight: '500',
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
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'right',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  logoutButton: {
    borderColor: '#d32f2f',
  },
  input: {
    marginBottom: 20,
    borderRadius: 12,
  },
  helpText: {
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 16,
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
});
