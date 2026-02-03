import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback
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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../contexts/ValidationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { jigNGService } from '../services/JigNGService';
import logger from '../utils/logger';
import { showAlert } from '../utils/alertUtils';

export default function ValidationScreen({ route, navigation }) {
  const { jig } = route.params || {};
  const { user } = useAuth();
  const { t } = useLanguage();
  const { addValidation, getValidationsByModel, setLineaForModel, getLineaForModel, validations } = useValidation();
  
  // Función helper para traducir el tipo del jig
  const translateJigType = (tipo) => {
    if (!tipo) return t('notAvailable');
    const tipoLower = tipo.toLowerCase();
    if (tipoLower === 'manual') return t('manual');
    if (tipoLower === 'semiautomatic' || tipoLower === 'semiautomatico') return t('semiautomatic');
    if (tipoLower === 'new semiautomatic' || tipoLower === 'new_semiautomatic' || tipoLower === 'nuevo_semiautomatico' || tipoLower === 'nuevo semiautomatico') return t('newSemiautomatic');
    return tipo; // Si no coincide, devolver el valor original
  };

  // Función para normalizar el turno: convertir "mañana", "noche", "fines" a "A", "B", "C"
  const normalizeTurno = (turno) => {
    if (!turno) return 'A';
    const turnoLower = String(turno).toLowerCase().trim();
    switch (turnoLower) {
      case 'mañana':
      case 'manana':
      case 'a':
        return 'A';
      case 'noche':
      case 'b':
        return 'B';
      case 'fines':
      case 'c':
        return 'C';
      default:
        // Si ya es A, B o C, retornarlo en mayúsculas
        if (turnoLower === 'a' || turnoLower === 'b' || turnoLower === 'c') {
          return turnoLower.toUpperCase();
        }
        return String(turno).toUpperCase();
    }
  };

  // Obtener el turno normalizado del usuario
  const userTurno = normalizeTurno(user?.turno_actual);
  
  const [loading, setLoading] = useState(false);
  const [checkingNG, setCheckingNG] = useState(true);
  const [jigNG, setJigNG] = useState(null);
  const [showLineaModal, setShowLineaModal] = useState(false);
  const [formData, setFormData] = useState({
    turno: userTurno, // Usar el turno normalizado del usuario automáticamente
    estado: 'OK',
    comentario: '',
    cantidad: '1',
    linea: ''
  });

  // Actualizar turno cuando cambie el usuario
  useEffect(() => {
    const normalizedTurno = normalizeTurno(user?.turno_actual);
    setFormData(prev => ({
      ...prev,
      turno: normalizedTurno
    }));
  }, [user?.turno_actual]);

  useEffect(() => {
    checkJigNGStatus();
  }, [jig]);

  // Cargar línea guardada para este modelo cuando se monte el componente
  useEffect(() => {
    if (jig?.modelo_actual) {
      const lineaGuardada = getLineaForModel(jig.modelo_actual);
      if (lineaGuardada) {
        logger.info('📥 Cargando línea guardada para modelo', jig.modelo_actual, ':', lineaGuardada);
        setFormData(prev => ({
          ...prev,
          linea: lineaGuardada
        }));
      }
    }
  }, [jig?.modelo_actual, getLineaForModel]);

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
            t('jigWithNGActive'),
            t('jigWithNGActiveDesc'),
            [
              {
                text: t('cancel'),
                style: 'cancel',
                onPress: () => {
                  setCheckingNG(false);
                  navigation.goBack();
                }
              },
              {
                text: t('goToRepair'),
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
      logger.error('Error verificando NG:', error);
    } finally {
      setCheckingNG(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Si se cambia la línea, guardarla para este modelo
    if (field === 'linea' && jig?.modelo_actual) {
      setLineaForModel(jig.modelo_actual, value);
    }
  };

  const handleSubmitValidation = () => {
    // Validar campos requeridos
    if (!formData.turno || !formData.estado || !formData.comentario) {
      Alert.alert(t('error'), t('completeRequiredFields'));
      return;
    }

    // Validar que se haya seleccionado una línea
    if (!formData.linea || formData.linea.trim() === '') {
      Alert.alert(
        t('lineRequired'),
        t('lineRequiredDesc'),
        [
          {
            text: t('selectLineTitle'),
            onPress: () => setShowLineaModal(true)
          },
          {
            text: t('cancel'),
            style: 'cancel'
          }
        ]
      );
      return;
    }

    // Validar cantidad
    const cantidad = parseInt(formData.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert(t('error'), t('quantityMustBePositive'));
      return;
    }

    // Verificar si el jig ya fue agregado
    if (jig?.id) {
      const jigYaAgregado = validations.some(v => 
        v.jig?.id === jig.id && v.modelo_actual === jig?.modelo_actual
      );
      
      if (jigYaAgregado) {
        Alert.alert(
          t('jigAlreadyAdded'),
          t('jigAlreadyAddedDesc', { number: jig?.numero_jig }),
          [
            {
              text: t('ok'),
              onPress: () => navigation.navigate('QRScanner')
            }
          ]
        );
        return;
      }
    }

    // Crear objeto de validación
    const validationData = {
      jig: jig,
      modelo_actual: jig?.modelo_actual,
      turno: formData.turno,
      estado: formData.estado,
      comentario: formData.comentario,
      cantidad: formData.cantidad,
      linea: formData.linea,
      created_at: new Date().toISOString()
    };

    // Agregar validación al contexto
    addValidation(validationData);

    // Obtener validaciones del modelo actual (después de agregar)
    const modelValidations = getValidationsByModel(jig?.modelo_actual);
    
    showAlert(
      t('validationAdded'),
      t('validationAddedDesc', { 
        number: jig?.numero_jig, 
        model: jig?.modelo_actual,
        count: modelValidations.length + 1
      }),
      [
        {
          text: t('continueScanning'),
          onPress: () => navigation.navigate('QRScanner')
        },
        {
          text: t('viewReport'),
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
        <ActivityIndicator size="large" color="#2196F3" />
        <Paragraph style={styles.loadingText}>
          {!jig ? t('loadingJigInfo') : t('checkingNGStatus')}
        </Paragraph>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#1A1A1A', '#2C2C2C', '#1A1A1A']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header con información del jig */}
        <Surface style={styles.headerCard} elevation={4}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Title style={styles.headerTitle}>🔍 {t('validateJig')}</Title>
              <Paragraph style={styles.headerSubtitle}>
                {jig.numero_jig || t('notAvailable')} • {translateJigType(jig.tipo)} • {jig.modelo_actual || t('notAvailable')}
            </Paragraph>
            </View>
            <View style={styles.headerRight}>
              <Chip 
                style={[styles.statusChip, { backgroundColor: jig.estado === 'activo' ? '#4CAF50' : '#FF9800' }]}
                textStyle={styles.chipText}
              >
                {jig.estado ? (jig.estado === 'activo' ? t('active') : t('inactive')) : t('notAvailable')}
              </Chip>
            </View>
          </View>
        </Surface>

        {/* Información del técnico */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>👤 {t('validatingTechnician')}</Title>
            <View style={styles.technicianInfo}>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>{t('name')}</Paragraph>
                <Paragraph style={styles.technicianValue}>{user?.nombre || t('notAvailable')}</Paragraph>
              </View>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>{t('assignedShift')}</Paragraph>
                <Chip 
                  style={[styles.turnoChip, { backgroundColor: getTurnoColor(userTurno) }]}
                  textStyle={styles.chipText}
                >
                  {t('shiftWithNumber', { number: userTurno })}
                </Chip>
              </View>
              </View>
          </Card.Content>
        </Card>

        {/* Formulario de validación */}
        <Card style={styles.formCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>📋 {t('validationData')}</Title>
            
            {/* Turno - Automático del usuario */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>{t('validationShift')} *</Paragraph>
              <Surface style={styles.turnoDisplayBox} elevation={2}>
                <View style={styles.turnoDisplayContent}>
                  <Chip 
                    style={[styles.turnoDisplayChip, { backgroundColor: getTurnoColor(userTurno) }]}
                    textStyle={styles.chipText}
                  >
                    {t('shiftWithNumber', { number: userTurno })}
                  </Chip>
                  <Paragraph style={styles.turnoDisplayText}>
                    {t('autoSetFromUser')}
                  </Paragraph>
                </View>
              </Surface>
            </View>
            
            <Divider style={styles.divider} />

            {/* Estado - Mejorado */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>{t('jigStatus')} *</Paragraph>
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
                  {t('okStatus')}
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
                  {t('ngStatus')}
                </Button>
              </View>
            </View>
            
            <Divider style={styles.divider} />

            {/* Comentario - Opciones predefinidas */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>{t('validationComments')} *</Paragraph>
              
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
                  {t('cleaning')}
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
                  {t('validated')}
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
                  {t('cleaningAndValidated')}
                </Button>
              </View>
            </View>

            {/* Cantidad - Siempre 1, no editable */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>{t('validatedQuantity')}</Paragraph>
              <Surface style={styles.cantidadBox} elevation={2}>
                <View style={styles.cantidadContentWrapper}>
                  <View style={styles.cantidadContent}>
                    <IconButton
                      icon="counter"
                      size={24}
                      iconColor="#FFFFFF"
                    />
                    <Paragraph style={styles.cantidadValue}>1</Paragraph>
                  </View>
                </View>
              </Surface>
            </View>

            {/* Línea - Modal con lista */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>{t('line')} *</Paragraph>
              <TouchableOpacity
                onPress={() => setShowLineaModal(true)}
                style={styles.lineaSelector}
              >
                <View style={styles.lineaSelectorContent}>
                  <Paragraph style={[styles.lineaSelectorText, !formData.linea && styles.lineaSelectorPlaceholder]}>
                    {formData.linea || t('selectLine')}
                  </Paragraph>
                  <IconButton
                    icon="chevron-down"
                    size={20}
                    iconColor="#B0B0B0"
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Modal para seleccionar línea */}
            <Modal
              visible={showLineaModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowLineaModal(false)}
            >
              <TouchableWithoutFeedback onPress={() => setShowLineaModal(false)}>
                <View style={styles.modalOverlay}>
                  <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Title style={styles.modalTitle}>{t('selectLineTitle')}</Title>
                        <IconButton
                          icon="close"
                          size={24}
                          onPress={() => setShowLineaModal(false)}
                        />
                      </View>
                      <Divider />
                      <ScrollView style={styles.modalList}>
                        {[1, 2, 3, 4, 5, 6].map((linea) => (
                          <TouchableOpacity
                            key={linea}
                            style={[
                              styles.modalItem,
                              formData.linea === `Línea ${linea}` && styles.modalItemSelected
                            ]}
                            onPress={() => {
                              const lineaSeleccionada = `Línea ${linea}`;
                              handleInputChange('linea', lineaSeleccionada);
                              // Guardar la línea para este modelo
                              if (jig?.modelo_actual) {
                                setLineaForModel(jig.modelo_actual, lineaSeleccionada);
                              }
                              setShowLineaModal(false);
                            }}
                          >
                            <Paragraph style={[
                              styles.modalItemText,
                              formData.linea === `Línea ${linea}` && styles.modalItemTextSelected
                            ]}>
                              {t('lineWithNumber', { number: linea })}
                            </Paragraph>
                            {formData.linea === `Línea ${linea}` && (
                              <IconButton
                                icon="check"
                                size={20}
                                iconColor="#4CAF50"
                              />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          </Card.Content>
        </Card>
            
        {/* Botones de acción - Mejorados */}
        <Surface style={styles.actionCard} elevation={2}>
          <View>
            <Button
              mode="contained"
              onPress={handleSubmitValidation}
            style={styles.submitButton}
              disabled={loading || !formData.linea || formData.linea.trim() === ''}
            icon={loading ? "loading" : "check-circle"}
            contentStyle={styles.submitButtonContent}
            >
            {loading ? t('validating') : t('validateJigButton')}
            </Button>
            {(!formData.linea || formData.linea.trim() === '') && (
              <Paragraph style={styles.warningText}>
                {t('selectLineWarning')}
              </Paragraph>
            )}
            
            <Button
              mode={formData.estado === 'NG' ? "contained" : "outlined"}
              onPress={() => {
                if (formData.estado === 'NG') {
                  navigation.navigate('QuickRepairJig', { 
                    jig: jig,
                    jigData: jig 
                  });
                }
              }}
              style={[
                styles.ngButton,
                formData.estado === 'NG' 
                  ? styles.ngButtonEnabled 
                  : styles.ngButtonDisabled
              ]}
              icon="alert-circle"
              textColor={formData.estado === 'NG' ? "#FFFFFF" : "#666666"}
            >
            {t('reportAsNG')}
            </Button>
          </View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    backgroundColor: '#121212',
  },
  // Header styles
  headerCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#2A4A6F',
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
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  technicianInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16, // Mejorado: Espaciado consistente entre elementos
    flexWrap: 'wrap', // Mejorado: Permite envolver en pantallas pequeñas
  },
  technicianItem: {
    flex: 1,
    minWidth: 120, // Mejorado: Ancho mínimo para evitar elementos muy pequeños
    flexBasis: '45%', // Mejorado: Tamaño base para distribución consistente
  },
  technicianLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  technicianValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  turnoChip: {
    borderRadius: 20,
  },
  // Form card styles
  formCard: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  turnoDisplayBox: {
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  turnoDisplayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  turnoDisplayChip: {
    borderRadius: 20,
  },
  turnoDisplayText: {
    fontSize: 12,
    color: '#B0B0B0',
    fontStyle: 'italic',
    marginLeft: 12,
    flex: 1,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#3A3A3A',
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
  cantidadBox: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    minHeight: 56,
    justifyContent: 'center',
  },
  cantidadContentWrapper: {
    overflow: 'hidden',
  },
  cantidadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  cantidadValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  // Action card styles
  actionCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    borderRadius: 8,
  },
  ngButtonEnabled: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
  },
  ngButtonDisabled: {
    backgroundColor: 'transparent',
    borderColor: '#666666',
    opacity: 0.5,
  },
  // Línea selector styles
  lineaSelector: {
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    minHeight: 56,
    justifyContent: 'center',
  },
  lineaSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  lineaSelectorText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  lineaSelectorPlaceholder: {
    color: '#808080',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalItemSelected: {
    backgroundColor: '#2A4A2A',
  },
  modalItemText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  modalItemTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
});
