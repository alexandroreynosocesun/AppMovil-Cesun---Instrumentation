import React, { useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  Alert,
  Dimensions,
  Modal,
  TouchableOpacity,
  Text,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Button,
  Card,
  Title,
  Paragraph,
  ActivityIndicator
} from 'react-native-paper';
import { jigService } from '../services/JigService';
import { adminService } from '../services/AdminService';
import { jigNGService } from '../services/JigNGService';
import { offlineService } from '../services/OfflineService';
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../contexts/ValidationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDateTime12Hour } from '../utils/dateUtils';
import logger from '../utils/logger';

const { width, height } = Dimensions.get('window');

export default function QRScannerScreen({ navigation, route }) {
  const { mode } = route.params || {};
  const { logout, user } = useAuth();
  const { validations } = useValidation();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastScannedQR, setLastScannedQR] = useState(null);
  const [scanTimeout, setScanTimeout] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [pendingQRCode, setPendingQRCode] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });
  const [cameraKey, setCameraKey] = useState(0);
  const [tecnicosMap, setTecnicosMap] = useState({});
  const [showingLastValidationAlert, setShowingLastValidationAlert] = useState(false);
  const scanLockRef = useRef(false);
  const alertLockRef = useRef(false);

  const hasPermission = permission?.granted;

  // Forzar re-render de la cámara cuando el contenedor esté listo (especialmente en Android)
  useEffect(() => {
    if (containerLayout.width > 0 && containerLayout.height > 0) {
      // Pequeño delay para asegurar que las dimensiones estén completamente calculadas
      const timer = setTimeout(() => {
        setCameraReady(true);
        // Forzar re-montaje de la cámara en Android
        if (Platform.OS === 'android') {
          setCameraKey(prev => prev + 1);
        }
      }, Platform.OS === 'android' ? 300 : 100);
      
      return () => clearTimeout(timer);
    }
  }, [containerLayout]);

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
      setCameraReady(false);
      setShowingLastValidationAlert(false);
      scanLockRef.current = false;
      alertLockRef.current = false;
      
      // Forzar re-render del scanner y re-montaje de la cámara en Android
      setTimeout(() => {
        setScanned(false);
        if (Platform.OS === 'android') {
          setCameraKey(prev => prev + 1);
        }
        setCameraReady(true);
      }, Platform.OS === 'android' ? 300 : 100);
    }, [scanTimeout])
  );

  const handleBarCodeScanned = async ({ data }) => {
    // Prevenir múltiples escaneos del mismo QR
    if (scanned || loading || !cameraActive) return;
    if (scanLockRef.current) return;
    
    // Evitar escanear el mismo QR consecutivamente
    if (lastScannedQR === data) return;
    
    // Desactivar la cámara inmediatamente
    setCameraActive(false);
    setScanned(true);
    setLoading(true);
    setLastScannedQR(data);
    scanLockRef.current = true;
    
    // Limpiar timeout anterior si existe
    if (scanTimeout) {
      clearTimeout(scanTimeout);
    }
    
    // Procesar inmediatamente sin debounce
    processQRCode(data);
  };

  const processQRCode = async (data) => {
    try {
      logger.info('🔍 Procesando QR:', data);
      // Buscar jig por código QR
      const result = await jigService.getJigByQR(data);
      logger.info('🔍 Resultado del servicio:', result);
      
      if (result.success) {
        // Si está en modo NG, verificar si ya tiene un NG activo
        if (mode === 'ng') {
          const ngStatus = await jigNGService.checkJigNGStatus(result.data.jig.id);
          
          if (ngStatus.success && ngStatus.hasActiveNG) {
            // El jig ya tiene un NG activo, mostrar mensaje y ir a detalles
            Alert.alert(
              `⚠️ ${t('jigAlreadyDeactivated')}`,
              t('jigAlreadyDeactivatedDesc', { status: ngStatus.jigNG.estado }),
              [
                {
                  text: t('cancel'),
                  style: 'cancel',
                  onPress: () => {
                    setScanned(false);
                    setLoading(false);
                    setCameraActive(true);
                  }
                },
                {
                  text: t('viewDetails'),
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
          const jigInfoMessage = getJigInfoMessage(result.data.jig);

          if (showingLastValidationAlert || alertLockRef.current) {
            return;
          }

          setShowingLastValidationAlert(true);
          alertLockRef.current = true;
          Alert.alert(
            '📋 Información del Jig',
            jigInfoMessage,
            [
              {
                text: 'OK',
                style: 'default',
                onPress: () => {
                  setShowingLastValidationAlert(false);
                  alertLockRef.current = false;
                  resetScanner();
                }
              }
            ]
          );
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
            `🔐 ${t('sessionExpired')}`,
            result.message,
            [
              { 
                text: t('signIn'), 
                onPress: async () => {
                  setScanned(false);
                  setCameraActive(true);
                  // Cerrar sesión para mostrar la pantalla de Login
                  await logout();
                }
              }
            ]
          );
        } else if (result.error === 'NETWORK_ERROR') {
          Alert.alert(
            `📡 ${t('noConnection')}`,
            result.message,
            [
              { 
                text: t('retry'), 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                }
              },
              { 
                text: t('cancel'), 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                }
              }
            ]
          );
        } else {
          Alert.alert(
            `❌ ${t('error')}`,
            result.message || t('qrProcessingError'),
            [
              { 
                text: t('retry'), 
                onPress: () => {
                  setScanned(false);
                  setCameraActive(true);
                }
              },
              { 
                text: t('cancel'), 
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
      Alert.alert(t('error'), t('qrProcessingError'));
      setScanned(false);
      setCameraActive(true);
    } finally {
      setLoading(false);
    }
  };

  const loadTecnicosMap = async () => {
    if (tecnicosMap && Object.keys(tecnicosMap).length > 0) {
      return tecnicosMap;
    }

    try {
      const result = await adminService.getTecnicos();
      if (result.success) {
        let tecnicosList = [];
        if (Array.isArray(result.data)) {
          tecnicosList = result.data;
        } else if (Array.isArray(result.data?.items)) {
          tecnicosList = result.data.items;
        }

        const map = {};
        tecnicosList.forEach(tecnico => {
          const suffix = tecnico.numero_empleado ? ` (${tecnico.numero_empleado})` : '';
          map[tecnico.id] = `${tecnico.nombre}${suffix}`;
        });
        setTecnicosMap(map);
        return map;
      }
    } catch (error) {
      logger.error('Error cargando técnicos:', error);
    }

    return {};
  };

  const getTechnicianLabel = async (validation) => {
    const directName = validation?.tecnico?.nombre || validation?.tecnico_nombre;
    if (directName) {
      return directName;
    }

    const tecnicoId = validation?.tecnico_id;
    if (!tecnicoId) {
      // Si no hay técnico en el objeto (validación local), usar el usuario actual
      return user?.nombre || t('notAvailable');
    }

    const map = await loadTecnicosMap();
    return map[tecnicoId] || `ID ${tecnicoId}`;
  };

  const getLocalValidationsForJig = (jig) => {
    if (!jig || !Array.isArray(validations) || validations.length === 0) {
      return [];
    }

    return validations.filter(v => {
      if (v?.jig?.id && jig?.id) {
        return v.jig.id === jig.id;
      }
      if (v?.jig?.codigo_qr && jig?.codigo_qr) {
        return v.jig.codigo_qr === jig.codigo_qr;
      }
      // Fallback por modelo si no hay IDs
      if (v?.modelo_actual && jig?.modelo_actual) {
        return v.modelo_actual === jig.modelo_actual;
      }
      return false;
    });
  };

  const getJigInfoMessage = (jig) => {
    let message = '';

    // Información de última validación
    if (jig.fecha_ultima_validacion) {
      const formattedDate = formatDateTime12Hour(jig.fecha_ultima_validacion);
      message += `✅ Última validación\n\n`;
      message += `📅 ${formattedDate}\n\n`;

      if (jig.tecnico_ultima_validacion?.nombre) {
        message += `👤 ${jig.tecnico_ultima_validacion.nombre}`;
        if (jig.turno_ultima_validacion) {
          message += ` - T${jig.turno_ultima_validacion}`;
        }
      }
    } else {
      message = `⚠️ No hay validaciones previas para este jig`;
    }

    return message;
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
        Alert.alert(t('success'), t('jigCreatedSuccess'));
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
    setShowingLastValidationAlert(false);
    scanLockRef.current = false;
    alertLockRef.current = false;
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <ActivityIndicator size="large" />
            <Paragraph style={styles.text}>{t('requestingCameraPermissions')}</Paragraph>
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
            <Title>{t('cameraPermissions')}</Title>
            <Paragraph>
              {t('cameraPermissionsDesc')}
            </Paragraph>
            <Button mode="contained" onPress={requestPermission} style={styles.button}>
              {t('allowAccess')}
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  const handleContainerLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerLayout({ width, height });
    }
  };

  return (
    <SafeAreaView 
      style={styles.container}
      edges={['top', 'bottom']}
      onLayout={handleContainerLayout}
    >
      {cameraReady ? (
        <CameraView
          key={cameraKey}
          onBarcodeScanned={cameraActive && !scanned && !loading ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'pdf417'],
          }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.cameraPlaceholder]}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.cameraPlaceholderText}>{t('initializingCamera')}</Text>
        </View>
      )}
      
      {/* Overlay con instrucciones */}
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.scanFrame} />
        </View>
        
        <Card style={styles.instructionCard}>
          <Card.Content>
            <Title style={styles.instructionTitle}>
              {mode === 'ng' ? t('scanJigNG') : t('scanQRCode')}
            </Title>
            <Paragraph style={styles.instructionText}>
              {mode === 'ng' 
                ? t('scanNGInstruction')
                : t('scanQRInstruction')
              }
            </Paragraph>
            {mode !== 'ng' ? (
              <Button
                mode="outlined"
                onPress={() => navigation.navigate('AddJig', { manualEntry: true })}
                style={styles.addButton}
                icon="plus-circle"
              >
                {t('addJigManually')}
              </Button>
            ) : (
              <Button
                mode="outlined"
                onPress={() => navigation.navigate('AddJigNG', { manualEntry: true })}
                style={styles.addButton}
                icon="alert-circle-outline"
              >
                {t('addJigManually')}
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
              <Paragraph>{t('processing')}</Paragraph>
            </Card.Content>
          </Card>
        )}
        
        {scanned && (
          <Button
            mode="contained"
            onPress={resetScanner}
            style={styles.button}
          >
            {t('scanAgain')}
          </Button>
        )}
        
        {!cameraActive && (
          <Card style={styles.disabledCard}>
            <Card.Content>
              <Paragraph style={styles.disabledText}>
                {t('cameraPaused')}
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
            <Text style={styles.modalTitle}>🔍 {t('jigNotFound')}</Text>
            <Text style={styles.modalMessage}>
              {t('jigNotFoundDesc')}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNotFoundModal(false)}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={() => handleAddNewJig(pendingQRCode)}
              >
                <Text style={styles.addButtonText}>{t('addJig')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    zIndex: 5, // Mejorado: zIndex explícito para overlay sobre la cámara
  },
  scanArea: {
    width: width * 0.8,
    aspectRatio: 1, // Mejorado: Mantiene área de escaneo cuadrada
    maxWidth: 300, // Mejorado: Tamaño máximo para tablets
    maxHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center', // Mejorado: Centrado explícito
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
    zIndex: 6, // Mejorado: zIndex explícito para tarjeta de instrucciones sobre overlay
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
    zIndex: 7, // Mejorado: zIndex explícito para controles sobre otros elementos
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
    zIndex: 100, // Mejorado: zIndex muy alto para modales sobre todo
  },
  modalContent: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
    maxWidth: '90%', // Mejorado: Responsive en pantallas pequeñas
    borderWidth: 1,
    borderColor: '#333333',
    alignSelf: 'center', // Mejorado: Centrado explícito
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
    alignItems: 'center', // Mejorado: Alineación vertical
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
  cameraPlaceholder: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholderText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
});
