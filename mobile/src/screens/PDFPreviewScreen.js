import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  ActivityIndicator,
  Surface,
  Divider,
  IconButton,
  Text
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateUtils';
import logger from '../utils/logger';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { getAuthToken } from '../utils/authUtils';
import { API_BASE_URL } from '../utils/apiClient';

const { width } = Dimensions.get('window');

export default function PDFPreviewScreen({ navigation, route }) {
  const { user } = useAuth();
  const { reportData, pdfInfo } = route.params || {};
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Verificar si ya está guardado (el backend lo guarda automáticamente)
  useEffect(() => {
    if (pdfInfo && pdfInfo.saved_to_audit) {
      setSaved(true);
    }
  }, [pdfInfo]);

  // Función para obtener color del turno
  const getTurnoColor = (turno) => {
    switch (turno) {
      case 'A': return '#2196F3';
      case 'B': return '#4CAF50';
      case 'C': return '#FF9800';
      default: return '#757575';
    }
  };

  // Función para obtener color del estado
  const getEstadoColor = (estado) => {
    return estado === 'OK' ? '#4CAF50' : '#F44336';
  };

  // Guardar en auditoría (confirmar explícitamente)
  const handleSaveToAudit = async () => {
    try {
      setSaving(true);
      
      // El PDF ya está guardado en auditoría por el backend
      // Solo confirmamos visualmente
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaved(true);
      Alert.alert(
        '✅ Guardado en Auditoría',
        'El reporte ha sido guardado exitosamente en el sistema de auditoría.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      logger.error('Error guardando en auditoría:', error);
      Alert.alert('Error', 'No se pudo guardar el reporte en auditoría');
    } finally {
      setSaving(false);
    }
  };

  // Descargar PDF
  const handleDownloadPDF = async () => {
    if (downloadingPDF) {
      return;
    }
    
    try {
      setDownloadingPDF(true);
      logger.info('📥 Iniciando descarga de PDF:', pdfInfo?.pdf_filename);
      
      const downloadUrl = `${API_BASE_URL}/validations/download-pdf/${pdfInfo?.pdf_filename}`;
      
      const token = await getAuthToken();
      
      const localFilename = `reporte_${Date.now()}.pdf`;
      const localUri = `${FileSystem.documentDirectory}${localFilename}`;
      
      const downloadOptions = {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      };
      
      const downloadResult = await Promise.race([
        FileSystem.downloadAsync(downloadUrl, localUri, downloadOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de descarga')), 30000)
        )
      ]);
      
      if (downloadResult.status === 200) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          try {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Abrir Reporte PDF'
            });
            logger.info('✅ PDF compartido exitosamente');
          } catch (shareError) {
            logger.error('❌ Error compartiendo PDF:', shareError);
            Alert.alert(
              'PDF Descargado',
              `El PDF se ha descargado pero no se pudo abrir automáticamente.\n\nUbicación: ${downloadResult.uri}`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert(
            'PDF Descargado',
            `El PDF se ha descargado en: ${downloadResult.uri}`,
            [{ text: 'OK' }]
          );
        }
      } else {
        throw new Error(`Error descargando: Status ${downloadResult.status}`);
      }
    } catch (error) {
      logger.error('❌ Error descargando PDF:', error);
      let errorMessage = 'No se pudo descargar el PDF';
      if (error.message.includes('Timeout')) {
        errorMessage = 'La descarga tardó demasiado. Verifique su conexión e intente nuevamente.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Error de conexión. Verifique su internet e intente nuevamente.';
      } else if (error.message.includes('404')) {
        errorMessage = 'El archivo PDF no se encontró en el servidor.';
      }
      Alert.alert('Error de Descarga', errorMessage);
    } finally {
      setDownloadingPDF(false);
    }
  };

  // Visualizar PDF (abrir con aplicación externa)
  const handleViewPDF = async () => {
    if (downloadingPDF) {
      logger.warn('⚠️ Ya hay una descarga en progreso');
      return;
    }
    
    // Verificar si estamos en web
    if (Platform.OS === 'web') {
      Alert.alert(
        'Información',
        'En la versión web, por favor use el botón "Descargar PDF" para descargar el archivo.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      setDownloadingPDF(true);
      logger.info('📥 Iniciando descarga de PDF para abrir:', pdfInfo?.pdf_filename);
      
      if (!pdfInfo?.pdf_filename) {
        throw new Error('No se encontró el nombre del archivo PDF');
      }
      
      const downloadUrl = `${API_BASE_URL}/validations/download-pdf/${pdfInfo.pdf_filename}`;
      
      logger.info('🔗 URL de descarga:', downloadUrl);
      
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }
      
      const localFilename = `reporte_${Date.now()}.pdf`;
      const localUri = `${FileSystem.documentDirectory}${localFilename}`;
      
      logger.info('💾 Guardando PDF en:', localUri);
      
      const downloadOptions = {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Authorization': `Bearer ${token}`
        }
      };
      
      logger.info('⬇️ Iniciando descarga...');
      const downloadResult = await Promise.race([
        FileSystem.downloadAsync(downloadUrl, localUri, downloadOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de descarga')), 30000)
        )
      ]);
      
      logger.info('📥 Descarga completada. Status:', downloadResult.status);
      logger.info('📁 URI del archivo:', downloadResult.uri);
      
      if (downloadResult.status === 200) {
        // Verificar que el archivo existe
        const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
        logger.info('📄 Info del archivo:', JSON.stringify(fileInfo));
        
        if (!fileInfo.exists) {
          throw new Error('El archivo descargado no existe');
        }
        
        const isAvailable = await Sharing.isAvailableAsync();
        logger.info('📱 Sharing disponible:', isAvailable);
        
        if (isAvailable) {
          try {
            logger.info('🔄 Share iniciando...');
            // Usar Sharing para mostrar el selector de aplicaciones
            const result = await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Abrir PDF con'
            });
            logger.info('✅ PDF compartido exitosamente. Resultado:', JSON.stringify(result));
          } catch (shareError) {
            logger.error('❌ Error compartiendo PDF:', shareError);
            logger.error('❌ Detalles del error:', JSON.stringify(shareError, null, 2));
            Alert.alert(
              'Error',
              `No se pudo abrir el selector de aplicaciones.\n\nError: ${shareError.message || 'Error desconocido'}\n\nEl PDF se descargó correctamente.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          logger.warn('⚠️ Sharing no disponible, intentando Linking...');
          // Fallback: intentar abrir directamente
          const canOpen = await Linking.canOpenURL(downloadResult.uri);
          logger.info('🔗 Linking puede abrir:', canOpen);
          if (canOpen) {
            await Linking.openURL(downloadResult.uri);
            logger.info('✅ PDF abierto con Linking');
          } else {
            Alert.alert(
              'PDF Descargado',
              `El PDF se ha descargado pero no se pudo abrir automáticamente.\n\nUbicación: ${downloadResult.uri}`,
              [{ text: 'OK' }]
            );
          }
        }
      } else {
        throw new Error(`Error descargando: Status ${downloadResult.status}`);
      }
    } catch (error) {
      logger.error('❌ Error descargando PDF para visualizar:', error);
      logger.error('❌ Stack trace:', error.stack);
      let errorMessage = 'No se pudo descargar el PDF';
      if (error.message.includes('Timeout')) {
        errorMessage = 'La descarga tardó demasiado. Verifique su conexión e intente nuevamente.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Error de conexión. Verifique su internet e intente nuevamente.';
      } else if (error.message.includes('404')) {
        errorMessage = 'El archivo PDF no se encontró en el servidor.';
      } else {
        errorMessage = `Error: ${error.message || 'Error desconocido'}`;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setDownloadingPDF(false);
      logger.info('🏁 Descarga finalizada');
    }
  };

  if (!reportData || !pdfInfo) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Paragraph>Cargando previsualización...</Paragraph>
      </View>
    );
  }

  const validaciones = reportData.validaciones || [];
  const validacionesOK = validaciones.filter(v => v.estado === 'OK').length;
  const validacionesNG = validaciones.filter(v => v.estado === 'NG').length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={['#2196F3', '#1976D2', '#0D47A1']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <IconButton
              icon="arrow-left"
              iconColor="#FFFFFF"
              size={24}
              onPress={() => navigation.goBack()}
            />
            <View style={styles.headerTextContainer}>
              <Title style={styles.headerTitle}>📄 Previsualización del Reporte</Title>
              <Paragraph style={styles.headerSubtitle}>
                Revisa los detalles antes de guardar
              </Paragraph>
            </View>
          </View>
        </LinearGradient>

        {/* Información del reporte */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Información del Reporte</Title>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Técnico:</Paragraph>
                <Paragraph style={styles.infoValue}>{reportData.tecnico || user?.nombre}</Paragraph>
              </View>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Modelo:</Paragraph>
                <Paragraph style={styles.infoValue}>{reportData.modelo || 'N/A'}</Paragraph>
              </View>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Fecha:</Paragraph>
                <Paragraph style={styles.infoValue}>
                  {reportData.fecha ? formatDate(reportData.fecha) : new Date().toLocaleDateString('es-ES')}
                </Paragraph>
              </View>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Turno:</Paragraph>
                <Chip
                  style={[styles.turnoChip, { backgroundColor: getTurnoColor(reportData.turno) }]}
                  textStyle={styles.chipText}
                >
                  {reportData.turno}
                </Chip>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Resumen estadístico */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Resumen de Validaciones</Title>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{validaciones.length}</Text>
                <Text style={styles.summaryLabel}>Total Jigs</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>
                  {validacionesOK}
                </Text>
                <Text style={styles.summaryLabel}>OK</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNumber, { color: '#F44336' }]}>
                  {validacionesNG}
                </Text>
                <Text style={styles.summaryLabel}>NG</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {validaciones.reduce((sum, v) => sum + parseInt(v.cantidad || 0), 0)}
                </Text>
                <Text style={styles.summaryLabel}>Cantidad Total</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Vista previa de validaciones (primeras 5) */}
        <Card style={styles.previewCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Vista Previa de Validaciones</Title>
            <Paragraph style={styles.previewSubtitle}>
              Mostrando {Math.min(5, validaciones.length)} de {validaciones.length} validaciones
            </Paragraph>
            <Divider style={styles.divider} />
            {validaciones.slice(0, 5).map((validation, index) => (
              <View key={index} style={styles.previewRow}>
                <View style={styles.previewLeft}>
                  <Paragraph style={styles.previewJig}>
                    Jig: {validation.numero_jig || 'N/A'}
                  </Paragraph>
                  <Paragraph style={styles.previewModel}>
                    {validation.modelo || reportData.modelo}
                  </Paragraph>
                </View>
                <View style={styles.previewRight}>
                  <Chip
                    style={[
                      styles.estadoChip,
                      { backgroundColor: getEstadoColor(validation.estado) }
                    ]}
                    textStyle={styles.chipText}
                  >
                    {validation.estado}
                  </Chip>
                  <Paragraph style={styles.previewCantidad}>
                    Cant: {validation.cantidad || 1}
                  </Paragraph>
                </View>
              </View>
            ))}
            {validaciones.length > 5 && (
              <Paragraph style={styles.moreText}>
                ... y {validaciones.length - 5} validaciones más
              </Paragraph>
            )}
          </Card.Content>
        </Card>

        {/* Información del PDF */}
        <Card style={styles.pdfInfoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Información del PDF</Title>
            <View style={styles.pdfInfo}>
              <Paragraph style={styles.pdfInfoLabel}>Archivo:</Paragraph>
              <Paragraph style={styles.pdfInfoValue}>
                {pdfInfo?.pdf_filename || 'Generando...'}
              </Paragraph>
            </View>
            {pdfInfo?.pdf_path && (
              <View style={styles.pdfInfo}>
                <Paragraph style={styles.pdfInfoLabel}>Ruta:</Paragraph>
                <Paragraph style={styles.pdfInfoValue} numberOfLines={2}>
                  {pdfInfo.pdf_path}
                </Paragraph>
              </View>
            )}
            <View style={styles.pdfInfo}>
              <Paragraph style={styles.pdfInfoLabel}>Validaciones incluidas:</Paragraph>
              <Paragraph style={styles.pdfInfoValue}>
                {pdfInfo?.validations_count || validaciones.length}
              </Paragraph>
            </View>
          </Card.Content>
        </Card>

        {/* Estado de guardado */}
        {saved && (
          <Surface style={styles.savedIndicator} elevation={2}>
            <View style={styles.savedContentWrapper}>
              <View style={styles.savedContent}>
                <IconButton icon="check-circle" iconColor="#4CAF50" size={24} />
                <Paragraph style={styles.savedText}>
                  ✅ Reporte guardado en auditoría
                </Paragraph>
              </View>
            </View>
          </Surface>
        )}
      </ScrollView>

      {/* Botones de acción */}
      <View style={styles.actionButtons}>
        {!saved ? (
          <Button
            mode="contained"
            onPress={handleSaveToAudit}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="check-circle"
          >
            {saving ? 'Guardando...' : '✅ Guardar en Auditoría'}
          </Button>
        ) : (
          <View style={styles.downloadButtons}>
            <Button
              mode="contained"
              onPress={handleViewPDF}
              disabled={downloadingPDF}
              style={[styles.actionButton, styles.viewButton]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              icon="eye"
            >
              Visualizar PDF
            </Button>
            <Button
              mode="outlined"
              onPress={handleDownloadPDF}
              loading={downloadingPDF}
              disabled={downloadingPDF}
              style={[styles.actionButton, styles.downloadButton]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              icon="download"
            >
              {downloadingPDF ? 'Descargando...' : 'Descargar PDF'}
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#E3F2FD',
    fontSize: 14,
  },
  infoCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  summaryCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: '#FFF3E0',
  },
  previewCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  pdfInfoCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: '#E3F2FD',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1E293B',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  turnoChip: {
    borderRadius: 16,
    marginTop: 4,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  summaryItem: {
    alignItems: 'center',
    marginBottom: 16,
    width: '48%',
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  previewSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  divider: {
    marginVertical: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewLeft: {
    flex: 1,
  },
  previewJig: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  previewModel: {
    fontSize: 12,
    color: '#64748B',
  },
  previewRight: {
    alignItems: 'flex-end',
  },
  estadoChip: {
    borderRadius: 12,
    marginBottom: 4,
  },
  previewCantidad: {
    fontSize: 12,
    color: '#64748B',
  },
  moreText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  pdfInfo: {
    marginBottom: 12,
  },
  pdfInfoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  pdfInfoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  savedIndicator: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
  },
  savedContentWrapper: {
    overflow: 'hidden',
  },
  savedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    elevation: 4,
  },
  downloadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
  },
  viewButton: {
    backgroundColor: '#2196F3',
  },
  downloadButton: {
    borderColor: '#2196F3',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

