import React, { useState } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

export default function DamagedLabelScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    modelo: '',
    tipo_jig: '',
    numero_jig: '',
    foto: null,
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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

      // Tomar foto
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

    setLoading(true);
    try {
      const result = await damagedLabelService.createDamagedLabel({
        modelo: formData.modelo.trim(),
        tipo_jig: formData.tipo_jig,
        numero_jig: formData.numero_jig.trim() || null,
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
        Alert.alert('Error', result.error || 'No se pudo enviar el reporte');
      }
    } catch (error) {
      logger.error('Error enviando reporte:', error);
      Alert.alert('Error', 'Ocurrió un error al enviar el reporte');
    } finally {
      setLoading(false);
    }
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
              onChangeText={(text) => handleInputChange('modelo', text)}
              mode="outlined"
              style={styles.input}
              textColor="#FFFFFF"
              outlineColor="#3C3C3C"
              activeOutlineColor="#4CAF50"
              keyboardType="numeric"
            />

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
              outlineColor="#3C3C3C"
              activeOutlineColor="#4CAF50"
              placeholder="Escribe número de jig original"
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
                    Toca para tomar una foto del jig
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
});

