import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  Platform,
  Text,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  ActivityIndicator,
  RadioButton,
  Divider,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import damagedLabelService from '../services/DamagedLabelService';
import { jigService } from '../services/JigService';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

export default function DamagedLabelScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingJigs, setLoadingJigs] = useState(false);
  const [allJigs, setAllJigs] = useState([]);
  const [jigSuggestions, setJigSuggestions] = useState([]);
  const [formData, setFormData] = useState({
    modelo: '',
    tipo_jig: '',
    numero_jig: '',
    foto: null,
  });

  useEffect(() => {
    const loadJigs = async () => {
      try {
        setLoadingJigs(true);
        const result = await jigService.getJigsForAutocomplete();
        if (result.success && Array.isArray(result.data)) {
          setAllJigs(result.data);
          logger.info('✅ [DamagedLabelScreen] Jigs cargados para autocompletado:', result.data.length);
        } else {
          logger.warn('⚠️ [DamagedLabelScreen] No se pudieron cargar jigs para autocompletado', result);
        }
      } catch (error) {
        logger.error('❌ [DamagedLabelScreen] Error cargando jigs para autocompletado:', error);
      } finally {
        setLoadingJigs(false);
      }
    };

    loadJigs();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleModeloChange = (text) => {
    handleInputChange('modelo', text);

    const query = text.trim().toLowerCase();

    if (!query || allJigs.length === 0) {
      setJigSuggestions([]);
      return;
    }

    // Buscar solo por modelo_actual y obtener modelos únicos
    const modelosUnicos = new Map();
    allJigs.forEach((jig) => {
      const modelo = jig.modelo_actual || '';
      if (modelo && modelo.toLowerCase().includes(query)) {
        if (!modelosUnicos.has(modelo)) {
          modelosUnicos.set(modelo, jig);
        }
      }
    });

    // Convertir a array y limitar a 10 sugerencias
    const suggestions = Array.from(modelosUnicos.values()).slice(0, 10);
    setJigSuggestions(suggestions);
  };

  const handleSelectJigSuggestion = (jig) => {
    setFormData(prev => ({
      ...prev,
      modelo: jig.modelo_actual || prev.modelo,
      tipo_jig: ['manual', 'semiautomatico', 'new_semiautomatico'].includes(jig.tipo)
        ? jig.tipo
        : prev.tipo_jig,
    }));
    setJigSuggestions([]);
  };

  const handleTakePhoto = async () => {
    try {
      // Solicitar permisos
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Necesitamos acceso a la cámara para tomar la foto del jig.'
        );
        return;
      }

      // Tomar foto (config original)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setFormData(prev => ({
          ...prev,
          foto: base64Image
        }));
      }
    } catch (error) {
      logger.error('Error tomando foto:', error);
      Alert.alert('Error', 'No se pudo tomar la foto. Intenta nuevamente.');
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({
      ...prev,
      foto: null
    }));
  };

  const validateForm = () => {
    if (!formData.modelo.trim()) {
      Alert.alert('Error', 'Por favor ingresa el modelo del jig');
      return false;
    }
    if (!formData.tipo_jig) {
      Alert.alert('Error', 'Por favor selecciona el tipo de jig');
      return false;
    }
    if (!formData.foto) {
      Alert.alert('Error', 'Por favor toma una foto del jig');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Respetar límites de la base de datos:
    // modelo: String(100), numero_jig: String(20)
    const safeModelo = formData.modelo.trim().slice(0, 100);
    const safeNumeroJig = formData.numero_jig.trim().slice(0, 20);

    setLoading(true);
    try {
      logger.info('📤 Enviando reporte de etiqueta NG:', {
        modelo: safeModelo,
        tipo_jig: formData.tipo_jig,
        numero_jig: safeNumeroJig || null,
        fotoSize: formData.foto ? formData.foto.length : 0,
      });

      const result = await damagedLabelService.createDamagedLabel({
        modelo: safeModelo,
        tipo_jig: formData.tipo_jig,
        numero_jig: safeNumeroJig || null,
        foto: formData.foto,
      });

      if (result.success) {
        Alert.alert(
          'Éxito',
          'El reporte de etiqueta NG ha sido enviado correctamente.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Limpiar formulario
                setFormData({
                  modelo: '',
                  tipo_jig: '',
                  numero_jig: '',
                  foto: null,
                });
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        const errorMessage = result.error || result.message || 'No se pudo enviar el reporte';
        logger.error('❌ Error del servidor:', errorMessage);
        Alert.alert(
          'Error al enviar reporte',
          errorMessage,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('❌ Error enviando reporte:', error);
      logger.error('❌ Error completo:', JSON.stringify(error, null, 2));
      const errorMessage = error.message || 'Ocurrió un error al enviar el reporte. Verifica tu conexión e intenta nuevamente.';
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
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
      outline: '#3C3C3C',
    },
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A1A1A', '#2C2C2C', '#1A1A1A']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={styles.title}>Reportar Etiqueta NG</Title>
            <Paragraph style={styles.subtitle}>
              Reporta jigs con etiquetas dañadas para reparación
            </Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.formCard}>
          <Card.Content>
            {/* Modelo */}
            <TextInput
              label="Modelo del Jig *"
              value={formData.modelo}
              onChangeText={handleModeloChange}
              mode="outlined"
              style={styles.input}
              textColor="#FFFFFF"
              placeholderTextColor="#B0B0B0"
              outlineColor="#3C3C3C"
              activeOutlineColor="#4CAF50"
              keyboardType="default"
              labelStyle={styles.inputLabel}
              theme={darkTheme}
            />

            {/* Sugerencias de jigs */}
            {loadingJigs && (
              <View style={styles.suggestionsLoading}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.suggestionsLoadingText}>Cargando jigs...</Text>
              </View>
            )}

            {!loadingJigs && jigSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {jigSuggestions.map((jig, index) => (
                  <TouchableOpacity
                    key={jig.id}
                    style={[
                      styles.suggestionItem,
                      index === jigSuggestions.length - 1 && styles.suggestionItemLast
                    ]}
                    onPress={() => handleSelectJigSuggestion(jig)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.suggestionText}>
                      {jig.modelo_actual || 'Sin modelo'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Tipo de Jig */}
            <View style={styles.radioGroup}>
              <Paragraph style={styles.label}>Tipo de Jig *</Paragraph>
              <RadioButton.Group
                onValueChange={(value) => handleInputChange('tipo_jig', value)}
                value={formData.tipo_jig}
              >
                <View style={styles.radioOption}>
                  <RadioButton value="manual" color="#4CAF50" />
                  <Text style={styles.radioLabel}>Manual</Text>
                </View>
                <View style={styles.radioOption}>
                  <RadioButton value="semiautomatico" color="#4CAF50" />
                  <Text style={styles.radioLabel}>Semiautomático</Text>
                </View>
                <View style={styles.radioOption}>
                  <RadioButton value="new_semiautomatico" color="#4CAF50" />
                  <Text style={styles.radioLabel}>New Semiautomático</Text>
                </View>
              </RadioButton.Group>
            </View>

            <Divider style={styles.divider} />

            {/* Número de Jig Original (Opcional) */}
            <TextInput
              label="Número de Jig Original (Opcional)"
              value={formData.numero_jig}
              onChangeText={(text) => handleInputChange('numero_jig', text)}
              mode="outlined"
              style={styles.input}
              textColor="#FFFFFF"
              placeholderTextColor="#B0B0B0"
              outlineColor="#3C3C3C"
              activeOutlineColor="#4CAF50"
              placeholder="Escribe número de jig original"
              labelStyle={styles.inputLabel}
              helperText="Este campo es opcional. Déjalo vacío si no conoces el número."
              helperTextStyle={styles.helperText}
              theme={darkTheme}
            />

            <Divider style={styles.divider} />

            {/* Foto */}
            <Paragraph style={styles.label}>Foto del Jig *</Paragraph>
            {formData.foto ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: formData.foto }} style={styles.photo} />
                <View style={styles.photoActions}>
                  <Button
                    mode="outlined"
                    onPress={handleTakePhoto}
                    style={styles.photoButton}
                    textColor="#4CAF50"
                  >
                    Tomar otra foto
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={handleRemovePhoto}
                    style={styles.photoButton}
                    textColor="#F44336"
                  >
                    Eliminar foto
                  </Button>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoPlaceholder}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <View style={styles.photoPlaceholderContent}>
                  <Title style={styles.photoPlaceholderIcon}>📷</Title>
                  <Paragraph style={styles.photoPlaceholderText}>
                    Toca y toma una foto del número del jig original para facilitar la reparación. ¡Gracias!
                  </Paragraph>
                </View>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
          buttonColor="#4CAF50"
        >
          Enviar Reporte
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#B0B0B0',
    marginTop: 4,
  },
  formCard: {
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3C3C3C',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#2C2C2C',
  },
  inputLabel: {
    color: '#E0E0E0',
  },
  helperText: {
    color: '#B0B0B0',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  radioGroup: {
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#3C3C3C',
  },
  photoContainer: {
    marginTop: 8,
  },
  photo: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#2C2C2C',
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  photoButton: {
    flex: 1,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#2C2C2C',
    borderWidth: 2,
    borderColor: '#3C3C3C',
    borderStyle: 'dashed',
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderContent: {
    alignItems: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  photoPlaceholderText: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  submitButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  suggestionsContainer: {
    marginTop: -8,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#2C2C2C',
    borderWidth: 1,
    borderColor: '#3C3C3C',
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3C',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  suggestionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: -8,
    marginBottom: 16,
  },
  suggestionsLoadingText: {
    color: '#B0B0B0',
    marginLeft: 8,
    fontSize: 14,
  },
});

