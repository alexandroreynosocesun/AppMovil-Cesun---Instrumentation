import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert, Dimensions, TouchableOpacity, Platform } from 'react-native'
import { showAlert } from '../utils/alertUtils';;
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, Title, Paragraph, ActivityIndicator, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { adaptadorService } from '../services/AdaptadorService';
import { formatDateTime12Hour } from '../utils/dateUtils';
import logger from '../utils/logger';

const { width } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';
const IS_MOBILE_WEB = IS_WEB && typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
const IS_DESKTOP_WEB = IS_WEB && !IS_MOBILE_WEB;

export default function QRScannerVByOne({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const isProcessingRef = useRef(false);

  const hasPermission = permission?.granted;

  const getVByOneInfoMessage = (adaptador) => {
    let message = '';
    let mostRecentDate = null;
    let mostRecentConector = null;

    if (adaptador.conectores && adaptador.conectores.length > 0) {
      adaptador.conectores.forEach(conector => {
        if (conector.fecha_ultima_validacion) {
          const currentDate = new Date(conector.fecha_ultima_validacion);
          if (!mostRecentDate || currentDate > mostRecentDate) {
            mostRecentDate = currentDate;
            mostRecentConector = conector;
          }
        }
      });
    }

    if (mostRecentConector) {
      const formattedDate = formatDateTime12Hour(mostRecentConector.fecha_ultima_validacion);
      message += `✅ Última validación\n\n`;
      message += `📅 ${formattedDate}\n\n`;

      if (mostRecentConector.linea_ultima_validacion) {
        message += `🏭 Línea: ${mostRecentConector.linea_ultima_validacion}\n\n`;
      }

      if (mostRecentConector.tecnico_ultima_validacion?.nombre) {
        message += `👤 ${mostRecentConector.tecnico_ultima_validacion.nombre}`;
        if (mostRecentConector.turno_ultima_validacion) {
          message += ` - T${mostRecentConector.turno_ultima_validacion}`;
        }
      }
    } else {
      message = `⚠️ No hay validaciones previas para este convertidor`;
    }
    return message;
  };

  useFocusEffect(
    React.useCallback(() => {
      isProcessingRef.current = false;
      setScanned(false);
      setLoading(false);
    }, [])
  );

  const processCode = async (data) => {
    if (loading || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setScanned(true);
    setLoading(true);

    try {
      const result = await adaptadorService.getAdaptadorByQR(data);

      if (result.success) {
        const infoMessage = getVByOneInfoMessage(result.data);
        showAlert(
          'Información del Tool',
          infoMessage,
          [{ text: 'OK', onPress: () => {} }]
        );
      } else if (result.error === 'NOT_FOUND') {
        navigation.navigate('AddVByOne', { codigo_qr: data });
      } else if (result.error === 'UNAUTHORIZED') {
        showAlert('Sesión expirada', 'Vuelve a iniciar sesión e intenta de nuevo.');
      } else if (result.error === 'NETWORK_ERROR') {
        showAlert('Sin conexión', 'No hay conexión. Intenta de nuevo.');
      } else {
        showAlert('Error', result.message || 'No se pudo validar el QR.');
      }
    } catch (error) {
      logger.error('Error scanning QR:', error);
      showAlert('Error', 'Error al procesar QR');
    } finally {
      isProcessingRef.current = false;
      setScanned(false);
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading || isProcessingRef.current) return;
    processCode(data);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) {
      showAlert('Error', 'Ingresa un código.');
      return;
    }
    setShowManualInput(false);
    setManualCode('');
    processCode(code);
  };

  if (!hasPermission || IS_DESKTOP_WEB) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>{IS_DESKTOP_WEB ? 'Ingresar código QR' : 'Permisos de Cámara'}</Title>
            <Paragraph>{IS_DESKTOP_WEB ? 'Escribe o pega el código del adaptador VByOne' : 'Necesitamos permisos para usar la cámara'}</Paragraph>
            <TextInput
              label="Código QR"
              value={manualCode}
              onChangeText={setManualCode}
              onSubmitEditing={handleManualSubmit}
              autoFocus={IS_DESKTOP_WEB}
              style={{ marginTop: 12, marginBottom: 8 }}
            />
            <Button mode="contained" onPress={handleManualSubmit} disabled={!manualCode.trim() || loading} style={styles.button}>
              Buscar
            </Button>
            {!IS_DESKTOP_WEB && (
              <Button onPress={requestPermission} style={styles.button}>
                Conceder Permisos
              </Button>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FF9800" />
          </View>
        )}
      </View>

      {/* Botón de agregar manualmente */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.manualButton} onPress={() => navigation.navigate('AddVByOne', {})}>
          <Paragraph style={styles.manualButtonText}>Agregar manualmente</Paragraph>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  card: { margin: 20, backgroundColor: '#2A2A2A' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  scanArea: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    marginTop: 20,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 50,
  },
  manualButton: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  manualButtonText: {
    color: '#FF9800',
    fontWeight: '600',
    fontSize: 15,
  },
  manualInputContainer: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  manualInput: {
    backgroundColor: '#1E1E1E',
    marginBottom: 12,
  },
  manualButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  manualBtn: {
    borderRadius: 8,
  },
});
