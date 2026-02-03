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

export default function AddAdaptadorScreen({ navigation, route }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [showModeloModal, setShowModeloModal] = useState(false);
  
  const [formData, setFormData] = useState({
    codigo_qr: route?.params?.codigo_qr || '',
    tipo: '', // 'adaptador' o 'convertidor'
    modelo_adaptador: '',
    numero_adaptador: '' // Se extrae del QR según el tipo
  });

  // Modelos disponibles según tipo
  const modelosAdaptador = ['ADA20100_01', 'ADA20100_02', 'CSTH-100/ZH-S20'];
  const modelosConvertidor = ['11477', '11479'];

  // Obtener modelos según tipo seleccionado
  const modelosDisponibles = formData.tipo === 'adaptador' ? modelosAdaptador : modelosConvertidor;

  // Función para extraer número del adaptador desde QR
  const extraerNumeroAdaptador = (qr, tipo) => {
    if (!qr) return '';
    
    if (tipo === 'adaptador') {
      // Para adaptadores: últimos dígitos después del guion bajo (_)
      const partes = qr.split('_');
      if (partes.length > 1) {
        return partes[partes.length - 1];
      }
      // Si no hay guion bajo, intentar con guion medio como fallback
      const partesGuion = qr.split('-');
      if (partesGuion.length > 1) {
        return partesGuion[partesGuion.length - 1];
      }
    } else if (tipo === 'convertidor') {
      // Para convertidores: últimos dígitos después del guion medio (-)
      const partes = qr.split('-');
      if (partes.length > 1) {
        return partes[partes.length - 1];
      }
    }
    
    return '';
  };

  // Auto-extraer número cuando cambie el QR o el tipo
  useEffect(() => {
    if (formData.codigo_qr && formData.tipo) {
      const numero = extraerNumeroAdaptador(formData.codigo_qr, formData.tipo);
      setFormData(prev => ({
        ...prev,
        numero_adaptador: numero
      }));
    }
  }, [formData.codigo_qr, formData.tipo]);

  // Resetear modelo cuando cambie el tipo
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      modelo_adaptador: ''
    }));
  }, [formData.tipo]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Si cambia codigo_qr y ya hay tipo, extraer número
    if (field === 'codigo_qr' && formData.tipo) {
      const numero = extraerNumeroAdaptador(value, formData.tipo);
      setFormData(prev => ({
        ...prev,
        numero_adaptador: numero
      }));
    }
  };

  const handleSelectTipo = (tipo) => {
    setShowTipoModal(false);
    
    // Actualizar tipo y extraer número en una sola actualización
    setFormData(prev => {
      const numero = prev.codigo_qr ? extraerNumeroAdaptador(prev.codigo_qr, tipo) : '';
      return {
        ...prev,
        tipo: tipo,
        modelo_adaptador: '', // Resetear modelo al cambiar tipo
        numero_adaptador: numero
      };
    });
  };

  const handleSelectModelo = (modelo) => {
    setFormData(prev => ({
      ...prev,
      modelo_adaptador: modelo
    }));
    setShowModeloModal(false);
  };

  const handleSubmit = async () => {
    // Validar campos requeridos
    if (!formData.codigo_qr || !formData.tipo || !formData.modelo_adaptador) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    if (!formData.numero_adaptador) {
      Alert.alert('Error', 'No se pudo extraer el número del adaptador/convertidor del código QR. Verifica el formato.');
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
        // Navegar al home de adaptadores
        navigation.navigate('AdaptadoresHome');
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
      primary: '#2196F3',
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
              labelStyle={styles.inputLabel}
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
              labelStyle={styles.inputLabel}
              theme={darkTheme}
              helperText="Se extrae automáticamente del QR"
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
                  <IconButton
                    icon="chevron-down"
                    size={20}
                    iconColor="#B0B0B0"
                  />
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
                    <IconButton
                      icon="chevron-down"
                      size={20}
                      iconColor="#B0B0B0"
                    />
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
              borderColor="#404040"
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
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={() => setShowTipoModal(false)}
                  />
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
                    {formData.tipo === 'adaptador' && (
                      <IconButton
                        icon="check"
                        size={20}
                        iconColor="#4CAF50"
                      />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalItem, formData.tipo === 'convertidor' && styles.modalItemSelected]}
                    onPress={() => handleSelectTipo('convertidor')}
                  >
                    <Paragraph style={[styles.modalItemText, formData.tipo === 'convertidor' && styles.modalItemTextSelected]}>
                      Convertidor
                    </Paragraph>
                    {formData.tipo === 'convertidor' && (
                      <IconButton
                        icon="check"
                        size={20}
                        iconColor="#4CAF50"
                      />
                    )}
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
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={() => setShowModeloModal(false)}
                  />
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
                      {formData.modelo_adaptador === modelo && (
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212'
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 20,
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
    elevation: 6,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#2C2C2C',
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
