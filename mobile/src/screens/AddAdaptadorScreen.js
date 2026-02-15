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
  Button,
  Card,
  Title,
  TextInput,
  Paragraph,
  ActivityIndicator,
  Divider,
  IconButton
} from 'react-native-paper';
import { adaptadorService } from '../services/AdaptadorService';
import { useLanguage } from '../contexts/LanguageContext';
import logger from '../utils/logger';

// Modelos disponibles según tipo
const modelosAdaptador = ['ADA20100_01', 'ADA20100_02', 'CSTH-100/ZH-S20'];
const modelosConvertidor = ['11477', '11479'];

const generarQR = (tipo, modelo, numero) => {
  if (!numero) return '';
  if (tipo === 'adaptador') {
    switch (modelo) {
      case 'ADA20100_01': return `250515_${numero}`;
      case 'ADA20100_02': return `250515_${numero}`;
      case 'CSTH-100/ZH-S20': return `MLA-MANY-NA-${numero}`;
      default: return '';
    }
  } else if (tipo === 'convertidor') {
    switch (modelo) {
      case '11477': return `C-11477-NA-${numero}`;
      case '11479': return `C-11479-NA-${numero}`;
      default: return '';
    }
  }
  return '';
};

export default function AddAdaptadorScreen({ navigation, route }) {
  const { t } = useLanguage();
  const isManual = !route?.params?.codigo_qr;
  const [loading, setLoading] = useState(false);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [showModeloModal, setShowModeloModal] = useState(false);
  const [manualStep, setManualStep] = useState(isManual ? 1 : 0); // 0=scan, 1=tipo, 2=modelo, 3=numero

  const [formData, setFormData] = useState({
    codigo_qr: route?.params?.codigo_qr || '',
    tipo: '',
    modelo_adaptador: '',
    numero_adaptador: ''
  });

  const modelosDisponibles = formData.tipo === 'adaptador' ? modelosAdaptador : modelosConvertidor;

  // Función para extraer número del adaptador desde QR
  const extraerNumeroAdaptador = (qr, tipo) => {
    if (!qr) return '';
    if (tipo === 'adaptador') {
      const partes = qr.split('_');
      if (partes.length > 1) return partes[partes.length - 1];
      const partesGuion = qr.split('-');
      if (partesGuion.length > 1) return partesGuion[partesGuion.length - 1];
    } else if (tipo === 'convertidor') {
      const partes = qr.split('-');
      if (partes.length > 1) return partes[partes.length - 1];
    }
    return '';
  };

  // Para flujo QR: auto-extraer número
  useEffect(() => {
    if (!isManual && formData.codigo_qr && formData.tipo) {
      const numero = extraerNumeroAdaptador(formData.codigo_qr, formData.tipo);
      setFormData(prev => ({ ...prev, numero_adaptador: numero }));
    }
  }, [formData.codigo_qr, formData.tipo]);

  // Para flujo QR: resetear modelo cuando cambie el tipo
  useEffect(() => {
    if (!isManual) {
      setFormData(prev => ({ ...prev, modelo_adaptador: '' }));
    }
  }, [formData.tipo]);

  // Para flujo manual: auto-generar QR cuando cambia número
  useEffect(() => {
    if (isManual && formData.tipo && formData.modelo_adaptador && formData.numero_adaptador) {
      const qr = generarQR(formData.tipo, formData.modelo_adaptador, formData.numero_adaptador);
      setFormData(prev => ({ ...prev, codigo_qr: qr }));
    }
  }, [formData.numero_adaptador, formData.modelo_adaptador, formData.tipo]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (!isManual && field === 'codigo_qr' && formData.tipo) {
      const numero = extraerNumeroAdaptador(value, formData.tipo);
      setFormData(prev => ({ ...prev, numero_adaptador: numero }));
    }
  };

  const handleSelectTipo = (tipo) => {
    setShowTipoModal(false);
    if (isManual) {
      setFormData(prev => ({ ...prev, tipo, modelo_adaptador: '', numero_adaptador: '', codigo_qr: '' }));
      setManualStep(2);
    } else {
      setFormData(prev => {
        const numero = prev.codigo_qr ? extraerNumeroAdaptador(prev.codigo_qr, tipo) : '';
        return { ...prev, tipo, modelo_adaptador: '', numero_adaptador: numero };
      });
    }
  };

  const handleSelectModelo = (modelo) => {
    setFormData(prev => ({ ...prev, modelo_adaptador: modelo }));
    setShowModeloModal(false);
    if (isManual) {
      setManualStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!formData.codigo_qr || !formData.tipo || !formData.modelo_adaptador) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }
    if (!formData.numero_adaptador) {
      Alert.alert('Error', 'Ingresa el número del adaptador/convertidor.');
      return;
    }

    setLoading(true);
    try {
      const dataToSend = {
        codigo_qr: formData.codigo_qr,
        numero_adaptador: formData.numero_adaptador,
        modelo_adaptador: formData.modelo_adaptador
      };

      const result = await adaptadorService.createAdaptador(dataToSend);
      if (result.success) {
        Alert.alert('Éxito', 'Registro creado correctamente.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Error al crear adaptador/convertidor');
      }
    } catch (error) {
      logger.error('Error creando adaptador:', error);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const darkTheme = {
    colors: {
      primary: '#4CAF50',
      background: '#121212',
      surface: '#1E1E1E',
      text: '#FFFFFF',
      placeholder: '#B0B0B0',
      error: '#F44336',
      onSurface: '#FFFFFF',
      onSurfaceVariant: '#E0E0E0',
      outline: '#666666',
    },
  };

  // ===== FLUJO MANUAL: Paso 1 - Seleccionar tipo =====
  if (isManual && manualStep === 1) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Selecciona tipo</Title>
              <Paragraph style={styles.stepHint}>Paso 1 de 3</Paragraph>
              <TouchableOpacity
                style={styles.categoryCard}
                onPress={() => handleSelectTipo('adaptador')}
                activeOpacity={0.7}
              >
                <Paragraph style={styles.categoryLabel}>Adaptador</Paragraph>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.categoryCard}
                onPress={() => handleSelectTipo('convertidor')}
                activeOpacity={0.7}
              >
                <Paragraph style={styles.categoryLabel}>Convertidor</Paragraph>
              </TouchableOpacity>
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    );
  }

  // ===== FLUJO MANUAL: Paso 2 - Seleccionar modelo =====
  if (isManual && manualStep === 2) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Selecciona modelo</Title>
              <Paragraph style={styles.stepHint}>
                Paso 2 de 3 — {formData.tipo === 'adaptador' ? 'Adaptador' : 'Convertidor'}
              </Paragraph>
              {modelosDisponibles.map(modelo => (
                <TouchableOpacity
                  key={modelo}
                  style={styles.categoryCard}
                  onPress={() => handleSelectModelo(modelo)}
                  activeOpacity={0.7}
                >
                  <Paragraph style={styles.categoryLabel}>{modelo}</Paragraph>
                </TouchableOpacity>
              ))}
              <Button
                mode="outlined"
                onPress={() => {
                  setManualStep(1);
                  setFormData(prev => ({ ...prev, tipo: '', modelo_adaptador: '', numero_adaptador: '', codigo_qr: '' }));
                }}
                textColor="#B0B0B0"
                style={styles.backBtn}
              >
                Cambiar tipo
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    );
  }

  // ===== FLUJO MANUAL: Paso 3 - Ingresar número =====
  if (isManual && manualStep === 3) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Ingresa el número</Title>
              <Paragraph style={styles.stepHint}>
                Paso 3 de 3 — {formData.tipo === 'adaptador' ? 'Adaptador' : 'Convertidor'} / {formData.modelo_adaptador}
              </Paragraph>

              <TextInput
                label="Número de etiqueta"
                value={formData.numero_adaptador}
                onChangeText={(value) => handleInputChange('numero_adaptador', value)}
                mode="outlined"
                style={styles.input}
                placeholder="Ej: 001, 045..."
                textColor="#FFFFFF"
                placeholderTextColor="#808080"
                outlineColor="#3A3A3A"
                activeOutlineColor="#4CAF50"
                autoFocus
                theme={darkTheme}
              />

              {formData.codigo_qr ? (
                <View style={styles.qrPreview}>
                  <Paragraph style={styles.qrPreviewLabel}>QR generado:</Paragraph>
                  <Paragraph style={styles.qrPreviewValue}>{formData.codigo_qr}</Paragraph>
                </View>
              ) : null}

              <View style={styles.manualButtons}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setManualStep(2);
                    setFormData(prev => ({ ...prev, modelo_adaptador: '', numero_adaptador: '', codigo_qr: '' }));
                  }}
                  textColor="#B0B0B0"
                  style={styles.backBtn}
                >
                  Cambiar modelo
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  buttonColor="#4CAF50"
                  style={styles.saveBtn}
                  contentStyle={styles.saveButtonContent}
                  labelStyle={styles.saveButtonLabel}
                  loading={loading}
                  disabled={loading || !formData.numero_adaptador.trim()}
                >
                  Guardar
                </Button>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ===== FLUJO QR (escaneado): formulario original =====
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Agregar Adaptador/Convertidor</Title>

            <TextInput
              label="Código QR *"
              value={formData.codigo_qr}
              onChangeText={(text) => handleInputChange('codigo_qr', text)}
              style={styles.input}
              mode="outlined"
              textColor="#FFFFFF"
              placeholderTextColor="#B0B0B0"
              theme={darkTheme}
            />

            <TextInput
              label="Número de Adaptador/Convertidor"
              value={formData.numero_adaptador}
              editable={false}
              style={styles.input}
              mode="outlined"
              textColor="#FFFFFF"
              placeholderTextColor="#B0B0B0"
              theme={darkTheme}
            />

            <Divider style={styles.divider} />

            <View style={styles.inputSection}>
              <Paragraph style={styles.inputLabel}>Tipo *</Paragraph>
              <TouchableOpacity
                onPress={() => setShowTipoModal(true)}
                style={styles.selector}
              >
                <View style={styles.selectorContent}>
                  <Paragraph style={[styles.selectorText, !formData.tipo && styles.selectorPlaceholder]}>
                    {formData.tipo === 'adaptador' ? 'Adaptador' : formData.tipo === 'convertidor' ? 'Convertidor' : 'Seleccionar tipo'}
                  </Paragraph>
                  <IconButton icon="chevron-down" size={20} iconColor="#B0B0B0" />
                </View>
              </TouchableOpacity>
            </View>

            {formData.tipo && (
              <View style={styles.inputSection}>
                <Paragraph style={styles.inputLabel}>
                  Modelo {formData.tipo === 'adaptador' ? 'Adaptador' : 'Convertidor'} *
                </Paragraph>
                <TouchableOpacity
                  onPress={() => setShowModeloModal(true)}
                  style={styles.selector}
                >
                  <View style={styles.selectorContent}>
                    <Paragraph style={[styles.selectorText, !formData.modelo_adaptador && styles.selectorPlaceholder]}>
                      {formData.modelo_adaptador || 'Seleccionar modelo'}
                    </Paragraph>
                    <IconButton icon="chevron-down" size={20} iconColor="#B0B0B0" />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.button}
              loading={loading}
              disabled={loading || !formData.codigo_qr || !formData.tipo || !formData.modelo_adaptador}
              buttonColor="#4CAF50"
              textColor="#FFFFFF"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>

            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.button}
              textColor="#B0B0B0"
              disabled={loading}
            >
              Cancelar
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Modal para seleccionar tipo */}
      <Modal
        visible={showTipoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTipoModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTipoModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Title style={styles.modalTitle}>Seleccionar Tipo</Title>
                  <IconButton icon="close" size={24} onPress={() => setShowTipoModal(false)} />
                </View>
                <Divider />
                <ScrollView style={styles.modalList}>
                  <TouchableOpacity
                    style={[styles.modalItem, formData.tipo === 'adaptador' && styles.modalItemSelected]}
                    onPress={() => handleSelectTipo('adaptador')}
                  >
                    <Paragraph style={[styles.modalItemText, formData.tipo === 'adaptador' && styles.modalItemTextSelected]}>
                      Adaptador
                    </Paragraph>
                    {formData.tipo === 'adaptador' && <IconButton icon="check" size={20} iconColor="#4CAF50" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalItem, formData.tipo === 'convertidor' && styles.modalItemSelected]}
                    onPress={() => handleSelectTipo('convertidor')}
                  >
                    <Paragraph style={[styles.modalItemText, formData.tipo === 'convertidor' && styles.modalItemTextSelected]}>
                      Convertidor
                    </Paragraph>
                    {formData.tipo === 'convertidor' && <IconButton icon="check" size={20} iconColor="#4CAF50" />}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal para seleccionar modelo */}
      <Modal
        visible={showModeloModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModeloModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowModeloModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Title style={styles.modalTitle}>
                    Seleccionar Modelo {formData.tipo === 'adaptador' ? 'Adaptador' : 'Convertidor'}
                  </Title>
                  <IconButton icon="close" size={24} onPress={() => setShowModeloModal(false)} />
                </View>
                <Divider />
                <ScrollView style={styles.modalList}>
                  {modelosDisponibles.map((modelo) => (
                    <TouchableOpacity
                      key={modelo}
                      style={[styles.modalItem, formData.modelo_adaptador === modelo && styles.modalItemSelected]}
                      onPress={() => handleSelectModelo(modelo)}
                    >
                      <Paragraph style={[styles.modalItemText, formData.modelo_adaptador === modelo && styles.modalItemTextSelected]}>
                        {modelo}
                      </Paragraph>
                      {formData.modelo_adaptador === modelo && <IconButton icon="check" size={20} iconColor="#4CAF50" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 22,
    fontWeight: '700',
  },
  stepHint: {
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#1E1E1E',
  },
  inputLabel: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputSection: {
    marginBottom: 20,
  },
  categoryCard: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    paddingVertical: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#333',
    alignItems: 'center',
  },
  categoryLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  qrPreview: {
    backgroundColor: '#0F0F0F',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  qrPreviewLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  qrPreviewValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  manualButtons: {
    gap: 10,
  },
  backBtn: {
    borderColor: '#555',
    borderRadius: 10,
  },
  saveBtn: {
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 12,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  selector: {
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    minHeight: 56,
    justifyContent: 'center',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  selectorText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  selectorPlaceholder: {
    color: '#808080',
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#404040',
  },
  button: {
    marginBottom: 12,
    borderRadius: 12,
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
});
