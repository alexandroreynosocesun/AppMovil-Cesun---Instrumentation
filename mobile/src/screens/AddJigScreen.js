import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import {
  Button,
  Card,
  Title,
  TextInput,
  RadioButton,
  Paragraph,
  ActivityIndicator
} from 'react-native-paper';
import { jigService } from '../services/JigService';
import { parseQRCode, isValidQRFormat, getJigTypeSuggestion } from '../utils/qrParser';

export default function AddJigScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    codigo_qr: route?.params?.codigo_qr || '',
    numero_jig: '',
    tipo: 'manual',
    modelo_actual: '',
    estado: 'activo'
  });
  const [qrValidation, setQrValidation] = useState({ isValid: true, error: '' });

  // Auto-llenar campos cuando cambie el código QR
  useEffect(() => {
    if (formData.codigo_qr) {
      const parsed = parseQRCode(formData.codigo_qr);
      
      if (parsed.isValid) {
        setFormData(prev => ({
          ...prev,
          numero_jig: parsed.numeroJig,
          modelo_actual: parsed.modeloActual,
          tipo: getJigTypeSuggestion(formData.codigo_qr)
        }));
        setQrValidation({ isValid: true, error: '' });
      } else {
        setQrValidation({ isValid: false, error: parsed.error });
      }
    }
  }, [formData.codigo_qr]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    // Validar formato de QR
    if (!qrValidation.isValid) {
      Alert.alert('Error', 'El código QR tiene un formato inválido. Verifica que siga el patrón: M-51876-B-9');
      return;
    }

    // Validar campos requeridos
    if (!formData.codigo_qr || !formData.numero_jig) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const result = await jigService.createJig(formData);
      
      if (result.success) {
        Alert.alert(
          'Éxito',
          'Jig creado correctamente',
          [
            {
              text: 'OK',
              onPress: () => {
                // Llamar al callback si existe
                if (route?.params?.onJigCreated) {
                  route.params.onJigCreated();
                }
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Error al crear el jig');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Agregar Nuevo Jig</Title>
          
          <TextInput
            label="Código QR *"
            value={formData.codigo_qr}
            onChangeText={(text) => handleInputChange('codigo_qr', text)}
            style={styles.input}
            mode="outlined"
            error={!qrValidation.isValid}
            helperText={qrValidation.error || "Formato: M-51876-B-9"}
          />
          
          <TextInput
            label="Número de Jig *"
            value={formData.numero_jig}
            onChangeText={(text) => handleInputChange('numero_jig', text)}
            style={styles.input}
            mode="outlined"
            right={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              <TextInput.Icon icon="auto-fix" /> : null}
            helperText={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              "Auto-llenado desde QR" : "Ingresa manualmente o escanea QR"}
          />
          
          <TextInput
            label="Modelo Actual"
            value={formData.modelo_actual}
            onChangeText={(text) => handleInputChange('modelo_actual', text)}
            style={styles.input}
            mode="outlined"
            right={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              <TextInput.Icon icon="auto-fix" /> : null}
            helperText={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              "Auto-llenado desde QR" : "Ingresa manualmente o escanea QR"}
          />
          
          <Paragraph style={styles.sectionTitle}>
            Tipo de Jig:
            {formData.codigo_qr && isValidQRFormat(formData.codigo_qr) && (
              <Paragraph style={styles.autoSuggestion}>
                {' '}(Sugerido automáticamente)
              </Paragraph>
            )}
          </Paragraph>
          <View style={styles.radioGroup}>
            <View style={styles.radioItem}>
              <RadioButton
                value="manual"
                status={formData.tipo === 'manual' ? 'checked' : 'unchecked'}
                onPress={() => handleInputChange('tipo', 'manual')}
              />
              <Paragraph>Manual</Paragraph>
            </View>
            <View style={styles.radioItem}>
              <RadioButton
                value="semiautomatico"
                status={formData.tipo === 'semiautomatico' ? 'checked' : 'unchecked'}
                onPress={() => handleInputChange('tipo', 'semiautomatico')}
              />
              <Paragraph>Semiautomático</Paragraph>
            </View>
          </View>
          
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.button}
            disabled={loading}
          >
            {loading ? <ActivityIndicator size="small" /> : 'Crear Jig'}
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Cancelar
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC'
  },
  card: {
    marginBottom: 20,
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
    elevation: 6,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 12,
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  radioGroup: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  button: {
    marginBottom: 12,
    borderRadius: 12,
  },
  autoSuggestion: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#10B981',
    fontWeight: '500',
    marginTop: 4,
  }
});
