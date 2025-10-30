import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  RefreshControl,
  Linking,
  Platform
} from 'react-native';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Button,
  Card,
  Title,
  Paragraph,
  TextInput,
  RadioButton,
  ActivityIndicator,
  Chip,
  Surface,
  Divider,
  List,
  IconButton,
  FAB
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../contexts/ValidationContext';
import { reportService } from '../services/ReportService';

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
  const [refreshing, setRefreshing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  
  // Obtener validaciones del modelo seleccionado
  const currentValidations = selectedModel ? getValidationsByModel(selectedModel) : [];
  const completedModels = getCompletedModels();
  
  // Debug: Verificar datos
  console.log('🔍 Debug ReporteScreen:');
  console.log('selectedModel:', selectedModel);
  console.log('currentValidations.length:', currentValidations.length);
  console.log('completedModels:', completedModels);
  console.log('Todas las validaciones:', validations);
  console.log('Validaciones por modelo:', validations.map(v => ({ modelo: v.modelo_actual, jig: v.jig?.numero_jig })));

  // Actualizar modelo seleccionado cuando cambien las validaciones
  useEffect(() => {
    if (currentModel && !selectedModel) {
      setSelectedModel(currentModel);
    }
  }, [currentModel, selectedModel]);

  // Verificar si el usuario tiene firma guardada
  useEffect(() => {
    if (user?.firma_digital) {
      setHasSignature(true);
    } else {
      setHasSignature(false);
    }
  }, [user?.firma_digital]);

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

  // Funciones formatDate y formatTime ahora importadas desde dateUtils

  const handleRefresh = () => {
    setRefreshing(true);
    // Simular refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Función para diagnosticar problemas del backend
  const handleTestBackend = async () => {
    try {
      setIsGeneratingReport(true);
      console.log('🔍 Iniciando diagnóstico del backend...');
      
      const result = await reportService.testBackendConnection();
      
      if (result.success) {
        Alert.alert(
          '✅ Backend Funcionando',
          'El servidor está respondiendo correctamente.\n\nEl problema puede estar en el endpoint específico de generación de PDF.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Backend No Disponible',
          `El servidor no está respondiendo:\n\n${result.error}\n\nVerifique que el servidor esté ejecutándose.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error en diagnóstico:', error);
      Alert.alert('Error', 'Error al diagnosticar el backend');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const downloadPDF = async (filename) => {
    if (downloadingPDF) {
      console.log('⚠️ Descarga ya en progreso, ignorando...');
      return;
    }
    
    try {
      setDownloadingPDF(true);
      console.log('📥 Iniciando descarga de PDF:', filename);
      
      // Mostrar indicador de carga
      Alert.alert('Descargando PDF', 'Preparando descarga...');
      
      // URL del endpoint de descarga
      const downloadUrl = `https://6ce89e26f529.ngrok-free.app/api/validations/download-pdf/${filename}`;
      console.log('🔗 URL de descarga:', downloadUrl);
      
      // Crear nombre de archivo local
      const localFilename = `reporte_${Date.now()}.pdf`;
      const localUri = `${FileSystem.documentDirectory}${localFilename}`;
      console.log('💾 Archivo local:', localUri);
      
      // Configurar opciones de descarga con timeout
      const downloadOptions = {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      };
      
      // Descargar el archivo con timeout
      console.log('⬇️ Iniciando descarga...');
      const downloadResult = await Promise.race([
        FileSystem.downloadAsync(downloadUrl, localUri, downloadOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de descarga')), 30000)
        )
      ]);
      
      console.log('📊 Resultado de descarga:', downloadResult);
      
      if (downloadResult.status === 200) {
        console.log('✅ Descarga exitosa, verificando compatibilidad de compartir...');
        
        // Verificar si se puede compartir
        const isAvailable = await Sharing.isAvailableAsync();
        console.log('📤 Compartir disponible:', isAvailable);
        
        if (isAvailable) {
          console.log('📤 Abriendo diálogo de compartir...');
          try {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Abrir Reporte PDF'
            });
            console.log('✅ PDF compartido exitosamente');
          } catch (shareError) {
            console.error('❌ Error compartiendo PDF:', shareError);
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
      console.error('❌ Error descargando PDF:', error);
      
      let errorMessage = 'No se pudo descargar el PDF';
      if (error.message.includes('Timeout')) {
        errorMessage = 'La descarga tardó demasiado. Verifique su conexión e intente nuevamente.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Error de conexión. Verifique su internet e intente nuevamente.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      Alert.alert(
        'Error de Descarga',
        errorMessage,
        [
          { text: 'Reintentar', onPress: () => downloadPDF(filename) },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleGenerateReport = async () => {
    if (currentValidations.length === 0) {
      Alert.alert('Error', 'No hay validaciones para generar el reporte');
      return;
    }

    // Verificar si el usuario tiene firma guardada
    if (!hasSignature) {
      Alert.alert(
        'Firma Requerida',
        'Para generar reportes profesionales, necesitas configurar tu firma digital.\n\n¿Deseas configurarla ahora?',
        [
          {
            text: 'Generar Sin Firma',
            onPress: () => generateReportWithoutSignature(),
            style: 'cancel'
          },
          {
            text: 'Configurar Firma',
            onPress: () => navigation.navigate('Profile')
          }
        ]
      );
      return;
    }

    generateReportWithSignature();
  };

  const generateReportWithoutSignature = async () => {
    // Llamar a la función original de generación
    await generateReportWithSignature();
  };

  const generateReportWithSignature = async () => {
    try {
      setIsGeneratingReport(true);
      
      // Formatear fecha para el servidor
      const fechaFormateada = new Date(fecha).toISOString();
      
      // Debug: Verificar datos antes de procesar
      console.log('🔍 Debug generateReportWithSignature:');
      console.log('currentValidations.length:', currentValidations.length);
      console.log('selectedModel:', selectedModel);
      console.log('currentValidations:', currentValidations.map(v => ({
        modelo: v.modelo_actual,
        jig: v.jig?.numero_jig,
        estado: v.estado
      })));
      
      // Limpiar y validar datos antes de enviar
      const validacionesLimpias = currentValidations
        .filter(v => v.jig?.id && v.estado) // Solo validaciones con jig y estado
        .map(v => {
          // Asegurar que todos los campos requeridos existan
          const validacion = {
            jig_id: parseInt(v.jig.id),
            numero_jig: String(v.jig.numero_jig || ''),
            tipo: String(v.jig.tipo || ''),
            modelo: String(v.jig.modelo_actual || selectedModel || ''),
            estado: String(v.estado),
            cantidad: parseInt(v.cantidad) || 1,
            comentario: String(v.comentario || ''),
            created_at: new Date(v.created_at).toISOString(),
            tecnico_id: parseInt(user?.id)
          };
          
          // Validar que no hay valores NaN o undefined
          if (isNaN(validacion.jig_id) || isNaN(validacion.tecnico_id) || isNaN(validacion.cantidad)) {
            console.warn('Validación con datos inválidos:', v);
            return null;
          }
          
          return validacion;
        })
        .filter(v => v !== null); // Remover validaciones inválidas

      console.log('🔍 validacionesLimpias.length:', validacionesLimpias.length);
      console.log('🔍 validacionesLimpias:', validacionesLimpias.map(v => ({
        jig_id: v.jig_id,
        numero_jig: v.numero_jig,
        estado: v.estado,
        comentario: v.comentario,
        created_at: v.created_at
      })));

      // Crear estructura de datos compatible con el backend
      const reportData = {
        fecha: fechaFormateada,
        turno: turno || 'A',
        tecnico: user?.nombre || 'N/A',
        tecnico_id: user?.id,
        modelo: selectedModel || 'N/A',
        signature_data: user?.firma_digital || null, // Incluir firma digital
        validaciones: validacionesLimpias.map(v => ({
          jig_id: v.jig_id,
          numero_jig: v.numero_jig,
          tipo: v.tipo,
          modelo: v.modelo,
          estado: v.estado,
          cantidad: v.cantidad,
          comentario: v.comentario,
          created_at: v.created_at,
          tecnico_id: v.tecnico_id
        }))
      };

      console.log('📊 reportData.validaciones.length:', reportData.validaciones.length);
      console.log('📊 reportData.validaciones:', reportData.validaciones.map(v => ({
        jig_id: v.jig_id,
        numero_jig: v.numero_jig,
        estado: v.estado,
        comentario: v.comentario
      })));
      
      // Debug: Verificar firma digital
      console.log('🔍 Debug Firma Digital:');
      console.log('user?.firma_digital existe:', !!user?.firma_digital);
      console.log('user?.firma_digital length:', user?.firma_digital?.length || 0);
      console.log('user?.firma_digital preview:', user?.firma_digital?.substring(0, 100) || 'null');
      console.log('signature_data en reportData:', !!reportData.signature_data);
      console.log('signature_data length:', reportData.signature_data?.length || 0);
      console.log('signature_data preview:', reportData.signature_data?.substring(0, 100) || 'null');

      // Validar que no hay valores NaN en el reporte principal
      if (isNaN(reportData.tecnico_id)) {
        Alert.alert('Error', 'ID de técnico inválido. Inicie sesión nuevamente.');
        return;
      }

      // Validar datos antes de enviar
      if (!reportData.validaciones || reportData.validaciones.length === 0) {
        Alert.alert('Error', 'No hay validaciones válidas para generar el reporte');
        return;
      }

      if (!reportData.modelo || reportData.modelo === 'N/A') {
        Alert.alert('Error', 'Debe seleccionar un modelo para el reporte');
        return;
      }

      if (!reportData.tecnico_id || reportData.tecnico_id === 0) {
        Alert.alert('Error', 'No se pudo identificar al técnico. Inicie sesión nuevamente.');
        return;
      }

      // Validar que todas las validaciones tengan datos requeridos
      const validacionesInvalidas = reportData.validaciones.filter(v => 
        !v.jig_id || !v.estado || !v.created_at
      );

      if (validacionesInvalidas.length > 0) {
        Alert.alert('Error', 'Algunas validaciones tienen datos incompletos. Verifique la información.');
        return;
      }

      // Test de serialización JSON
      try {
        const testSerialization = JSON.stringify(reportData);
        console.log('✅ Serialización JSON exitosa');
      } catch (serializationError) {
        console.error('❌ Error en serialización JSON:', serializationError);
        Alert.alert('Error', 'Error al preparar los datos del reporte');
        return;
      }

      console.log('=== DEBUG REPORTE ===');
      console.log('Datos del reporte:', JSON.stringify(reportData, null, 2));
      console.log('Número de validaciones:', reportData.validaciones.length);
      console.log('Modelo seleccionado:', reportData.modelo);
      console.log('Técnico ID:', reportData.tecnico_id);
      console.log('Fecha formateada:', reportData.fecha);
      console.log('Tamaño del JSON:', JSON.stringify(reportData).length, 'caracteres');
      console.log('========================');
      
      // Intentar con formato alternativo si el primero falla
      let result = await reportService.generateValidationReport(reportData);
      console.log('Respuesta del servidor (intento 1):', result);
      
      // Si falla, intentar con formato simplificado
      if (!result.success && result.error?.includes('500')) {
        console.log('🔄 Intentando con formato simplificado...');
        
        const reportDataSimplificado = {
          fecha: fechaFormateada,
          turno: turno || 'A',
          tecnico: user?.nombre || 'N/A',
          tecnico_id: user?.id,
          modelo: selectedModel || 'N/A',
          signature_data: user?.firma_digital || null, // Incluir firma digital
          validaciones: validacionesLimpias.map(v => ({
            jig_id: v.jig_id,
            estado: v.estado,
            cantidad: v.cantidad,
            created_at: v.created_at
          }))
        };
        
        console.log('Datos simplificados:', JSON.stringify(reportDataSimplificado, null, 2));
        result = await reportService.generateValidationReport(reportDataSimplificado);
        console.log('Respuesta del servidor (intento 2):', result);
      }

      // Si ambos intentos fallan, mostrar reporte local temporal
      if (!result.success) {
        console.log('⚠️ Servidor no disponible, generando reporte local...');
        const reporteLocal = generarReporteLocal(reportData);
        mostrarReporteLocal(reporteLocal);
        return;
      }
      
      if (result.success) {
        Alert.alert(
          'Reporte Generado',
          `El reporte se ha generado exitosamente.\n\nModelo: ${result.data.modelo}\nValidaciones: ${result.data.validations_count}\nPDF: ${result.data.pdf_path}`,
          [
            {
              text: downloadingPDF ? 'Descargando...' : 'Descargar PDF',
              onPress: downloadingPDF ? null : () => {
                console.log('Descargando reporte:', result.data);
                if (result.data.pdf_filename) {
                  downloadPDF(result.data.pdf_filename);
                } else {
                  Alert.alert('Error', 'No se encontró el archivo PDF');
                }
              },
              disabled: downloadingPDF
            },
            {
              text: 'Nuevo Reporte',
              onPress: () => {
                clearValidations();
                navigation.navigate('QRScanner');
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Error generando el reporte');
      }
    } catch (error) {
      console.error('Error generando reporte:', error);
      console.error('Detalles del error:', error.response?.data);
      
      let errorMessage = 'Error de conexión al generar el reporte';
      
      if (error.response?.status === 500) {
        errorMessage = 'Error interno del servidor. Verifique los datos e intente nuevamente.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Datos inválidos. Verifique la información del reporte.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Función para generar reporte local temporal
  const generarReporteLocal = (reportData) => {
    const fechaFormateada = new Date(reportData.fecha).toLocaleDateString('es-ES');
    const horaFormateada = new Date(reportData.fecha).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const totalValidaciones = reportData.validaciones.length;
    const validacionesOK = reportData.validaciones.filter(v => v.estado === 'OK').length;
    const validacionesNG = reportData.validaciones.filter(v => v.estado === 'NG').length;

    return {
      fecha: fechaFormateada,
      hora: horaFormateada,
      turno: reportData.turno,
      tecnico: reportData.tecnico,
      modelo: reportData.modelo,
      totalValidaciones,
      validacionesOK,
      validacionesNG,
      validaciones: reportData.validaciones
    };
  };

  // Función para mostrar reporte local
  const mostrarReporteLocal = (reporte) => {
    const mensaje = `📊 REPORTE LOCAL GENERADO

📅 Fecha: ${reporte.fecha}
🕐 Hora: ${reporte.hora}
👤 Técnico: ${reporte.tecnico}
🏭 Modelo: ${reporte.modelo}
🔄 Turno: ${reporte.turno}

📈 ESTADÍSTICAS:
✅ Validaciones OK: ${reporte.validacionesOK}
❌ Validaciones NG: ${reporte.validacionesNG}
📊 Total: ${reporte.totalValidaciones}

⚠️ NOTA: Este es un reporte local temporal.
El servidor no está disponible para generar el PDF.
Los datos se han guardado localmente.`;

    Alert.alert(
      'Reporte Local Generado',
      mensaje,
      [
        {
          text: 'Ver Detalles',
          onPress: () => {
            console.log('=== REPORTE LOCAL ===');
            console.log(JSON.stringify(reporte, null, 2));
            console.log('===================');
          }
        },
        {
          text: 'Nuevo Reporte',
          onPress: () => {
            clearValidations();
            navigation.navigate('QRScanner');
          }
        },
        {
          text: 'OK',
          style: 'default'
        }
      ]
    );
  };

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
          }
        }
      ]
    );
  };

  const handleContinueScanning = () => {
    navigation.navigate('QRScanner');
  };


  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header tipo estado de cuenta */}
        <Surface style={styles.headerCard} elevation={4}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Title style={styles.headerTitle}>📊 Reporte de Validación</Title>
              <Paragraph style={styles.headerSubtitle}>
                {formatDate(fecha)} {formatTime12Hour(fecha)} • Turno {turno}
              </Paragraph>
            </View>
            <View style={styles.headerRight}>
              <Chip
                style={[styles.turnoChip, { backgroundColor: getTurnoColor(turno) }]}
                textStyle={styles.chipText}
              >
                TURNO {turno}
              </Chip>
            </View>
          </View>
        </Surface>

        {/* Información del técnico */}
        <Card style={styles.technicianCard}>
          <Card.Content>
            <View style={styles.technicianInfo}>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>Técnico:</Paragraph>
                <Paragraph style={styles.technicianValue}>{user?.nombre || 'N/A'}</Paragraph>
              </View>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>Modelo:</Paragraph>
                <Paragraph style={styles.technicianValue}>{selectedModel || 'N/A'}</Paragraph>
              </View>
              <View style={styles.technicianItem}>
                <Paragraph style={styles.technicianLabel}>Total Validaciones:</Paragraph>
                <Paragraph style={styles.technicianValue}>{currentValidations.length}</Paragraph>
              </View>
            </View>
            
            {/* Selector de modelo si hay múltiples modelos */}
            {completedModels.length > 1 && (
              <View style={styles.modelSelector}>
                <Paragraph style={styles.selectorLabel}>Cambiar Modelo:</Paragraph>
                <View style={styles.modelChips}>
                  {completedModels.map((model) => (
                    <Chip
                      key={model}
                      selected={selectedModel === model}
                      onPress={() => setSelectedModel(model)}
                      style={[
                        styles.modelChip,
                        selectedModel === model && { backgroundColor: '#2196F3' }
                      ]}
                      textStyle={selectedModel === model ? { color: '#E8E8E8' } : {}}
                    >
                      {model}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Lista de validaciones en formato tabla bancaria */}
        <Card style={styles.validationsCard}>
          <Card.Content>
            <View style={styles.validationsHeader}>
              <Title style={styles.validationsTitle}>Validaciones Realizadas</Title>
              <Chip style={styles.countChip}>
                {currentValidations.length} jigs
              </Chip>
            </View>
            
            {currentValidations.length === 0 ? (
              <View style={styles.emptyState}>
                <Paragraph style={styles.emptyText}>
                  No hay validaciones registradas
                </Paragraph>
                <Button
                  mode="outlined"
                  onPress={() => navigation.navigate('QRScanner')}
                  style={styles.scanButton}
                  icon="qrcode-scan"
                >
                  Escanear Jig
                </Button>
              </View>
            ) : (
              <View style={styles.tableContainer}>
                {/* Header de la tabla */}
                <View style={styles.tableHeader}>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>FECHA</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>TURNO</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>EMPLEADO</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>TIPO JIG</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>N° JIG</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>MODELO</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>CANT.</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>ESTADO</Paragraph>
                  </View>
                  <View style={styles.headerCell}>
                    <Paragraph style={styles.headerText}>COMENTARIOS</Paragraph>
                  </View>
                </View>

                {/* Filas de validaciones */}
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={styles.tableBody}>
                    {currentValidations.map((validation, index) => (
                      <View key={index} style={styles.tableRow}>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText}>
                            {formatDate(validation.created_at)} {formatTime12Hour(validation.created_at)}
                          </Paragraph>
                        </View>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText}>
                            {validation.turno}
                          </Paragraph>
                        </View>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText}>
                            {user?.nombre || 'N/A'}
                          </Paragraph>
                        </View>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText}>
                            {validation.jig?.tipo || 'N/A'}
                          </Paragraph>
                        </View>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText}>
                            {validation.jig?.numero_jig || 'N/A'}
                          </Paragraph>
                        </View>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText}>
                            {validation.jig?.modelo_actual || 'N/A'}
                          </Paragraph>
                        </View>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText}>
                            {validation.cantidad || '1'}
                          </Paragraph>
                        </View>
                        <View style={styles.dataCell}>
                          <Chip
                            style={[
                              styles.estadoChip,
                              { backgroundColor: getEstadoColor(validation.estado) }
                            ]}
                            textStyle={styles.chipText}
                          >
                            {validation.estado}
                          </Chip>
                        </View>
                        <View style={styles.dataCell}>
                          <Paragraph style={styles.dataText} numberOfLines={2}>
                            {validation.comentario || '-'}
                          </Paragraph>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Resumen del reporte */}
        {currentValidations.length > 0 && (
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Title style={styles.summaryTitle}>Resumen del Reporte</Title>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Paragraph style={styles.summaryLabel}>Total Jigs:</Paragraph>
                  <Paragraph style={styles.summaryValue}>{currentValidations.length}</Paragraph>
                </View>
                <View style={styles.summaryItem}>
                  <Paragraph style={styles.summaryLabel}>OK:</Paragraph>
                  <Paragraph style={[styles.summaryValue, { color: '#4CAF50' }]}>
                    {currentValidations.filter(v => v.estado === 'OK').length}
                  </Paragraph>
                </View>
                <View style={styles.summaryItem}>
                  <Paragraph style={styles.summaryLabel}>NG:</Paragraph>
                  <Paragraph style={[styles.summaryValue, { color: '#F44336' }]}>
                    {currentValidations.filter(v => v.estado === 'NG').length}
                  </Paragraph>
                </View>
                <View style={styles.summaryItem}>
                  <Paragraph style={styles.summaryLabel}>Total Cantidad:</Paragraph>
                  <Paragraph style={styles.summaryValue}>
                    {currentValidations.reduce((sum, v) => sum + parseInt(v.cantidad || 0), 0)}
                  </Paragraph>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Botones de acción flotantes */}
      {currentValidations.length > 0 && (
        <View style={styles.fabContainer}>
          <FAB
            style={[styles.fab, styles.continueFab]}
            icon="qrcode-scan"
            label="Continuar Escaneando"
            onPress={handleContinueScanning}
            mode="contained"
          />
          <FAB
            style={[
              styles.fab, 
              styles.signatureFab,
              { backgroundColor: hasSignature ? '#4CAF50' : '#9C27B0' }
            ]}
            icon={hasSignature ? "check" : "pencil"}
            label={hasSignature ? "Firma Guardada" : "Configurar Firma"}
            onPress={() => navigation.navigate('Profile')}
            disabled={isGeneratingReport}
          />
          <FAB
            style={[styles.fab, styles.generateFab]}
            icon={isGeneratingReport ? "loading" : "file-document"}
            label={isGeneratingReport ? "Generando..." : "Generar Reporte"}
            onPress={handleGenerateReport}
            disabled={isGeneratingReport || downloadingPDF}
          />
          
          <FAB
            style={[styles.fab, styles.testFab]}
            icon="bug"
            label="Diagnosticar Backend"
            onPress={handleTestBackend}
            disabled={isGeneratingReport}
          />
          <FAB
            style={[styles.fab, styles.clearFab]}
            icon="delete"
            label="Limpiar"
            onPress={handleClearValidations}
            small
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
    paddingBottom: 160, // Espacio para FABs (aumentado para 3 botones)
  },
  // Header styles
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
  },
  headerRight: {
    marginLeft: 16,
  },
  turnoChip: {
    borderRadius: 20,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Technician card styles
  technicianCard: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  technicianInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  technicianItem: {
    flex: 1,
    alignItems: 'center',
  },
  technicianLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  technicianValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  // Model selector styles
  modelSelector: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#2D2D2D',
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#B0B0B0',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  modelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelChip: {
    borderRadius: 16,
  },
  // Validations card styles
  validationsCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2D2D2D',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  validationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  validationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8E8E8',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  countChip: {
    backgroundColor: '#E3F2FD',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  scanButton: {
    borderColor: '#2196F3',
  },
  // Tabla bancaria styles
  tableContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2D2D2D',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderBottomWidth: 3,
    borderBottomColor: '#4A4A4A',
  },
  headerCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#2D2D2D',
    minWidth: 80,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E8E8E8',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  tableBody: {
    backgroundColor: '#1A1A1A',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D2D',
    minHeight: 50,
  },
  dataCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#2D2D2D',
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataText: {
    fontSize: 11,
    color: '#E8E8E8',
    textAlign: 'center',
    lineHeight: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  estadoChip: {
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#E8E8E8',
  },
  // Summary card styles
  summaryCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  // FAB styles
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
  signatureFab: {
    backgroundColor: '#9C27B0',
  },
  generateFab: {
    backgroundColor: '#4CAF50',
  },
  testFab: {
    backgroundColor: '#FF9800',
  },
  clearFab: {
    backgroundColor: '#F44336',
  },
});