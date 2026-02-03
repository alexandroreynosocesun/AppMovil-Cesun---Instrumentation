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
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  ActivityIndicator,
  Chip,
  Divider,
  Surface,
  IconButton
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../contexts/ValidationContext';
import { jigNGService } from '../services/JigNGService';
import logger from '../utils/logger';
import { showAlert } from '../utils/alertUtils';

export default function QuickRepairJigScreen({ route, navigation }) {
  const { jig, jigData, fromManualValidation } = route.params || {};
  const { user } = useAuth();
  const { addValidation, getValidationsByModel, setLineaForModel, getLineaForModel, validations } = useValidation();
  
  const [loading, setLoading] = useState(false);
  const [showLineaModal, setShowLineaModal] = useState(false);
  const [formData, setFormData] = useState({
    turno: user?.turno_actual || 'A',
    comentarioReparacion: '',
    linea: ''
  });

  // Cargar línea guardada para este modelo cuando se monte el componente
  useEffect(() => {
    if (jig?.modelo_actual || jigData?.modelo_actual) {
      const modelo = jig?.modelo_actual || jigData?.modelo_actual;
      const lineaGuardada = getLineaForModel(modelo);
      if (lineaGuardada) {
        logger.info('📥 Cargando línea guardada para modelo', modelo, ':', lineaGuardada);
        setFormData(prev => ({
          ...prev,
          linea: lineaGuardada
        }));
      }
    }
  }, [jig?.modelo_actual, jigData?.modelo_actual, getLineaForModel]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Si se cambia la línea, guardarla para este modelo
    if (field === 'linea') {
      const modelo = jig?.modelo_actual || jigData?.modelo_actual;
      if (modelo) {
        setLineaForModel(modelo, value);
      }
    }
  };

  const markNgAsRepaired = async (jigToUse, comentarioCompleto) => {
    if (!jigToUse?.id) return;
    try {
      const ngResult = await jigNGService.getJigsNGByJigId(jigToUse.id);
      if (!ngResult?.success || !Array.isArray(ngResult.data)) return;

      const activeNg = ngResult.data.find(ng => {
        const estado = String(ng.estado || '').toLowerCase();
        return estado === 'pendiente' || estado === 'en_reparacion' || estado === 'en reparación';
      });

      if (!activeNg?.id) return;

      await jigNGService.updateJigNG(activeNg.id, {
        estado: 'reparado',
        comentario_reparacion: comentarioCompleto,
        usuario_reparando: user?.nombre || user?.username || 'Usuario actual'
      });
    } catch (error) {
      logger.error('Error marcando jig NG como reparado:', error);
    }
  };

  const handleSubmit = async () => {
    // Validar campos requeridos
    if (!formData.comentarioReparacion || formData.comentarioReparacion.trim() === '') {
      Alert.alert('Error', 'Por favor ingresa un comentario de reparación');
      return;
    }

    // Validar que se haya seleccionado una línea
    if (!formData.linea || formData.linea.trim() === '') {
      Alert.alert(
        'Línea Requerida',
        'Debes seleccionar una línea antes de continuar.\n\nPor favor, selecciona la línea de producción.',
        [
          {
            text: 'Seleccionar Línea',
            onPress: () => setShowLineaModal(true)
          },
          {
            text: 'Cancelar',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    const jigToUse = jig || jigData;
    if (!jigToUse) {
      Alert.alert('Error', 'No se encontró información del jig');
      return;
    }

    // Verificar si el jig ya fue agregado
    if (jigToUse?.id) {
      const jigYaAgregado = validations.some(v => 
        v.jig?.id === jigToUse.id && v.modelo_actual === jigToUse?.modelo_actual
      );
      
      if (jigYaAgregado) {
        Alert.alert(
          'Jig Ya Agregado',
          `El jig ${jigToUse?.numero_jig} ya ha sido agregado a las validaciones de este modelo.\n\nNo se puede agregar el mismo jig dos veces.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
        return;
      }
    }

    // Crear objeto de validación con comentario de reparación
    const comentarioCompleto = fromManualValidation
      ? `Reparado y Validado: ${formData.comentarioReparacion.trim()}`
      : `Reparado: ${formData.comentarioReparacion.trim()}`;
    
    const validationData = {
      jig: jigToUse,
      modelo_actual: jigToUse?.modelo_actual,
      turno: formData.turno,
      estado: 'OK', // Siempre OK porque se reparó
      comentario: comentarioCompleto,
      cantidad: '1',
      linea: formData.linea,
      created_at: new Date().toISOString()
    };

    setLoading(true);
    try {
      await markNgAsRepaired(jigToUse, comentarioCompleto);

      // Agregar validación al contexto
      addValidation(validationData);

      // Obtener validaciones del modelo actual (después de agregar)
      const modelValidations = getValidationsByModel(jigToUse?.modelo_actual);
      
      showAlert(
        '✅ Jig Reparado y Agregado',
        `Jig ${jigToUse?.numero_jig} reparado y agregado al reporte como OK.\n\nModelo: ${jigToUse?.modelo_actual}\nValidaciones: ${modelValidations.length + 1}/14`,
        [
          {
            text: fromManualValidation ? 'Continuar Validando' : 'Continuar Escaneando',
            onPress: () => {
              if (fromManualValidation) {
                navigation.navigate('AllJigs', {
                  validationModeReturn: true,
                  model: jigToUse?.modelo_actual,
                  type: jigToUse?.tipo
                });
              } else {
                navigation.navigate('QRScanner');
              }
            }
          },
          {
            text: 'Ver Reporte',
            onPress: () => navigation.navigate('Reporte', { 
              modelValidations: [...modelValidations, validationData],
              currentModel: jigToUse?.modelo_actual
            })
          }
        ]
      );
    } finally {
      setLoading(false);
    }
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

  const jigToUse = jig || jigData;

  if (!jigToUse) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Paragraph style={styles.loadingText}>Cargando información del jig...</Paragraph>
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
          <View style={styles.headerContentWrapper}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Title style={styles.headerTitle}>🔧 Reparar Jig</Title>
                <Paragraph style={styles.headerSubtitle}>
                  {jigToUse.numero_jig} • {jigToUse.tipo} • {jigToUse.modelo_actual}
                </Paragraph>
              </View>
              <View style={styles.headerRight}>
                <Chip 
                  style={[styles.statusChip, { backgroundColor: '#FF9800' }]}
                  textStyle={styles.chipText}
                >
                  REPARACIÓN
                </Chip>
              </View>
            </View>
          </View>
        </Surface>

        {/* Información del técnico */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>👤 Técnico Reparando</Title>
            <View style={styles.technicianInfo}>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>Nombre:</Paragraph>
                <Paragraph style={styles.technicianValue}>{user?.nombre || 'N/A'}</Paragraph>
              </View>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>Turno:</Paragraph>
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

        {/* Formulario de reparación */}
        <Card style={styles.formCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>📋 Datos de Reparación</Title>
            
            {/* Turno */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>Turno *</Paragraph>
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

            {/* Comentario de Reparación */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>Comentario de Reparación *</Paragraph>
              <TextInput
                label="¿Qué se reparó?"
                value={formData.comentarioReparacion}
                onChangeText={(text) => handleInputChange('comentarioReparacion', text)}
                style={styles.textInput}
                mode="outlined"
                multiline
                numberOfLines={4}
                placeholder="Describe qué se reparó en el jig..."
              />
            </View>

            <Divider style={styles.divider} />

            {/* Línea - Modal con lista */}
            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>Línea *</Paragraph>
              <TouchableOpacity
                onPress={() => setShowLineaModal(true)}
                style={styles.lineaSelector}
              >
                <View style={styles.lineaSelectorContent}>
                  <Paragraph style={[styles.lineaSelectorText, !formData.linea && styles.lineaSelectorPlaceholder]}>
                    {formData.linea || 'Selecciona la línea'}
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
                        <Title style={styles.modalTitle}>Seleccionar Línea</Title>
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
                              const modelo = jigToUse?.modelo_actual;
                              if (modelo) {
                                setLineaForModel(modelo, lineaSeleccionada);
                              }
                              setShowLineaModal(false);
                            }}
                          >
                            <Paragraph style={[
                              styles.modalItemText,
                              formData.linea === `Línea ${linea}` && styles.modalItemTextSelected
                            ]}>
                              Línea {linea}
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
            
        {/* Botones de acción */}
        <Surface style={styles.actionCard} elevation={2}>
          <View>
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.submitButton}
              disabled={loading || !formData.linea || formData.linea.trim() === '' || !formData.comentarioReparacion || formData.comentarioReparacion.trim() === ''}
              icon={loading ? "loading" : "check-circle"}
              contentStyle={styles.submitButtonContent}
            >
              {loading ? 'Guardando...' : 'Reparar y Agregar como OK'}
            </Button>
            {(!formData.linea || formData.linea.trim() === '') && (
              <Paragraph style={styles.warningText}>
                ⚠️ Debes seleccionar una línea para continuar
              </Paragraph>
            )}
            {(!formData.comentarioReparacion || formData.comentarioReparacion.trim() === '') && (
              <Paragraph style={styles.warningText}>
                ⚠️ Debes ingresar un comentario de reparación
              </Paragraph>
            )}
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
  headerCard: {
    backgroundColor: '#FF9800',
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
    borderColor: '#FFB74D',
  },
  headerContentWrapper: {
    overflow: 'hidden',
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
    color: '#FFF3E0',
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
    gap: 16,
    flexWrap: 'wrap',
  },
  technicianItem: {
    flex: 1,
    minWidth: 120,
    flexBasis: '45%',
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
  turnoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  turnoButton: {
    flex: 1,
    flexBasis: '30%',
    borderRadius: 8,
    minWidth: 80,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#3A3A3A',
    height: 2,
    borderRadius: 1,
  },
  textInput: {
    marginBottom: 8,
  },
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

