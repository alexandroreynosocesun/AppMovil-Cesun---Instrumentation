import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { Card, Title, Paragraph, Chip, Button, IconButton } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import auditoriaService from '../services/AuditoriaService';
import { useAuth } from '../contexts/AuthContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import logger from '../utils/logger';

export default function AuditoriaScreen({ navigation }) {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState([]);
  const [filteredPdfs, setFilteredPdfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [downloadedPDFs, setDownloadedPDFs] = useState(new Set()); // Track downloaded PDFs
  
  // Verificar si el usuario es adminAlex
  const isAdminAlex = user?.usuario === 'adminAlex';
  
  // Filtros
  const [filtroDia, setFiltroDia] = useState(null);
  const [filtroMes, setFiltroMes] = useState(null);
  const [filtroAnio, setFiltroAnio] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState(null);
  const [filtroLinea, setFiltroLinea] = useState(null);
  
  // Modales para seleccionar filtros
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [showMesModal, setShowMesModal] = useState(false);
  const [showAnioModal, setShowAnioModal] = useState(false);
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [showLineaModal, setShowLineaModal] = useState(false);

  // Cargar PDFs de auditoría
  const loadPDFs = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filtroDia) filters.dia = filtroDia;
      if (filtroMes) filters.mes = filtroMes;
      if (filtroAnio) filters.anio = filtroAnio;
      if (filtroTurno) filters.turno = filtroTurno;
      if (filtroLinea) filters.linea = filtroLinea;

      const result = await auditoriaService.getAuditoriaPDFs(filters);
      
      if (result.success) {
        // Manejar respuesta paginada o array directo
        const pdfsData = Array.isArray(result.data) ? result.data : (result.data?.items || []);
        setPdfs(pdfsData);
        setFilteredPdfs(pdfsData);
      } else {
        if (result.error === 'UNAUTHORIZED') {
          Alert.alert(
            'Sesión Expirada',
            result.message || 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
            [
              {
                text: 'Iniciar Sesión',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }
              }
            ]
          );
        } else {
          Alert.alert('Error', result.message || 'Error al cargar PDFs de auditoría');
        }
      }
    } catch (error) {
      logger.error('Error cargando PDFs:', error);
      if (error.response?.status === 401) {
        Alert.alert(
          'Sesión Expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          [
            {
              text: 'Iniciar Sesión',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Error inesperado al cargar PDFs');
      }
    } finally {
      setLoading(false);
    }
  }, [filtroDia, filtroMes, filtroAnio, filtroTurno, filtroLinea, navigation]);

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    try {
      const result = await auditoriaService.getStats();
      if (result.success) {
        setStats(result.data);
      } else {
        if (result.error === 'UNAUTHORIZED') {
          logger.warn('⚠️ Sesión expirada al cargar estadísticas');
          // No mostrar alerta aquí para no interrumpir la experiencia del usuario
          // El error ya se manejará en loadPDFs si es necesario
        } else {
          logger.warn('⚠️ Error cargando estadísticas:', result.message);
        }
      }
    } catch (error) {
      logger.error('Error cargando estadísticas:', error);
      // No mostrar alerta para estadísticas, es información secundaria
    }
  }, []);

  // Verificar PDFs descargados al cargar
  const checkDownloadedPDFs = useCallback(async () => {
    try {
      const auditoriaDir = FileSystem.documentDirectory + 'auditoria/';
      const dirInfo = await FileSystem.getInfoAsync(auditoriaDir);
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(auditoriaDir);
        const downloadedIds = new Set();
        // Mapear nombres de archivo a IDs de PDF
        for (const pdf of pdfs) {
          if (files.includes(pdf.nombre_archivo)) {
            downloadedIds.add(pdf.id);
          }
        }
        setDownloadedPDFs(downloadedIds);
      }
    } catch (error) {
      logger.error('Error verificando PDFs descargados:', error);
    }
  }, [pdfs]);

  // Verificar si hay filtros activos
  const hasActiveFilters = filtroDia || filtroMes || filtroAnio || filtroTurno || filtroLinea;

  // Cargar datos solo cuando hay filtros activos
  useFocusEffect(
    useCallback(() => {
      // Solo cargar estadísticas, no PDFs
      loadStats();
    }, [loadStats])
  );

  // Cargar PDFs cuando cambian los filtros
  useEffect(() => {
    if (hasActiveFilters) {
      loadPDFs();
    } else {
      // Limpiar PDFs cuando no hay filtros
      setPdfs([]);
      setFilteredPdfs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDia, filtroMes, filtroAnio, filtroTurno, filtroLinea]);

  // Verificar PDFs descargados cuando cambian los PDFs
  useEffect(() => {
    if (pdfs.length > 0) {
      checkDownloadedPDFs();
    }
  }, [pdfs, checkDownloadedPDFs]);

  // Eliminar PDF (solo adminAlex)
  const handleDeletePDF = async (pdf) => {
    if (!isAdminAlex) {
      Alert.alert('Acceso Denegado', 'Solo el administrador puede eliminar PDFs');
      return;
    }

    Alert.alert(
      'Eliminar PDF',
      `¿Estás seguro de que deseas eliminar el PDF: ${pdf.nombre_archivo}?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await auditoriaService.deletePDF(pdf.id);
              if (result.success) {
                // Eliminar de la lista local
                setPdfs(prev => prev.filter(p => p.id !== pdf.id));
                setFilteredPdfs(prev => prev.filter(p => p.id !== pdf.id));
                
                // Eliminar del set de descargados si estaba
                setDownloadedPDFs(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(pdf.id);
                  return newSet;
                });
                
                // Intentar eliminar el archivo local si existe
                try {
                  const auditoriaDir = FileSystem.documentDirectory + 'auditoria/';
                  const fileUri = auditoriaDir + pdf.nombre_archivo;
                  const fileInfo = await FileSystem.getInfoAsync(fileUri);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(fileUri);
                  }
                } catch (fsError) {
                  logger.error('Error eliminando archivo local:', fsError);
                }
                
                Alert.alert('Éxito', 'PDF eliminado correctamente');
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar PDF');
              }
            } catch (error) {
              logger.error('Error eliminando PDF:', error);
              Alert.alert('Error', 'Error al eliminar PDF');
            }
          }
        }
      ]
    );
  };

  // Ver PDF descargado
  const handleViewPDF = async (fileUri) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Abrir PDF'
        });
      } else {
        // Intentar abrir con Linking si Sharing no está disponible
        const canOpen = await Linking.canOpenURL(fileUri);
        if (canOpen) {
          await Linking.openURL(fileUri);
        } else {
          Alert.alert('Error', 'No se pudo abrir el PDF. El archivo está guardado en: ' + fileUri);
        }
      }
    } catch (error) {
      logger.error('Error abriendo PDF:', error);
      Alert.alert('Error', 'No se pudo abrir el PDF');
    }
  };

  // Descargar PDF
  const handleDownloadPDF = async (pdf) => {
    try {
      Alert.alert(
        'Descargar PDF',
        `¿Deseas descargar el PDF: ${pdf.nombre_archivo}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Descargar',
            onPress: async () => {
              try {
                const result = await auditoriaService.downloadPDF(pdf.id);
                if (result.success) {
                  // Convertir blob a base64 y guardar
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    try {
                      const base64data = reader.result.split(',')[1];
                      
                      // Crear carpeta "auditoria" si no existe
                      const auditoriaDir = FileSystem.documentDirectory + 'auditoria/';
                      const dirInfo = await FileSystem.getInfoAsync(auditoriaDir);
                      if (!dirInfo.exists) {
                        await FileSystem.makeDirectoryAsync(auditoriaDir, { intermediates: true });
                      }
                      
                      // Guardar PDF en la carpeta auditoria
                      const fileUri = auditoriaDir + pdf.nombre_archivo;
                      await FileSystem.writeAsStringAsync(fileUri, base64data, {
                        encoding: FileSystem.EncodingType.Base64,
                      });
                      
                      // Marcar como descargado
                      setDownloadedPDFs(prev => new Set([...prev, pdf.id]));
                      
                      // Mostrar alert con opción de ver PDF
                      Alert.alert(
                        'PDF Descargado',
                        `PDF guardado exitosamente: ${pdf.nombre_archivo}`,
                        [
                          { text: 'OK', style: 'default' },
                          {
                            text: 'Ver PDF',
                            onPress: () => handleViewPDF(fileUri)
                          }
                        ]
                      );
                    } catch (fsError) {
                      logger.error('Error guardando archivo:', fsError);
                      Alert.alert('Error', 'Error al guardar el PDF');
                    }
                  };
                  reader.readAsDataURL(result.data);
                } else {
                  Alert.alert('Error', result.message || 'Error al descargar PDF');
                }
              } catch (error) {
                logger.error('Error descargando PDF:', error);
                Alert.alert('Error', 'Error al descargar PDF');
              }
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Error:', error);
      Alert.alert('Error', 'Error inesperado');
    }
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFiltroDia(null);
    setFiltroMes(null);
    setFiltroAnio(null);
    setFiltroTurno(null);
    setFiltroLinea(null);
  };

  // Renderizar tarjeta de PDF
  const renderPDFCard = ({ item: pdf }) => (
    <Card style={styles.pdfCard}>
      <Card.Content>
        <View style={styles.pdfCardHeader}>
          <View style={styles.pdfCardHeaderLeft}>
            <Title style={styles.pdfTitle}>{pdf.modelo || 'Sin modelo'}</Title>
            <Chip 
              style={[styles.turnoChip, { backgroundColor: getTurnoColor(pdf.turno) }]}
              textStyle={styles.turnoChipText}
            >
              Turno {pdf.turno}
            </Chip>
          </View>
        </View>
        
        <View style={styles.pdfCardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Técnico:</Text>
            <Text style={styles.detailValue}>{pdf.tecnico_nombre}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>No. Empleado:</Text>
            <Text style={styles.detailValue}>{pdf.numero_empleado}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fecha:</Text>
            <Text style={styles.detailValue}>
              {new Date(pdf.fecha).toLocaleDateString('es-ES')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Línea:</Text>
            <Text style={styles.detailValue}>{pdf.linea || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Validaciones:</Text>
            <Text style={styles.detailValue}>{pdf.cantidad_validaciones}</Text>
          </View>
        </View>
        
        <View style={styles.pdfCardActions}>
          <Button
            mode="contained"
            onPress={() => handleDownloadPDF(pdf)}
            style={styles.downloadButton}
            icon="download"
          >
            Descargar PDF
          </Button>
          {/* Botón para ver PDF solo si ya está descargado */}
          {downloadedPDFs.has(pdf.id) && (
            <Button
              mode="outlined"
              onPress={async () => {
                const auditoriaDir = FileSystem.documentDirectory + 'auditoria/';
                const fileUri = auditoriaDir + pdf.nombre_archivo;
                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (fileInfo.exists) {
                  handleViewPDF(fileUri);
                } else {
                  // Si el archivo no existe, remover del set
                  setDownloadedPDFs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(pdf.id);
                    return newSet;
                  });
                  Alert.alert('PDF no encontrado', 'El PDF no está descargado. Por favor, descárgalo primero.');
                }
              }}
              style={styles.viewButton}
              icon="file-document-outline"
            >
              Ver PDF
            </Button>
          )}
          {/* Botón de eliminar solo para adminAlex */}
          {isAdminAlex && (
            <Button
              mode="outlined"
              onPress={() => handleDeletePDF(pdf)}
              style={styles.deleteButton}
              icon="delete"
              textColor="#F44336"
            >
              Eliminar
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  // Obtener color del turno
  const getTurnoColor = (turno) => {
    switch (turno?.toUpperCase()) {
      case 'A': return '#2196F3';
      case 'B': return '#4CAF50';
      case 'C': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  // Generar opciones para filtros
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);
  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];
  
  // Obtener años únicos de los PDFs
  const anioActual = new Date().getFullYear();
  // Generar años desde el actual hasta 2035 (10 años)
  const anios = Array.from({ length: 10 }, (_, i) => anioActual + i)
    .filter(anio => anio >= anioActual)
    .sort((a, b) => a - b);
  const turnos = ['A', 'B', 'C'];
  const lineas = ['1', '2', '3', '4', '5', '6'];

  if (loading && !pdfs.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Cargando auditoría...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <TouchableOpacity
            style={[styles.filterButton, filtroDia && styles.filterButtonActive]}
            onPress={() => setShowDiaModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroDia && styles.filterButtonTextActive]}>
              Día {filtroDia ? `(${filtroDia})` : ''}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filtroMes && styles.filterButtonActive]}
            onPress={() => setShowMesModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroMes && styles.filterButtonTextActive]}>
              Mes {filtroMes ? `(${meses.find(m => m.value === filtroMes)?.label})` : ''}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filtroAnio && styles.filterButtonActive]}
            onPress={() => setShowAnioModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroAnio && styles.filterButtonTextActive]}>
              Año {filtroAnio ? `(${filtroAnio})` : ''}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filtroTurno && styles.filterButtonActive]}
            onPress={() => setShowTurnoModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroTurno && styles.filterButtonTextActive]}>
              Turno {filtroTurno ? `(${filtroTurno})` : ''}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filtroLinea && styles.filterButtonActive]}
            onPress={() => setShowLineaModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroLinea && styles.filterButtonTextActive]}>
              Línea {filtroLinea ? `(${filtroLinea})` : ''}
            </Text>
          </TouchableOpacity>
          
          {(filtroDia || filtroMes || filtroAnio || filtroTurno || filtroLinea) && (
            <TouchableOpacity
              style={[styles.filterButton, styles.clearFilterButton]}
              onPress={clearFilters}
            >
              <Text style={styles.filterButtonText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Mostrar información cuando no hay filtros */}
      {!hasActiveFilters ? (
        <View style={styles.infoContainer}>
          <Card style={styles.infoCard}>
            <Card.Content>
              <Title style={styles.infoTitle}>📋 Búsqueda de Reportes de Auditoría</Title>
              <Paragraph style={styles.infoText}>
                Utiliza los filtros de arriba para buscar reportes de auditoría.
              </Paragraph>
              <Paragraph style={styles.infoText}>
                Puedes filtrar por:
              </Paragraph>
              <View style={styles.infoList}>
                <Text style={styles.infoListItem}>• Día del mes</Text>
                <Text style={styles.infoListItem}>• Mes</Text>
                <Text style={styles.infoListItem}>• Año</Text>
                <Text style={styles.infoListItem}>• Turno (A, B, C)</Text>
                <Text style={styles.infoListItem}>• Línea de producción</Text>
              </View>
              <Paragraph style={[styles.infoText, { marginTop: 16, fontStyle: 'italic' }]}>
                Selecciona uno o más filtros para comenzar la búsqueda.
              </Paragraph>
            </Card.Content>
          </Card>
        </View>
      ) : (
        /* Lista de PDFs - Solo se muestra cuando hay filtros activos */
        <FlatList
          data={filteredPdfs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPDFCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadPDFs}
              colors={['#9C27B0']}
              tintColor="#9C27B0"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No se encontraron PDFs</Text>
              <Text style={styles.emptyStateSubtitle}>
                No hay PDFs que coincidan con los filtros aplicados.
              </Text>
              <Button
                mode="outlined"
                onPress={clearFilters}
                style={{ marginTop: 16 }}
              >
                Limpiar Filtros
              </Button>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal para seleccionar día */}
      <Modal
        visible={showDiaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDiaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Seleccionar Día</Title>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFiltroDia(null);
                  setShowDiaModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Todos</Text>
              </TouchableOpacity>
              {dias.map((dia) => (
                <TouchableOpacity
                  key={dia}
                  style={[styles.modalItem, filtroDia === dia && styles.modalItemSelected]}
                  onPress={() => {
                    setFiltroDia(dia);
                    setShowDiaModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, filtroDia === dia && styles.modalItemTextSelected]}>
                    {dia}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button onPress={() => setShowDiaModal(false)}>Cerrar</Button>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar mes */}
      <Modal
        visible={showMesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Seleccionar Mes</Title>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFiltroMes(null);
                  setShowMesModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Todos</Text>
              </TouchableOpacity>
              {meses.map((mes) => (
                <TouchableOpacity
                  key={mes.value}
                  style={[styles.modalItem, filtroMes === mes.value && styles.modalItemSelected]}
                  onPress={() => {
                    setFiltroMes(mes.value);
                    setShowMesModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, filtroMes === mes.value && styles.modalItemTextSelected]}>
                    {mes.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button onPress={() => setShowMesModal(false)}>Cerrar</Button>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar año */}
      <Modal
        visible={showAnioModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAnioModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Seleccionar Año</Title>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFiltroAnio(null);
                  setShowAnioModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Todos</Text>
              </TouchableOpacity>
              {anios.length > 0 ? (
                anios.map((anio) => (
                  <TouchableOpacity
                    key={anio}
                    style={[styles.modalItem, filtroAnio === anio && styles.modalItemSelected]}
                    onPress={() => {
                      setFiltroAnio(anio);
                      setShowAnioModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, filtroAnio === anio && styles.modalItemTextSelected]}>
                      {anio}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.modalItemText}>No hay años disponibles</Text>
              )}
            </ScrollView>
            <Button onPress={() => setShowAnioModal(false)}>Cerrar</Button>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar turno */}
      <Modal
        visible={showTurnoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTurnoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Seleccionar Turno</Title>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFiltroTurno(null);
                  setShowTurnoModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Todos</Text>
              </TouchableOpacity>
              {turnos.map((turno) => (
                <TouchableOpacity
                  key={turno}
                  style={[styles.modalItem, filtroTurno === turno && styles.modalItemSelected]}
                  onPress={() => {
                    setFiltroTurno(turno);
                    setShowTurnoModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, filtroTurno === turno && styles.modalItemTextSelected]}>
                    Turno {turno}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button onPress={() => setShowTurnoModal(false)}>Cerrar</Button>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar línea */}
      <Modal
        visible={showLineaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLineaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Seleccionar Línea</Title>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFiltroLinea(null);
                  setShowLineaModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Todas</Text>
              </TouchableOpacity>
              {lineas.map((linea) => (
                <TouchableOpacity
                  key={linea}
                  style={[styles.modalItem, filtroLinea === linea && styles.modalItemSelected]}
                  onPress={() => {
                    setFiltroLinea(linea);
                    setShowLineaModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, filtroLinea === linea && styles.modalItemTextSelected]}>
                    {linea}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button onPress={() => setShowLineaModal(false)}>Cerrar</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#E0E0E0',
    marginTop: 16,
    fontSize: 16,
  },
  filtersContainer: {
    backgroundColor: '#1E1E1E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2C2C2C',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#444444',
  },
  filterButtonActive: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  filterButtonText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  clearFilterButton: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  pdfCard: {
    backgroundColor: '#1E1E1E',
    elevation: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  pdfCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  pdfCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pdfTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  turnoChip: {
    height: 28,
  },
  turnoChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  pdfCardDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    color: '#E0E0E0',
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  pdfCardActions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: '#9C27B0',
    flex: 1,
  },
  viewButton: {
    borderColor: '#2196F3',
    flex: 1,
  },
  deleteButton: {
    borderColor: '#F44336',
    flex: 1,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    elevation: 4,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoText: {
    color: '#E0E0E0',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  infoList: {
    marginLeft: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  infoListItem: {
    color: '#E0E0E0',
    fontSize: 16,
    lineHeight: 28,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: '#E0E0E0',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    color: '#B0B0B0',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    margin: 16,
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#2C2C2C',
  },
  modalItemSelected: {
    backgroundColor: '#9C27B0',
  },
  modalItemText: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  modalItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
