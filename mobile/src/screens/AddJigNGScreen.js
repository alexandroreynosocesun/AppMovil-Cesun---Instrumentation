import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Card,
  Title,
  TextInput,
  Button,
  RadioButton,
  ActivityIndicator,
  Chip,
  Divider,
  IconButton,
} from 'react-native-paper';
import { jigNGService } from '../services/JigNGService';
import { jigService } from '../services/JigService';
import { authService } from '../services/AuthService';
import logger from '../utils/logger';

const { width } = Dimensions.get('window');

export default function AddJigNGScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [searchingJig, setSearchingJig] = useState(false);
  const [jigInfo, setJigInfo] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [formData, setFormData] = useState({
    jig_id: 0,
    qrCode: '',
    motivo: '',
    categoria: 'Falla técnica',
    prioridad: 'media',
    estado: 'pendiente',
    usuario_reporte: '',
    foto: null,
  });

  // Fallas comunes sugeridas
  const commonFaults = [
    'Conector optico ng',
    'Conector speaker ng',
    'No 5v',
    'No 12',
    'Se reincia',
    'Botonera NG'
  ];

  const prioridadOptions = [
    { value: 'baja', label: 'Baja', color: '#4CAF50' },
    { value: 'media', label: 'Media', color: '#FF9800' },
    { value: 'alta', label: 'Alta', color: '#F44336' },
    { value: 'critica', label: 'Crítica', color: '#9C27B0' },
  ];

  // Cargar perfil del usuario al montar el componente
  useEffect(() => {
    loadUserProfile();
    
    // Si se pasó información del jig desde la navegación, cargarla directamente
    if (route?.params?.jigData) {
      setJigInfo(route.params.jigData);
      setFormData(prev => ({ 
        ...prev, 
        jig_id: route.params.jigData.id,
        qrCode: route.params.jigData.codigo_qr 
      }));
      logger.info('✅ Información del jig cargada desde navegación:', route.params.jigData);
    }
    // Si se pasó un código QR desde la navegación, buscarlo automáticamente
    else if (route?.params?.qrCode) {
      setFormData(prev => ({ ...prev, qrCode: route.params.qrCode }));
      searchJigByQR(route.params.qrCode);
    }
  }, []);

  // Función para cargar perfil del usuario
  const loadUserProfile = async () => {
    try {
      const result = await authService.getProfile();
      if (result.success) {
        setUserProfile(result.data);
        setFormData(prev => ({ ...prev, usuario_reporte: result.data.nombre }));
        logger.info('✅ Perfil cargado:', result.data.nombre);
      }
    } catch (error) {
      logger.error('❌ Error cargando perfil:', error);
    }
  };

  // Función para buscar jig por código QR
  const searchJigByQR = async (qrCode) => {
    if (!qrCode.trim()) {
      setJigInfo(null);
      setFormData(prev => ({ ...prev, jig_id: 0 }));
      return;
    }

    setSearchingJig(true);
    try {
      const result = await jigService.getJigByQR(qrCode);
      if (result.success) {
        setJigInfo(result.data);
        setFormData(prev => ({ ...prev, jig_id: result.data.id }));
        logger.info('✅ Jig encontrado:', result.data);
      } else {
        setJigInfo(null);
        setFormData(prev => ({ ...prev, jig_id: 0 }));
        logger.info('❌ Jig no encontrado');
      }
    } catch (error) {
      logger.error('❌ Error buscando jig:', error);
      setJigInfo(null);
      setFormData(prev => ({ ...prev, jig_id: 0 }));
    } finally {
      setSearchingJig(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Función para agregar falla común al texto
  const addCommonFault = (fault) => {
    const currentMotivo = formData.motivo;
    const newMotivo = currentMotivo ? `${currentMotivo}, ${fault}` : fault;
    handleInputChange('motivo', newMotivo);
  };

  // Función para tomar foto
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

  // Función para eliminar foto
  const handleRemovePhoto = () => {
    setFormData(prev => ({
      ...prev,
      foto: null
    }));
  };

  const validateForm = () => {
    if (!formData.jig_id || formData.jig_id <= 0) {
      Alert.alert('Error', 'Debe escanear o ingresar un código QR válido');
      return false;
    }
    if (!formData.usuario_reporte.trim()) {
      Alert.alert('Error', 'No se pudo obtener la información del usuario. Intenta cerrar sesión y volver a iniciar.');
      return false;
    }
    if (!formData.motivo.trim()) {
      Alert.alert('Error', 'La descripción del problema es requerida');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await jigNGService.createJigNG(formData);
      
      if (result.success) {
        Alert.alert(
          '✅ Éxito',
          'Jig NG reportado correctamente',
          [
            {
              text: 'Continuar',
              onPress: () => {
                // Regresar al Home
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Error al crear jig NG');
      }
    } catch (error) {
      logger.error('❌ Error al crear jig NG:', error);
      Alert.alert('Error', 'Error inesperado al crear jig NG');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Reportar Jig NG</Title>
            
            {/* Información del Jig */}
            <Card style={styles.jigInfoCard}>
              <Card.Content>
                <Title style={styles.jigInfoTitle}>📋 Información del Jig</Title>
                {jigInfo ? (
                  <View style={styles.jigInfoGrid}>
                    <View style={styles.jigInfoRow}>
                      <Text style={styles.jigInfoLabel}>Número:</Text>
                      <Text style={styles.jigInfoValue}>{jigInfo.numero_jig}</Text>
                    </View>
                    <View style={styles.jigInfoRow}>
                      <Text style={styles.jigInfoLabel}>Código QR:</Text>
                      <Text style={styles.jigInfoValue}>{jigInfo.codigo_qr}</Text>
                    </View>
                    <View style={styles.jigInfoRow}>
                      <Text style={styles.jigInfoLabel}>Tipo:</Text>
                      <Text style={styles.jigInfoValue}>{jigInfo.tipo}</Text>
                    </View>
                    <View style={styles.jigInfoRow}>
                      <Text style={styles.jigInfoLabel}>Modelo:</Text>
                      <Text style={styles.jigInfoValue}>{jigInfo.modelo_actual || 'N/A'}</Text>
                    </View>
                    <View style={styles.jigInfoRow}>
                      <Text style={styles.jigInfoLabel}>Estado:</Text>
                      <Text style={[styles.jigInfoValue, { color: jigInfo.estado === 'activo' ? '#4CAF50' : '#F44336' }]}>
                        {jigInfo.estado}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noJigInfo}>
                    <Text style={styles.noJigText}>No hay información del jig disponible</Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Información del Usuario y Fecha */}
            <Card style={styles.userInfoCard}>
              <Card.Content>
                <Title style={styles.userInfoTitle}>👤 Información del Reporte</Title>
                <View style={styles.userInfoGrid}>
                  <View style={styles.userInfoRow}>
                    <Text style={styles.userInfoLabel}>Usuario que Reporta:</Text>
                    <Text style={styles.userInfoValue}>{formData.usuario_reporte || 'Cargando...'}</Text>
                  </View>
                  <View style={styles.userInfoRow}>
                    <Text style={styles.userInfoLabel}>Fecha y Hora:</Text>
                    <Text style={styles.userInfoValue}>{new Date().toLocaleString('es-ES')}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Prioridad */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prioridad *</Text>
              <View style={styles.prioridadContainer}>
                {prioridadOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.prioridadChip,
                      { 
                        backgroundColor: formData.prioridad === option.value 
                          ? option.color 
                          : '#2C2C2C',
                        borderColor: option.color
                      }
                    ]}
                    onPress={() => handleInputChange('prioridad', option.value)}
                  >
                    <Text style={[
                      styles.prioridadChipText,
                      { color: formData.prioridad === option.value ? '#FFFFFF' : option.color }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Descripción del Problema */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción del Problema *</Text>
              <TextInput
                value={formData.motivo}
                onChangeText={(value) => handleInputChange('motivo', value)}
                style={[styles.input, styles.textInputWhite]}
                mode="outlined"
                multiline
                numberOfLines={4}
                placeholder="Describe detalladamente el problema encontrado..."
                placeholderTextColor="#B0B0B0"
                textColor="#FFFFFF"
                theme={{
                  colors: {
                    primary: '#2196F3',
                    background: '#1E1E1E',
                    surface: '#2C2C2C',
                    text: '#FFFFFF',
                    placeholder: '#B0B0B0',
                    onSurface: '#FFFFFF',
                  }
                }}
              />
              
              {/* Fallas Comunes */}
              <Text style={styles.suggestionsTitle}>Fallas Comunes (Toca para agregar):</Text>
              <View style={styles.faultsContainer}>
                {commonFaults.map((fault, index) => (
                  <Chip
                    key={index}
                    style={styles.faultChip}
                    textStyle={styles.faultChipText}
                    onPress={() => addCommonFault(fault)}
                  >
                    {fault}
                  </Chip>
                ))}
              </View>
            </View>

            {/* Foto del Jig NG */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Foto del Jig NG (Opcional)</Text>
              {formData.foto ? (
                <View style={styles.photoContainer}>
                  <Image source={{ uri: formData.foto }} style={styles.photoPreview} />
                  <View style={styles.photoActions}>
                    <Button
                      mode="outlined"
                      onPress={handleTakePhoto}
                      style={styles.photoButton}
                      icon="camera"
                    >
                      Tomar otra foto
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={handleRemovePhoto}
                      style={[styles.photoButton, styles.removeButton]}
                      icon="delete"
                      textColor="#F44336"
                    >
                      Eliminar foto
                    </Button>
                  </View>
                </View>
              ) : (
                <Button
                  mode="outlined"
                  onPress={handleTakePhoto}
                  style={styles.photoButton}
                  icon="camera"
                >
                  Tomar foto
                </Button>
              )}
            </View>

            {/* Botones */}
            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
                disabled={loading}
              >
                Cancelar
              </Button>
              
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.submitButton}
                labelStyle={styles.submitButtonLabel}
                disabled={loading || !jigInfo || !userProfile}
              >
                {loading ? 'Creando...' : 'Reportar NG'}
              </Button>
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2196F3" />
                <Text style={styles.loadingText}>Creando reporte NG...</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#1E1E1E',
    elevation: 4,
    borderRadius: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#2C2C2C',
  },
  textInputWhite: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  jigInfoCard: {
    backgroundColor: '#2C2C2C',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    elevation: 2,
  },
  jigInfoTitle: {
    color: '#2196F3',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  jigInfoGrid: {
    gap: 8,
  },
  jigInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3C',
  },
  jigInfoLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  jigInfoValue: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  noJigInfo: {
    padding: 20,
    alignItems: 'center',
  },
  noJigText: {
    color: '#B0B0B0',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  userInfoCard: {
    backgroundColor: '#2C2C2C',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    elevation: 2,
  },
  userInfoTitle: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  userInfoGrid: {
    gap: 8,
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3C',
  },
  userInfoLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  userInfoValue: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  prioridadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prioridadChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  prioridadChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionsTitle: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 8,
  },
  faultsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  faultChip: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2196F3',
    borderWidth: 1,
    marginBottom: 8,
  },
  faultChipText: {
    color: '#2196F3',
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#666666',
  },
  cancelButtonLabel: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#2196F3',
  },
  submitButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loadingText: {
    color: '#B0B0B0',
    marginLeft: 8,
    fontSize: 14,
  },
  photoContainer: {
    marginTop: 12,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#2C2C2C',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flex: 1,
    borderColor: '#2196F3',
  },
  removeButton: {
    borderColor: '#F44336',
  },
});
