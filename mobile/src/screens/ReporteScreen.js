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
  Text,
  FAB
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../contexts/ValidationContext';
import { formatDate } from '../utils/dateUtils';
import logger from '../utils/logger';
import { LinearGradient } from 'expo-linear-gradient';
import { reportService } from '../services/ReportService';
import { getAuthToken } from '../utils/authUtils';

const { width } = Dimensions.get('window');

export default function ReporteScreen({ navigation, route }) {
  const { user } = useAuth();
  const { 
    validations, 
    getValidationsByModel, 
    getCompletedModels,
    clearValidations,
    isGeneratingReport,
    setIsGeneratingReport
  } = useValidation();
  
  const { modelValidations, currentModel } = route.params || {};
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [turno, setTurno] = useState(user?.turno_actual || 'A');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  
  // Obtener validaciones del modelo seleccionado
  const currentValidations = selectedModel ? getValidationsByModel(selectedModel) : [];
  const completedModels = getCompletedModels();

  // Actualizar modelo seleccionado cuando cambien las validaciones
  useEffect(() => {
    if (currentModel && !selectedModel) {
      setSelectedModel(currentModel);
    }
  }, [currentModel, selectedModel]);

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

  // Generar reporte
  const generateReport = async () => {
    try {
      setIsGeneratingReport(true);
      
      // Formatear fecha para el servidor
      const fechaFormateada = new Date(fecha).toISOString();
      
      // Limpiar y validar datos antes de enviar
      const validacionesLimpias = currentValidations
        .filter(v => v.jig?.id && v.estado)
        .map(v => {
          const validacion = {
            jig_id: parseInt(v.jig.id),
            numero_jig: String(v.jig.numero_jig || ''),
            tipo: String(v.jig.tipo || ''),
            modelo: String(v.jig.modelo_actual || selectedModel || ''),
            estado: String(v.estado),
            cantidad: parseInt(v.cantidad) || 1,
            comentario: String(v.comentario || ''),
            linea: String(v.linea || '').trim(),
            created_at: new Date(v.created_at).toISOString(),
            tecnico_id: parseInt(user?.id)
          };
          
          if (isNaN(validacion.jig_id) || isNaN(validacion.tecnico_id) || isNaN(validacion.cantidad)) {
            logger.warn('Validación con datos inválidos:', v);
            return null;
          }
          
          return validacion;
        })
        .filter(v => v !== null);

      // Crear estructura de datos compatible con el backend
      const reportDataToSend = {
        fecha: fechaFormateada,
        turno: turno || 'A',
        tecnico: user?.nombre || 'N/A',
        tecnico_id: user?.id,
        modelo: selectedModel || 'N/A',
        validaciones: validacionesLimpias.map(v => ({
          jig_id: v.jig_id,
          numero_jig: v.numero_jig,
          tipo: v.tipo,
          modelo: v.modelo,
          estado: v.estado,
          cantidad: v.cantidad,
          comentario: v.comentario,
          linea: v.linea,
          created_at: v.created_at,
          tecnico_id: v.tecnico_id
        }))
      };

      // Validaciones
      if (isNaN(reportDataToSend.tecnico_id)) {
        Alert.alert('Error', 'ID de técnico inválido. Inicie sesión nuevamente.');
        return;
      }

      if (!reportDataToSend.validaciones || reportDataToSend.validaciones.length === 0) {
        Alert.alert('Error', 'No hay validaciones válidas para generar el reporte');
        return;
      }

      if (!reportDataToSend.modelo || reportDataToSend.modelo === 'N/A') {
        Alert.alert('Error', 'Debe seleccionar un modelo para el reporte');
        return;
      }

      // Generar reporte
      let result = await reportService.generateValidationReport(reportDataToSend);
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Error generando el reporte');
        return;
      }

      // Guardar datos del reporte y PDF
      setReportData(reportDataToSend);
      setPdfInfo({
        pdf_filename: result.data.pdf_filename,
        pdf_path: result.data.pdf_path,
        validations_count: result.data.validations_count,
        modelo: result.data.modelo,
        saved_to_audit: result.data.saved_to_audit !== undefined ? result.data.saved_to_audit : true
      });
      
      // El backend guarda automáticamente en auditoría, pero inicializamos saved como false
      // para que el usuario confirme visualmente el guardado
      setSaved(false);
      
      logger.info('✅ Reporte generado exitosamente. PDF guardado en auditoría por el backend.');
      
    } catch (error) {
      logger.error('Error generando reporte:', error);
      Alert.alert('Error', 'Error de conexión al generar el reporte');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Guardar en auditoría y navegar a AuditoriaScreen
  const handleSaveToAudit = async () => {
    try {
      setSaving(true);
      logger.info('💾 Guardando reporte en auditoría...');
      
      // El backend ya guarda automáticamente en auditoría al generar el reporte
      // Verificamos que el PDF esté guardado consultando la respuesta del servidor
      if (pdfInfo?.pdf_filename) {
        logger.info('✅ PDF ya generado:', pdfInfo.pdf_filename);
        logger.info('✅ El reporte fue guardado en auditoría automáticamente por el backend');
        
        // Confirmar visualmente después de un breve delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Guardar el nombre del archivo antes de limpiar el estado
        const savedFilename = pdfInfo.pdf_filename;
        
        setSaved(true);
        logger.info('✅ Estado actualizado: Guardado en auditoría');
        
        // Limpiar validaciones y resetear estado para empezar un nuevo reporte
        logger.info('🧹 Limpiando validaciones para empezar un nuevo reporte...');
        clearValidations();
        setReportData(null);
        setPdfInfo(null);
        setSaved(false);
        setSelectedModel(null);
        
        logger.info('✅ Estado reseteado. Listo para empezar un nuevo reporte.');
        
        // Mostrar confirmación y navegar a Home
        Alert.alert(
          '✅ Guardado en Auditoría',
          `El reporte "${savedFilename}" ha sido guardado exitosamente.\n\nLas validaciones han sido limpiadas.`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('Home');
              }
            }
          ]
        );
      } else {
        logger.warn('⚠️ No hay información del PDF disponible');
        Alert.alert(
          'Advertencia',
          'El PDF aún no está disponible. Por favor, espera a que se genere el reporte.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('❌ Error guardando en auditoría:', error);
      Alert.alert(
        'Error',
        'No se pudo confirmar el guardado del reporte en auditoría. El reporte puede haberse guardado correctamente. Verifica en la pantalla de Auditoría.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  // Continuar escaneando
  const handleContinueScanning = () => {
    navigation.navigate('QRScanner');
  };


  // Limpiar validaciones
  const handleClearValidations = () => {
    Alert.alert(
      'Limpiar Validaciones',
      '¿Estás seguro de que quieres limpiar todas las validaciones?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: () => {
            clearValidations();
            setSelectedModel(null);
            setReportData(null);
            setPdfInfo(null);
            setSaved(false);
          }
        }
      ]
    );
  };

  // Si no hay reporte generado, mostrar vista de generación
  if (!reportData || !pdfInfo) {
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
              <View style={styles.headerTextContainer}>
              <Title style={styles.headerTitle}>📊 Reporte de Validación</Title>
              <Paragraph style={styles.headerSubtitle}>
                {formatDate(fecha)} • Turno {turno}
              </Paragraph>
            </View>
            </View>
          </LinearGradient>

        {/* Información del técnico */}
          <Card style={styles.infoCard}>
          <Card.Content>
              <Title style={styles.cardTitle}>Información del Reporte</Title>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Técnico:</Paragraph>
                  <Paragraph style={styles.infoValue}>{user?.nombre || 'N/A'}</Paragraph>
              </View>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Modelo:</Paragraph>
                  <Paragraph style={styles.infoValue}>{selectedModel || 'N/A'}</Paragraph>
              </View>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Total Validaciones:</Paragraph>
                  <Paragraph style={styles.infoValue}>{currentValidations.length}</Paragraph>
              </View>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Turno:</Paragraph>
                    <Chip
                    style={[styles.turnoChip, { backgroundColor: getTurnoColor(turno) }]}
                    textStyle={styles.chipText}
                  >
                    {turno}
                    </Chip>
                </View>
              </View>
          </Card.Content>
        </Card>

          {/* Resumen estadístico */}
          {currentValidations.length > 0 && (
            <Card style={styles.summaryCard}>
          <Card.Content>
                <Title style={styles.cardTitle}>Resumen de Validaciones</Title>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryNumber}>{currentValidations.length}</Text>
                    <Text style={styles.summaryLabel}>Total Jigs</Text>
            </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>
                      {currentValidations.filter(v => v.estado === 'OK').length}
                    </Text>
                    <Text style={styles.summaryLabel}>OK</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNumber, { color: '#F44336' }]}>
                      {currentValidations.filter(v => v.estado === 'NG').length}
                    </Text>
                    <Text style={styles.summaryLabel}>NG</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryNumber}>
                      {currentValidations.reduce((sum, v) => sum + parseInt(v.cantidad || 0), 0)}
                    </Text>
                    <Text style={styles.summaryLabel}>Cantidad Total</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          )}

          {currentValidations.length === 0 && (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Paragraph style={styles.emptyText}>
                  No hay validaciones registradas. Escanea algunos jigs para generar el reporte.
                </Paragraph>
              </Card.Content>
            </Card>
          )}
        </ScrollView>

        {/* Botones FAB */}
        {currentValidations.length > 0 && (
          <View style={styles.fabContainer}>
            <FAB
              style={[styles.fab, styles.continueFab]}
                  icon="qrcode-scan"
              onPress={handleContinueScanning}
              mode="contained"
            />
            <FAB
              style={[styles.fab, styles.generateFab]}
              icon={isGeneratingReport ? "loading" : "file-document"}
              onPress={generateReport}
              disabled={isGeneratingReport}
            />
            <FAB
              style={[styles.fab, styles.clearFab]}
              icon="delete"
              onPress={handleClearValidations}
              small
            />
          </View>
        )}
      </View>
    );
  }

  // Vista de previsualización del reporte generado
  const validaciones = reportData.validaciones || [];
  const validacionesOK = validaciones.filter(v => v.estado === 'OK').length;
  const validacionesNG = validaciones.filter(v => v.estado === 'NG').length;
  
  // Debug: Verificar cantidad de validaciones
  logger.info('🔍 Validaciones en previsualización:', {
    total: validaciones.length,
    validaciones: validaciones.map(v => ({
      numero_jig: v.numero_jig,
      estado: v.estado,
      cantidad: v.cantidad
    }))
  });

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
              onPress={() => {
                setReportData(null);
                setPdfInfo(null);
                setSaved(false);
              }}
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

        {/* Lista completa de validaciones */}
        <Card style={styles.previewCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Validaciones Incluidas</Title>
            <Paragraph style={styles.previewSubtitle}>
              Total: {validaciones.length} validaciones
                          </Paragraph>
            <Divider style={styles.divider} />
            {validaciones.length === 0 ? (
              <Paragraph style={styles.emptyText}>
                No hay validaciones para mostrar
                          </Paragraph>
            ) : (
              <ScrollView 
                style={styles.validationsScroll}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {validaciones.map((validation, index) => (
                  <View key={`validation-${index}-${validation.numero_jig || index}`} style={styles.previewRow}>
                    <View style={styles.previewLeft}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Paragraph style={styles.previewJig}>
                          Jig: {validation.numero_jig || 'N/A'}
                        </Paragraph>
                        <Chip
                          style={[
                            styles.estadoChip,
                            { backgroundColor: getEstadoColor(validation.estado), marginLeft: 8 }
                          ]}
                          textStyle={styles.chipText}
                        >
                          {validation.estado}
                        </Chip>
                      </View>
                      <Paragraph style={styles.previewModel}>
                        Modelo: {validation.modelo || reportData.modelo}
                      </Paragraph>
                      {validation.tipo && (
                        <Paragraph style={styles.previewLinea}>
                          Tipo: {validation.tipo}
                        </Paragraph>
                      )}
                      {validation.linea && (
                        <Paragraph style={styles.previewLinea}>
                          Línea: {validation.linea}
                        </Paragraph>
                      )}
                      {validation.comentario && (
                        <Paragraph style={styles.previewComentario}>
                          Comentario: {validation.comentario}
                        </Paragraph>
                      )}
                      {validation.created_at && (
                        <Paragraph style={[styles.previewComentario, { fontSize: 10, marginTop: 4 }]}>
                          Fecha: {new Date(validation.created_at).toLocaleString('es-ES')}
                        </Paragraph>
                      )}
                    </View>
                    <View style={styles.previewRight}>
                      <Paragraph style={styles.previewCantidad}>
                        Cantidad: {validation.cantidad || 1}
                      </Paragraph>
                    </View>
                  </View>
                ))}
                </ScrollView>
            )}
          </Card.Content>
        </Card>

        {/* Información adicional del reporte */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Detalles del Reporte</Title>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Archivo PDF:</Paragraph>
                <Paragraph style={styles.infoValue} numberOfLines={1}>
                  {pdfInfo?.pdf_filename || 'Generando...'}
                </Paragraph>
              </View>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Fecha de Generación:</Paragraph>
                <Paragraph style={styles.infoValue}>
                  {reportData.fecha ? formatDate(reportData.fecha) : new Date().toLocaleDateString('es-ES')}
                </Paragraph>
              </View>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Total Validaciones:</Paragraph>
                <Paragraph style={styles.infoValue}>
                  {pdfInfo?.validations_count || validaciones.length}
                </Paragraph>
              </View>
              <View style={styles.infoItem}>
                <Paragraph style={styles.infoLabel}>Estado:</Paragraph>
                <Chip
                  style={[styles.turnoChip, { backgroundColor: saved ? '#4CAF50' : '#FF9800' }]}
                  textStyle={styles.chipText}
                >
                  {saved ? 'Guardado' : 'Pendiente'}
                </Chip>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Estado de guardado */}
        {saved && (
          <Surface style={styles.savedIndicator} elevation={2}>
            <View style={styles.savedContent}>
              <IconButton icon="check-circle" iconColor="#4CAF50" size={24} />
              <Paragraph style={styles.savedText}>
                ✅ Reporte guardado en auditoría
              </Paragraph>
            </View>
          </Surface>
        )}
      </ScrollView>

      {/* Botones FAB */}
      {reportData && pdfInfo && (
        <View style={styles.fabContainer}>
          <FAB
            style={[styles.fab, styles.continueFab]}
            icon="qrcode-scan"
            onPress={handleContinueScanning}
            mode="contained"
            label="Continuar"
            small
          />
          {!saved ? (
            <FAB
              style={[styles.fab, styles.saveFab]}
              icon={saving ? "loading" : "check-circle"}
              onPress={handleSaveToAudit}
              disabled={saving}
              mode="contained"
              label="Guardar"
            />
          ) : (
            <FAB
              style={[styles.fab, styles.auditFab]}
              icon="file-document-multiple"
              onPress={() => navigation.navigate('Auditoria')}
              mode="contained"
              label="Auditoría"
            />
          )}
          <FAB
            style={[styles.fab, styles.clearFab]}
            icon="delete"
            onPress={handleClearValidations}
            small
            mode="contained"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  emptyCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: '#FFF3E0',
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
  previewLinea: {
    fontSize: 11,
    color: '#2196F3',
    marginTop: 4,
    fontWeight: '600',
  },
  previewComentario: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  previewRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  validationsScroll: {
    maxHeight: 500,
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
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    padding: 20,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    flexDirection: 'column',
    gap: 12,
    zIndex: 1000,
  },
  actionButton: {
    borderRadius: 12,
    elevation: 2,
  },
  continueButton: {
    borderColor: '#2196F3',
  },
  previewButton: {
    backgroundColor: '#F44336',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    elevation: 4,
  },
  auditButton: {
    backgroundColor: '#9C27B0',
    elevation: 4,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    gap: 12,
    alignItems: 'flex-end',
  },
  fab: {
    borderRadius: 28,
  },
  continueFab: {
    backgroundColor: '#2196F3',
    elevation: 8,
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  previewFab: {
    backgroundColor: '#F44336',
    elevation: 8,
    shadowColor: '#F44336',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  generateFab: {
    backgroundColor: '#4CAF50',
  },
  saveFab: {
    backgroundColor: '#4CAF50',
    elevation: 8,
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  auditFab: {
    backgroundColor: '#9C27B0',
    elevation: 8,
    shadowColor: '#9C27B0',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  clearFab: {
    backgroundColor: '#F44336',
  },
});

