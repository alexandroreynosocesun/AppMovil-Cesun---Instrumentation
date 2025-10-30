import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  Alert,
  Dimensions,
  Modal,
  TouchableOpacity,
  Text
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Button,
  Card,
  Title,
  Paragraph,
  ActivityIndicator
} from 'react-native-paper';
import { jigService } from '../services/JigService';
import { jigNGService } from '../services/JigNGService';
import { offlineService } from '../services/OfflineService';

const { width, height } = Dimensions.get('window');

export default function QRScannerScreen({ navigation, route }) {
  const { mode } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastScannedQR, setLastScannedQR] = useState(null);
  const [scanTimeout, setScanTimeout] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [pendingQRCode, setPendingQRCode] = useState(null);

  const hasPermission = permission?.granted;

  // Resetear estado cuando se regrese a la pantalla
  useFocusEffect(
    React.useCallback(() => {
      // Limpiar timeout si existe
      if (scanTimeout) {
        clearTimeout(scanTimeout);
        setScanTimeout(null);
      }
      
      setScanned(false);
      setLoading(false);
      setLastScannedQR(null);
      setCameraActive(true);
      // Forzar re-render del scanner
      setTimeout(() => {
        setScanned(false);
      }, 100);
    }, [scanTimeout])
  );

  const handleBarCodeScanned = async ({ data }) => {
    // Prevenir múltiples escaneos del mismo QR
    if (scanned || loading || !cameraActive) return;
    
    // Evitar escanear el mismo QR consecutivamente
    if (lastScannedQR === data) return;
    
    // Desactivar la cámara inmediatamente
    setCameraActive(false);
    setScanned(true);
    setLoading(true);
    setLastScannedQR(data);
    
    // Limpiar timeout anterior si existe
    if (scanTimeout) {
      clearTimeout(scanTimeout);
    }
    
    // Procesar inmediatamente sin debounce
    processQRCode(data);
  };

  const processQRCode = async (data) => {
    try {
      console.log('🔍 Procesando QR:', data);
      // Buscar jig por código QR
      const result = await jigService.getJigByQR(data);
      console.log('🔍 Resultado del servicio:', result);
      
      if (result.success) {
        // Si está en modo NG, verificar si ya tiene un NG activo
        if (mode === 'ng') {
          const ngStatus = await jigNGService.checkJigNGStatus(result.data.jig.id);
          
          if (ngStatus.success && ngStatus.hasActiveNG) {
            // El jig ya tiene un NG activo, mostrar mensaje y ir a detalles
            Alert.alert(
              '⚠️ Jig ya dado de baja',
              `Este jig ya tiene un reporte NG activo (${ngStatus.jigNG.estado}). ¿Deseas ver los detalles?`,
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => {
                    setScanned(false);
                    setLoading(false);
                    setCameraActive(true);
                  }
                },
                {
                  text: 'Ver Detalles',
                  onPress: () => {
                    navigation.navigate('JigNGDetail', { 
                      jigId: ngStatus.jigNG.id 
                    });
                  }
                }
              ]
            );
          } else {
            // No tiene NG activo, proceder a crear uno nuevo
            navigation.navigate('AddJigNG', { 
              jigId: result.data.jig.id,
              jigData: result.data.jig
            });
          }
        } else {
          // Navegar a pantalla de validación con los datos del jig
          navigation.navigate('Validation', { 
            jig: result.data.jig,
            validaciones: result.data.validaciones,
            reparaciones: result.data.reparaciones
          });
        }
      } else {
        // Manejar diferentes tipos de errores con mensajes amigables
        if (result.error === 'NOT_FOUND') {
          // Resetear estado inmediatamente
          setScanned(false);
          setLoading(false);
          setCameraActive(true);
          setLastScannedQR(null);
          
          // Mostrar modal personalizado
          setPendingQRCode(data);
          setShowNotFoundModal(true);
        } else if (result.error === 'UNAUTHORIZED') {
          Alert.alert(
            '🔐 Sesión Expirada',
            result.message,
            [
              { 
                text: 'Iniciar Sesión', 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                  navigation.navigate('Login');
                }
              }
            ]
          );
        } else if (result.error === 'NETWORK_ERROR') {
          Alert.alert(
            '📡 Sin Conexión',
            result.message,
            [
              { 
                text: 'Reintentar', 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                }
              },
              { 
                text: 'Cancelar', 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                }
              }
            ]
          );
        } else {
          Alert.alert(
            '❌ Error',
            result.message || 'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
            [
              { 
                text: 'Reintentar', 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                }
              },
              { 
                text: 'Cancelar', 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Error al procesar el código QR');
      setScanned(false);
      setCameraActive(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewJig = (qrCode) => {
    // Cerrar modal
    setShowNotFoundModal(false);
    setPendingQRCode(null);
    
    // Navegar a la pantalla para agregar nuevo jig
    navigation.navigate('AddJig', { 
      codigo_qr: qrCode,
      onJigCreated: () => {
        // Después de crear el jig, volver al scanner
        setScanned(false);
        setLoading(false);
        setCameraActive(true);
        setLastScannedQR(null);
        // Opcional: mostrar mensaje de éxito
        Alert.alert('Éxito', 'Jig creado correctamente. Puedes escanearlo nuevamente.');
      }
    });
  };

  const resetScanner = () => {
    // Limpiar timeout si existe
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      setScanTimeout(null);
    }
    
    setScanned(false);
    setLoading(false);
    setLastScannedQR(null);
    setCameraActive(true);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <ActivityIndicator size="large" />
            <Paragraph style={styles.text}>Solicitando permisos de cámara...</Paragraph>
          </Card.Content>
        </Card>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Permisos de Cámara</Title>
            <Paragraph>
              Necesitamos acceso a la cámara para escanear códigos QR.
            </Paragraph>
            <Button mode="contained" onPress={requestPermission} style={styles.button}>
              Permitir Acceso
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={cameraActive && !scanned && !loading ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417'],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Overlay con instrucciones */}
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.scanFrame} />
        </View>
        
        <Card style={styles.instructionCard}>
          <Card.Content>
            <Title style={styles.instructionTitle}>
              {mode === 'ng' ? 'Escanear Jig NG' : 'Escanear Código QR'}
            </Title>
            <Paragraph style={styles.instructionText}>
              {mode === 'ng' 
                ? 'Apunta la cámara al código QR del jig que quieres dar de baja como NG'
                : 'Apunta la cámara al código QR del jig'
              }
            </Paragraph>
            {mode !== 'ng' && (
              <Button
                mode="outlined"
                onPress={() => navigation.navigate('AddJig')}
                style={styles.addButton}
                icon="plus-circle"
              >
                Agregar Jig Manualmente
              </Button>
            )}
          </Card.Content>
        </Card>
      </View>

      {/* Botones de control */}
      <View style={styles.controls}>
        {loading && (
          <Card style={styles.loadingCard}>
            <Card.Content>
              <ActivityIndicator size="small" />
              <Paragraph>Procesando...</Paragraph>
            </Card.Content>
          </Card>
        )}
        
        {scanned && (
          <Button
            mode="contained"
            onPress={resetScanner}
            style={styles.button}
          >
            Escanear de Nuevo
          </Button>
        )}
        
        {!cameraActive && (
          <Card style={styles.disabledCard}>
            <Card.Content>
              <Paragraph style={styles.disabledText}>
                Cámara pausada - Procesando QR...
              </Paragraph>
            </Card.Content>
          </Card>
        )}
      </View>

      {/* Modal personalizado para Jig No Encontrado */}
      <Modal
        visible={showNotFoundModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotFoundModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔍 Jig No Encontrado</Text>
            <Text style={styles.modalMessage}>
              El código QR escaneado no está registrado en el sistema.
              {'\n\n'}¿Deseas agregar este jig nuevo?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNotFoundModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={() => handleAddNewJig(pendingQRCode)}
              >
                <Text style={styles.addButtonText}>Agregar Jig</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  instructionCard: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderWidth: 2,
    borderColor: '#2D2D2D',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  instructionTitle: {
    textAlign: 'center',
    color: '#E8E8E8',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  instructionText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#B0B0B0',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  loadingCard: {
    backgroundColor: 'rgba(31, 31, 31, 0.95)',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  button: {
    marginVertical: 8,
  },
  addButton: {
    marginTop: 10,
  },
  disabledCard: {
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    marginBottom: 16,
  },
  disabledText: {
    textAlign: 'center',
    color: '#E8E8E8',
    fontWeight: 'bold',
  },
  card: {
    margin: 20,
    elevation: 4,
  },
  text: {
    textAlign: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8E8E8',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#555555',
  },
  addButton: {
    backgroundColor: '#2196F3',
  },
  cancelButtonText: {
    color: '#E8E8E8',
    fontWeight: '600',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
