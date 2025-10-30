import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { formatDateTime12Hour } from '../utils/dateUtils';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  RadioButton,
  ActivityIndicator,
  Chip,
  Divider,
  Surface,
  IconButton
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../contexts/ValidationContext';
import { jigNGService } from '../services/JigNGService';

export default function ValidationScreen({ route, navigation }) {
  const { jig } = route.params || {};
  const { user } = useAuth();
  const { addValidation, getValidationsByModel } = useValidation();
  
  const [loading, setLoading] = useState(false);
  const [checkingNG, setCheckingNG] = useState(true);
  const [jigNG, setJigNG] = useState(null);
  const [formData, setFormData] = useState({
    turno: user?.turno_actual || 'A', // Usar el turno del usuario automáticamente
    estado: 'OK',
    comentario: '',
    cantidad: '1'
  });

  useEffect(() => {
    checkJigNGStatus();
  }, [jig]);

  const checkJigNGStatus = async () => {
    if (!jig?.id) {
      setCheckingNG(false);
      return;
    }

    try {
      setCheckingNG(true);
      const result = await jigNGService.checkJigNGStatus(jig.id);
      if (result.success) {
        setJigNG(result.jigNG);
        if (result.hasActiveNG) {
          Alert.alert(
            'Jig con NG Activo',
            'Este jig tiene un reporte NG activo y debe ser reparado antes de continuar con la validación.',
            [
              {
                text: 'Cancelar',
                style: 'cancel',
                onPress: () => {
                  setCheckingNG(false);
                  navigation.goBack();
                }
              },
              {
                text: 'Ir a Reparar',
                onPress: () => {
                  setCheckingNG(false);
                  navigation.navigate('RepairJig', { 
                    jigNG: result.jigNG,
                    fromValidation: true,
                    validationJig: jig
                  });
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error verificando NG:', error);
    } finally {
      setCheckingNG(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitValidation = () => {
    // Validar campos requeridos
    if (!formData.turno || !formData.estado || !formData.comentario) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    // Validar cantidad
    const cantidad = parseInt(formData.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert('Error', 'La cantidad debe ser un número mayor a 0');
      return;
    }

    // Crear objeto de validación
    const validationData = {
      jig: jig,
      modelo_actual: jig?.modelo_actual,
      turno: formData.turno,
      estado: formData.estado,
      comentario: formData.comentario,
      cantidad: formData.cantidad,
      created_at: new Date().toISOString()
    };

    // Agregar validación al contexto
    addValidation(validationData);

    // Obtener validaciones del modelo actual (después de agregar)
    const modelValidations = getValidationsByModel(jig?.modelo_actual);
    
    Alert.alert(
      'Validación Agregada',
      `Jig ${jig?.numero_jig} agregado al reporte.\n\nModelo: ${jig?.modelo_actual}\nValidaciones: ${modelValidations.length + 1}/14`,
      [
        {
          text: 'Continuar Escaneando',
          onPress: () => navigation.navigate('QRScanner')
        },
        {
          text: 'Ver Reporte',
          onPress: () => navigation.navigate('Reporte', { 
            modelValidations: [...modelValidations, validationData],
            currentModel: jig?.modelo_actual
          })
        }
      ]
    );
  };

  // Función para obtener color del turno
  const getTurnoColor = (turno) => {
    switch (turno) {
      case 'A': return '#2196F3';
      case 'B': return '#4CAF50';
      case 'C': return '#FF9800';
      default: return '#757575';
    }
  };

  if (!jig || checkingNG) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Paragraph>
          {!jig ? 'Cargando información del jig...' : 'Verificando estado NG...'}
        </Paragraph>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header con información del jig */}
        <Surface style={styles.headerCard} elevation={4}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Title style={styles.headerTitle}>🔍 Validar Jig</Title>
              <Paragraph style={styles.headerSubtitle}>
                {jig.numero_jig} • {jig.tipo} • {jig.modelo_actual}
            </Paragraph>
            </View>
            <View style={styles.headerRight}>
              <Chip 
                style={[styles.statusChip, { backgroundColor: jig.estado === 'activo' ? '#4CAF50' : '#FF9800' }]}
                textStyle={styles.chipText}
              >
                {jig.estado?.toUpperCase() || 'N/A'}
              </Chip>
            </View>
          </View>
        </Surface>

        {/* Información del técnico */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>👤 Técnico Validando</Title>
            <View style={styles.technicianInfo}>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>Nombre:</Paragraph>
                <Paragraph style={styles.technicianValue}>{user?.nombre || 'N/A'}</Paragraph>
              </View>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>Turno Asignado:</Paragraph>
                <Chip 
                  style={[styles.turnoChip, { backgroundColor: getTurnoColor(formData.turno) }]}
                  textStyle={styles.chipText}
                >
                  TURNO {formData.turno}
                </Chip>
              </View>
              </View>
          </Card.Content>
        </Card>

        {/* Formulario de validación */}
        <Card style={styles.formCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>📋 Datos de Validación</Title>
            
            {/* Turno - Mejorado */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>Turno de Validación *</Paragraph>
              <View style={styles.turnoButtons}>
                {['A', 'B', 'C'].map((turno) => (
                  <Button
                    key={turno}
                    mode={formData.turno === turno ? "contained" : "outlined"}
                    onPress={() => handleInputChange('turno', turno)}
                    style={[
                      styles.turnoButton,
                      formData.turno === turno && { backgroundColor: getTurnoColor(turno) }
                    ]}
                    textColor={formData.turno === turno ? '#FFFFFF' : getTurnoColor(turno)}
                  >
                    Turno {turno}
                  </Button>
                ))}
              </View>
            </View>
            
            <Divider style={styles.divider} />

            {/* Estado - Mejorado */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>Estado del Jig *</Paragraph>
              <View style={styles.estadoButtons}>
                <Button
                  mode={formData.estado === 'OK' ? "contained" : "outlined"}
                  onPress={() => handleInputChange('estado', 'OK')}
                  style={[
                    styles.estadoButton,
                    formData.estado === 'OK' && { backgroundColor: '#4CAF50' }
                  ]}
                  textColor={formData.estado === 'OK' ? '#FFFFFF' : '#4CAF50'}
                  icon="check-circle"
                >
                  OK
                </Button>
                <Button
                  mode={formData.estado === 'NG' ? "contained" : "outlined"}
                  onPress={() => handleInputChange('estado', 'NG')}
                  style={[
                    styles.estadoButton,
                    formData.estado === 'NG' && { backgroundColor: '#F44336' }
                  ]}
                  textColor={formData.estado === 'NG' ? '#FFFFFF' : '#F44336'}
                  icon="alert-circle"
                >
                  NG
                </Button>
              </View>
            </View>
            
            <Divider style={styles.divider} />

            {/* Comentario - Opciones predefinidas */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>Comentarios de Validación *</Paragraph>
              
              {/* Primera fila - Limpieza y Validado */}
              <View style={styles.comentarioRow}>
                <Button
                  mode={formData.comentario === 'Limpieza' ? "contained" : "outlined"}
                  onPress={() => handleInputChange('comentario', 'Limpieza')}
                  style={[
                    styles.comentarioButton,
                    formData.comentario === 'Limpieza' && { backgroundColor: '#FF9800' }
                  ]}
                  textColor={formData.comentario === 'Limpieza' ? '#FFFFFF' : '#FF9800'}
                  icon="broom"
                >
                  Limpieza
                </Button>
                <Button
                  mode={formData.comentario === 'Validado' ? "contained" : "outlined"}
                  onPress={() => handleInputChange('comentario', 'Validado')}
                  style={[
                    styles.comentarioButton,
                    formData.comentario === 'Validado' && { backgroundColor: '#4CAF50' }
                  ]}
                  textColor={formData.comentario === 'Validado' ? '#FFFFFF' : '#4CAF50'}
                  icon="check-circle"
                >
                  Validado
                </Button>
              </View>
              
              {/* Segunda fila - Limpieza y Validado (botón completo) */}
              <View style={styles.comentarioRowFull}>
                <Button
                  mode={formData.comentario === 'Limpieza y Validado' ? "contained" : "outlined"}
                  onPress={() => handleInputChange('comentario', 'Limpieza y Validado')}
                  style={[
                    styles.comentarioButtonFull,
                    formData.comentario === 'Limpieza y Validado' && { backgroundColor: '#2196F3' }
                  ]}
                  textColor={formData.comentario === 'Limpieza y Validado' ? '#FFFFFF' : '#2196F3'}
                  icon="check-all"
                >
                  Limpieza y Validado
                </Button>
              </View>
            </View>

            {/* Cantidad - Mejorado */}
            <View style={styles.inputSection}>
            <TextInput
                label="Cantidad Validada"
              value={formData.cantidad}
              onChangeText={(text) => handleInputChange('cantidad', text)}
                style={styles.textInput}
              mode="outlined"
              keyboardType="numeric"
                left={<TextInput.Icon icon="counter" />}
            />
            </View>
          </Card.Content>
        </Card>
            
        {/* Botones de acción - Mejorados */}
        <Surface style={styles.actionCard} elevation={2}>
            <Button
              mode="contained"
              onPress={handleSubmitValidation}
            style={styles.submitButton}
              disabled={loading}
            icon={loading ? "loading" : "check-circle"}
            contentStyle={styles.submitButtonContent}
            >
            {loading ? 'Validando...' : 'Validar Jig'}
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('AddJigNG', { 
                jigId: jig.id, 
                jigData: jig 
              })}
            style={styles.ngButton}
            icon="alert-circle"
              textColor="#F44336"
            >
            Reportar como NG
            </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  // Header styles
  headerCard: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#E3F2FD',
    fontSize: 16,
  },
  headerRight: {
    marginLeft: 16,
  },
  statusChip: {
    borderRadius: 20,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Info card styles
  infoCard: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  technicianInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  technicianItem: {
    flex: 1,
  },
  technicianLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  technicianValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  turnoChip: {
    borderRadius: 20,
  },
  // Form card styles
  formCard: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  turnoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  turnoButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#2D2D2D',
    height: 2,
    borderRadius: 1,
  },
  estadoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  estadoButton: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  comentarioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  comentarioButton: {
    flex: 1,
    borderRadius: 8,
  },
  comentarioRowFull: {
    width: '100%',
  },
  comentarioButtonFull: {
    width: '100%',
    borderRadius: 8,
  },
  textInput: {
    marginBottom: 8,
  },
  // Action card styles
  actionCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    marginBottom: 12,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  ngButton: {
    borderColor: '#F44336',
    borderRadius: 8,
  },
});
