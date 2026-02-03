import React, { useState, useEffect, useRef } from 'react';
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
import { showAlert } from '../utils/alertUtils';
import { useLanguage } from '../contexts/LanguageContext';

export default function AddJigScreen({ navigation, route }) {
  const { t } = useLanguage();
  const isManualEntry = route?.params?.manualEntry === true;
  const [loading, setLoading] = useState(false);
  const [manualVersion, setManualVersion] = useState('');
  const [tipoManualOverride, setTipoManualOverride] = useState(false);
  const prevQrRef = useRef(isManualEntry ? '' : route?.params?.codigo_qr || '');
  const [formData, setFormData] = useState({
    codigo_qr: isManualEntry ? '' : route?.params?.codigo_qr || '',
    numero_jig: '',
    tipo: 'manual',
    modelo_actual: '',
    estado: 'activo'
  });
  const [qrValidation, setQrValidation] = useState({ isValid: true, error: '' });

  // Auto-llenar campos cuando cambie el código QR
  useEffect(() => {
    if (prevQrRef.current !== formData.codigo_qr) {
      prevQrRef.current = formData.codigo_qr;
      setTipoManualOverride(false);
    }

    if (isManualEntry) {
      const typePrefix = formData.tipo === 'manual'
        ? 'M'
        : formData.tipo === 'semiautomatic'
          ? 'S'
          : 'NS';
      const modelValue = (formData.modelo_actual || '').replace(/\s+/g, '');
      const versionValue = (manualVersion || '').toUpperCase().trim();
      const numberValue = formData.numero_jig;
      const hasAllFields = modelValue && versionValue && numberValue;
      const manualCode = hasAllFields
        ? `${typePrefix}-${modelValue}-${versionValue}-${numberValue}`
        : '';
      if (formData.codigo_qr !== manualCode) {
        setFormData(prev => ({
          ...prev,
          codigo_qr: manualCode
        }));
      }
      setQrValidation({ isValid: true, error: '' });
      return;
    }

    if (formData.codigo_qr) {
      const parsed = parseQRCode(formData.codigo_qr);
      
      if (parsed.isValid) {
        setFormData(prev => ({
          ...prev,
          numero_jig: parsed.numeroJig,
          modelo_actual: parsed.modeloActual,
          tipo: tipoManualOverride ? prev.tipo : getJigTypeSuggestion(formData.codigo_qr)
        }));
        setQrValidation({ isValid: true, error: '' });
      } else {
        setQrValidation({ isValid: false, error: parsed.error });
      }
    }
  }, [formData.codigo_qr, formData.numero_jig, formData.modelo_actual, formData.tipo, manualVersion, isManualEntry]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    // Validar formato de QR
    if (!isManualEntry && !qrValidation.isValid) {
      Alert.alert(t('error'), t('invalidQRFormat'));
      return;
    }

    // Validar campos requeridos
    if (isManualEntry) {
      if (!formData.numero_jig || !formData.modelo_actual || !manualVersion) {
        Alert.alert(t('error'), t('completeRequiredFields'));
        return;
      }
    } else if (!formData.numero_jig || !formData.codigo_qr) {
      Alert.alert(t('error'), t('completeRequiredFields'));
      return;
    }

    setLoading(true);
    try {
      const result = await jigService.createJig(formData);
      
      if (result.success) {
        showAlert(
          t('success'),
          t('jigCreated'),
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
        Alert.alert(t('error'), result.error || t('errorCreatingJig'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
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
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>{t('addNewJig')}</Title>
          
          <TextInput
            label={`${t('qrCode')} *`}
            value={formData.codigo_qr}
            onChangeText={(text) => handleInputChange('codigo_qr', text)}
            style={styles.input}
            mode="outlined"
            error={!qrValidation.isValid}
            helperText={qrValidation.error || t('qrFormat')}
            textColor="#FFFFFF"
            placeholderTextColor="#B0B0B0"
            labelStyle={styles.inputLabel}
            theme={darkTheme}
            editable={!isManualEntry}
            disabled={isManualEntry}
          />
          
          <TextInput
            label={`${t('jigNumber')} *`}
            value={formData.numero_jig}
            onChangeText={(text) => handleInputChange('numero_jig', text)}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
            right={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              <TextInput.Icon icon="auto-fix" /> : null}
            helperText={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              "Auto-llenado desde QR" : "Ingresa manualmente o escanea QR"}
            textColor="#FFFFFF"
            placeholderTextColor="#B0B0B0"
            labelStyle={styles.inputLabel}
            theme={darkTheme}
          />
          
          <TextInput
            label="Modelo"
            value={formData.modelo_actual}
            onChangeText={(text) => handleInputChange('modelo_actual', text)}
            style={styles.input}
            mode="outlined"
            right={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              <TextInput.Icon icon="auto-fix" /> : null}
            helperText={formData.codigo_qr && isValidQRFormat(formData.codigo_qr) ? 
              t('autoFilledFromQR') : t('enterManuallyOrScan')}
            textColor="#FFFFFF"
            placeholderTextColor="#B0B0B0"
            labelStyle={styles.inputLabel}
            theme={darkTheme}
          />

          {isManualEntry && (
            <TextInput
              label="Tipo (A/B/C)"
              value={manualVersion}
              onChangeText={(text) => setManualVersion(text.toUpperCase())}
              style={styles.input}
              mode="outlined"
              placeholder="A"
              textColor="#FFFFFF"
              placeholderTextColor="#B0B0B0"
              labelStyle={styles.inputLabel}
              theme={darkTheme}
            />
          )}
          
          <Paragraph style={styles.sectionTitle}>
            {t('jigType')}
            {formData.codigo_qr && isValidQRFormat(formData.codigo_qr) && (
              <Paragraph style={styles.autoSuggestion}>
                {' '}{t('autoSuggested')}
              </Paragraph>
            )}
          </Paragraph>
          <View style={styles.radioGroup}>
            <View style={styles.radioItem}>
              <RadioButton
                value="manual"
                status={formData.tipo === 'manual' ? 'checked' : 'unchecked'}
                onPress={() => {
                  setTipoManualOverride(true);
                  handleInputChange('tipo', 'manual');
                }}
                color="#2196F3"
                uncheckedColor="#666666"
              />
              <Paragraph style={styles.radioText}>{t('manual')}</Paragraph>
            </View>
            <View style={styles.radioItem}>
              <RadioButton
                value="semiautomatic"
                status={formData.tipo === 'semiautomatic' ? 'checked' : 'unchecked'}
                onPress={() => {
                  setTipoManualOverride(true);
                  handleInputChange('tipo', 'semiautomatic');
                }}
                color="#2196F3"
                uncheckedColor="#666666"
              />
              <Paragraph style={styles.radioText}>{t('semiautomatic')}</Paragraph>
            </View>
            <View style={styles.radioItem}>
              <RadioButton
                value="new semiautomatic"
                status={formData.tipo === 'new semiautomatic' ? 'checked' : 'unchecked'}
                onPress={() => {
                  setTipoManualOverride(true);
                  handleInputChange('tipo', 'new semiautomatic');
                }}
                color="#2196F3"
                uncheckedColor="#666666"
              />
              <Paragraph style={styles.radioText}>{t('newSemiautomatic')}</Paragraph>
            </View>
          </View>
          
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.button}
            loading={loading}
            disabled={loading}
            buttonColor="#2196F3"
            textColor="#FFFFFF"
          >
            {t('createJig')}
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.button}
            textColor="#B0B0B0"
            borderColor="#404040"
          >
            {t('cancel')}
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
    backgroundColor: '#121212'
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  radioGroup: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  radioText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  button: {
    marginBottom: 12,
    borderRadius: 12,
  },
  autoSuggestion: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 4,
  }
});
