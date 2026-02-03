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
  ActivityIndicator
} from 'react-native-paper';
import { adaptadorService } from '../services/AdaptadorService';
import logger from '../utils/logger';

const CATEGORIES = [
  { key: 'vbyone', label: 'VByOne', modelo: 'VBYONE' },
  { key: 'mini_lvds', label: 'Mini LVDS', modelo: 'MINI_LVDS' },
  { key: 'lvds_2k', label: '2K LVDS', modelo: 'LVDS_2K' },
];

export default function AddVByOneScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [formData, setFormData] = useState({
    codigo_qr: route?.params?.codigo_qr || '',
    categoria: route?.params?.category || '',
    modelo_adaptador: '',
    numero_adaptador: ''
  });

  const getCategoriaByKey = (key) => CATEGORIES.find(c => c.key === key);

  useEffect(() => {
    if (formData.categoria) {
      const categoria = getCategoriaByKey(formData.categoria);
      setFormData(prev => ({
        ...prev,
        modelo_adaptador: categoria ? categoria.modelo : prev.modelo_adaptador
      }));
    }
  }, [formData.categoria]);

  const extraerNumero = (qr) => {
    if (!qr) return '';
    const partes = qr.split('-');
    if (partes.length > 1) {
      return partes[partes.length - 1];
    }
    return '';
  };

  useEffect(() => {
    if (formData.codigo_qr) {
      const numero = extraerNumero(formData.codigo_qr);
      setFormData(prev => ({
        ...prev,
        numero_adaptador: numero
      }));
    }
  }, [formData.codigo_qr]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectCategoria = (categoriaKey) => {
    const categoria = getCategoriaByKey(categoriaKey);
    setFormData(prev => ({
      ...prev,
      categoria: categoriaKey,
      modelo_adaptador: categoria ? categoria.modelo : prev.modelo_adaptador
    }));
    setShowCategoriaModal(false);
  };

  const handleSave = async () => {
    if (!formData.codigo_qr.trim()) {
      Alert.alert('Falta QR', 'Escanea o escribe el código QR.');
      return;
    }
    if (!formData.categoria) {
      Alert.alert('Falta categoría', 'Selecciona una categoría.');
      return;
    }
    if (!formData.numero_adaptador.trim()) {
      Alert.alert('Número inválido', 'No se pudo extraer el número del QR.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        codigo_qr: formData.codigo_qr.trim(),
        numero_adaptador: formData.numero_adaptador.trim(),
        modelo_adaptador: formData.modelo_adaptador,
        conectores: [formData.modelo_adaptador]
      };

      const result = await adaptadorService.createAdaptador(payload);
      if (result.success) {
        Alert.alert('Éxito', 'Registro creado correctamente.', [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]);
      } else {
        Alert.alert('Error', result.error || 'No se pudo crear el registro.');
      }
    } catch (error) {
      logger.error('Error creando registro:', error);
      Alert.alert('Error', 'Error al crear el registro.');
    } finally {
      setLoading(false);
    }
  };

  const categoriaSeleccionada = getCategoriaByKey(formData.categoria);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Agregar VByOne / Mini LVDS / 2K LVDS</Title>

            <TextInput
              label="Código QR"
              value={formData.codigo_qr}
              onChangeText={(value) => handleInputChange('codigo_qr', value)}
              mode="outlined"
              style={styles.input}
              placeholder="Escanea o escribe el QR"
              textColor="#FFFFFF"
              placeholderTextColor="#808080"
              outlineColor="#3A3A3A"
              activeOutlineColor="#FF9800"
              theme={{
                colors: {
                  primary: '#FF9800',
                  background: '#1E1E1E',
                  surface: '#1E1E1E',
                  text: '#FFFFFF',
                  placeholder: '#808080',
                }
              }}
            />

            <TouchableOpacity onPress={() => setShowCategoriaModal(true)} activeOpacity={0.7}>
              <View pointerEvents="none">
                <TextInput
                  label="Categoría"
                  value={categoriaSeleccionada ? categoriaSeleccionada.label : ''}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Selecciona categoría"
                  textColor="#FFFFFF"
                  placeholderTextColor="#808080"
                  outlineColor="#3A3A3A"
                  activeOutlineColor="#FF9800"
                  right={<TextInput.Icon icon="chevron-down" color="#888888" />}
                  theme={{
                    colors: {
                      primary: '#FF9800',
                      background: '#1E1E1E',
                      surface: '#1E1E1E',
                      text: '#FFFFFF',
                      placeholder: '#808080',
                    }
                  }}
                />
              </View>
            </TouchableOpacity>

            <TextInput
              label="Número"
              value={formData.numero_adaptador}
              onChangeText={(value) => handleInputChange('numero_adaptador', value)}
              mode="outlined"
              style={styles.input}
              placeholder="Se extrae del QR"
              textColor="#FFFFFF"
              placeholderTextColor="#808080"
              outlineColor="#3A3A3A"
              activeOutlineColor="#FF9800"
              theme={{
                colors: {
                  primary: '#FF9800',
                  background: '#1E1E1E',
                  surface: '#1E1E1E',
                  text: '#FFFFFF',
                  placeholder: '#808080',
                }
              }}
            />

            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
              contentStyle={styles.saveButtonContent}
              labelStyle={styles.saveButtonLabel}
              loading={loading}
              disabled={loading}
            >
              Guardar
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Modal
        visible={showCategoriaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoriaModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCategoriaModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Title style={styles.modalTitle}>Selecciona categoría</Title>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={styles.modalOption}
                    onPress={() => handleSelectCategoria(cat.key)}
                  >
                    <Paragraph style={styles.modalOptionText}>{cat.label}</Paragraph>
                  </TouchableOpacity>
                ))}
                <Button
                  mode="outlined"
                  onPress={() => setShowCategoriaModal(false)}
                  style={styles.modalCancelButton}
                  textColor="#F44336"
                >
                  Cancelar
                </Button>
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
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#1E1E1E',
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#FF9800',
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 12,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    padding: 20,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#FFFFFF',
  },
  modalOption: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0F0F0F',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalOptionText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
  },
  modalCancelButton: {
    marginTop: 8,
    borderColor: '#F44336',
  },
});
