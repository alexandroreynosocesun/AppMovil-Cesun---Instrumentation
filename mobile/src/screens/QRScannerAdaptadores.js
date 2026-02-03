import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { adaptadorService } from '../services/AdaptadorService';
import { formatDateTime12Hour } from '../utils/dateUtils';
import logger from '../utils/logger';

const { width, height } = Dimensions.get('window');

export default function QRScannerAdaptadores({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const isProcessingRef = useRef(false);

  const hasPermission = permission?.granted;

  // Resetear el estado cuando la pantalla recibe foco
  useFocusEffect(
    React.useCallback(() => {
      isProcessingRef.current = false;
      setScanned(false);
      setLoading(false);
    }, [])
  );

  const getAdaptadorInfoMessage = (adaptador) => {
    let message = '';

    // Buscar el conector con la validación más reciente
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

      if (mostRecentConector.tecnico_ultima_validacion?.nombre) {
        message += `👤 ${mostRecentConector.tecnico_ultima_validacion.nombre}`;
        if (mostRecentConector.turno_ultima_validacion) {
          message += ` - T${mostRecentConector.turno_ultima_validacion}`;
        }
      }
    } else {
      message = `⚠️ No hay validaciones previas para este adaptador`;
    }

    return message;
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setScanned(true);
    setLoading(true);

    try {
      // Verificar si ya existe antes de permitir agregar
      const result = await adaptadorService.getAdaptadorByQR(data);

      if (result.success) {
        const infoMessage = getAdaptadorInfoMessage(result.data);
        Alert.alert(
          '📋 Información del Adaptador',
          infoMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                isProcessingRef.current = false;
                setScanned(false);
                setLoading(false);
              }
            }
          ]
        );
      } else if (result.error === 'NOT_FOUND') {
        // Escaneo directo: usar QR para agregar adaptador
        navigation.navigate('AddAdaptador', { codigo_qr: data });
      } else if (result.error === 'UNAUTHORIZED') {
        Alert.alert('Sesión expirada', 'Vuelve a iniciar sesión e intenta de nuevo.');
      } else if (result.error === 'NETWORK_ERROR') {
        Alert.alert('Sin conexión', 'No hay conexión. Intenta de nuevo.');
      } else {
        Alert.alert('Error', result.message || 'No se pudo validar el QR.');
      }
    } catch (error) {
      logger.error('Error scanning QR:', error);
      Alert.alert('Error', 'Error al procesar QR');
    } finally {
      if (!result?.success) {
        isProcessingRef.current = false;
        setScanned(false);
        setLoading(false);
      }
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Permisos de Cámara</Title>
            <Paragraph>Necesitamos permisos para usar la cámara</Paragraph>
            <Button onPress={requestPermission} style={styles.button}>
              Conceder Permisos
            </Button>
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
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        )}
      </View>

      {/* Sin modal: el QR se usa para agregar adaptador */}
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
    borderColor: '#4CAF50',
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
});
