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
  Platform,
} from 'react-native';
import { Card, Title, Paragraph, Chip, Button, IconButton, TextInput, FAB } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import auditoriaService from '../services/AuditoriaService';
import { useAuth } from '../contexts/AuthContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import logger from '../utils/logger';
import { API_BASE_URL } from '../utils/apiClient';

const isWeb = Platform.OS === 'web';

export default function AuditoriaScreen({ navigation }) {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState([]);
  const [filteredPdfs, setFilteredPdfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [downloadedPDFs, setDownloadedPDFs] = useState(new Set()); // Track downloaded PDFs
  const [aniosDisponibles, setAniosDisponibles] = useState(null); // Años disponibles desde el backend (null = no cargado, [] = sin PDFs)
  const [lineasDisponibles, setLineasDisponibles] = useState([]); // Líneas disponibles desde el backend
  const [tecnicos, setTecnicos] = useState([]); // Técnicos con reportes
  
  // Verificar si el usuario es adminAlex
  const isAdminAlex = user?.usuario === 'adminAlex';
  
  // Filtros
  const [filtroDia, setFiltroDia] = useState(null);
  const [filtroMes, setFiltroMes] = useState(null);
  const [filtroAnio, setFiltroAnio] = useState(null);
  const [filtroLinea, setFiltroLinea] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState(null);
  const [filtroTecnico, setFiltroTecnico] = useState(null);
  
  // Modales para seleccionar filtros
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [showMesModal, setShowMesModal] = useState(false);
  const [showAnioModal, setShowAnioModal] = useState(false);
  const [showLineaModal, setShowLineaModal] = useState(false);
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [showTecnicoModal, setShowTecnicoModal] = useState(false);

  // Cargar PDFs de auditoría
  const loadPDFs = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filtroDia) filters.dia = filtroDia;
      if (filtroMes) filters.mes = filtroMes;
      if (filtroAnio) filters.anio = filtroAnio;
      if (filtroLinea) filters.linea = filtroLinea;
      if (filtroTurno) filters.turno = filtroTurno;
      if (filtroTecnico) {
        filters.tecnico_id = filtroTecnico.id;
      }

      // Cargar todos los PDFs (todas las páginas automáticamente)
      const result = await auditoriaService.getAuditoriaPDFs(filters, true);
      
      if (result.success) {
        // El servicio ya maneja la paginación y devuelve todos los PDFs
        const pdfsData = Array.isArray(result.data) ? result.data : [];
        setPdfs(pdfsData);
        setFilteredPdfs(pdfsData);
        logger.info(`✅ ${pdfsData.length} PDFs cargados con los filtros aplicados`);
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
  }, [filtroDia, filtroMes, filtroAnio, filtroLinea, filtroTurno, filtroTecnico, navigation]);

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 10000);
      });

      const result = await Promise.race([
        auditoriaService.getStats(),
        timeoutPromise
      ]);
      
      if (result && result.success) {
        setStats(result.data);
        // Obtener años disponibles desde el backend
        if (result.data.anios_disponibles && Array.isArray(result.data.anios_disponibles)) {
          setAniosDisponibles(result.data.anios_disponibles);
          logger.info('📅 Años disponibles cargados:', result.data.anios_disponibles);
        } else {
          // Fallback: generar años si no vienen del backend
          const anioActual = new Date().getFullYear();
          const aniosFallback = Array.from({ length: 10 }, (_, i) => anioActual + i)
            .filter(anio => anio >= anioActual)
            .sort((a, b) => b - a);
          setAniosDisponibles(aniosFallback);
          logger.warn('⚠️ No se obtuvieron años del backend, usando fallback');
        }
        // Obtener líneas disponibles desde el backend
        if (result.data.lineas_disponibles && Array.isArray(result.data.lineas_disponibles)) {
          setLineasDisponibles(result.data.lineas_disponibles);
          logger.info('📋 Líneas disponibles cargadas:', result.data.lineas_disponibles);
        } else {
          setLineasDisponibles([]);
          logger.warn('⚠️ No se obtuvieron líneas del backend');
        }
      } else {
        if (result?.error === 'UNAUTHORIZED') {
          logger.warn('⚠️ Sesión expirada al cargar estadísticas');
        } else {
          logger.warn('⚠️ Error cargando estadísticas:', result?.message);
        }
        // Fallback: generar años si hay error
        const anioActual = new Date().getFullYear();
        const aniosFallback = Array.from({ length: 10 }, (_, i) => anioActual + i)
          .filter(anio => anio >= anioActual)
          .sort((a, b) => b - a);
        setAniosDisponibles(aniosFallback);
      }
    } catch (error) {
      logger.error('Error cargando estadísticas:', error);
      // Fallback: generar años si hay error
      const anioActual = new Date().getFullYear();
      const aniosFallback = Array.from({ length: 10 }, (_, i) => anioActual + i)
        .filter(anio => anio >= anioActual)
        .sort((a, b) => b - a);
      setAniosDisponibles(aniosFallback);
      // No mostrar alerta para estadísticas, es información secundaria
    }
  }, []);

  // Cargar técnicos con reportes
  const loadTecnicos = useCallback(async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 10000);
      });

      const result = await Promise.race([
        auditoriaService.getTecnicosConReportes(),
        timeoutPromise
      ]);
      
      if (result && result.success) {
        const tecnicosData = result.data.tecnicos || [];
        setTecnicos(tecnicosData);
        logger.info('👥 Técnicos cargados:', tecnicosData.length, 'técnicos');
        logger.info('👥 Lista de técnicos:', tecnicosData.map(t => t.nombre));
      } else {
        logger.warn('⚠️ Error cargando técnicos:', result?.message);
        setTecnicos([]);
      }
    } catch (error) {
      logger.error('❌ Error cargando técnicos:', error);
      setTecnicos([]);
    }
  }, []);

  // Verificar PDFs descargados al cargar
  const checkDownloadedPDFs = useCallback(async () => {
    // FileSystem no está disponible en web
    if (Platform.OS === 'web' || isWeb) {
      logger.info('ℹ️ [AuditoriaScreen] FileSystem no disponible en web, omitiendo verificación de PDFs descargados');
      return;
    }
    
    try {
      // Verificar que FileSystem esté disponible
      if (!FileSystem || !FileSystem.documentDirectory) {
        logger.warn('⚠️ [AuditoriaScreen] FileSystem no disponible');
        return;
      }
      
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
      // Solo loguear errores que no sean por falta de FileSystem en web
      if (error.message && !error.message.includes('not available on web')) {
        logger.error('Error verificando PDFs descargados:', error);
      } else {
        logger.debug('FileSystem no disponible en web (esperado)');
      }
    }
  }, [pdfs]);

  // Verificar si hay filtros activos
  // Nota: El año solo no cuenta como filtro activo (requiere otro filtro para evitar cargar demasiados PDFs)
  const hasActiveFilters = filtroDia || filtroMes || filtroLinea || filtroTurno || filtroTecnico || (filtroAnio && (filtroDia || filtroMes || filtroLinea || filtroTurno || filtroTecnico));

  // Cargar datos solo cuando hay filtros activos
  useFocusEffect(
    useCallback(() => {
      // Cargar estadísticas y técnicos
      loadStats();
      loadTecnicos();
    }, [loadStats, loadTecnicos])
  );

  // Cargar PDFs cuando cambian los filtros
  useEffect(() => {
    if (hasActiveFilters) {
      loadPDFs();
    } else {
      // Limpiar PDFs cuando no hay filtros activos
      setPdfs([]);
      setFilteredPdfs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDia, filtroMes, filtroAnio, filtroLinea, filtroTurno, filtroTecnico]);

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
                
                // Intentar eliminar el archivo local si existe (solo en móvil)
                if (!isWeb) {
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

  // Eliminar todos los PDFs (solo admin)
  const handleDeleteAllPDFs = useCallback(async () => {
    try {
      const isAdmin = user?.tipo_usuario === 'admin' || user?.usuario === 'admin' || user?.usuario === 'adminAlex' || user?.usuario === 'superadmin';
      
      if (!isAdmin) {
        Alert.alert('Acceso Denegado', 'Solo administradores pueden eliminar todos los PDFs');
        return;
      }

      // Usar stats?.total_pdfs en lugar de pdfs.length para obtener el total real del backend
      const totalPDFs = stats?.total_pdfs ?? 0;

      // Si no hay PDFs, no permitir borrar
      if (totalPDFs === 0) {
        Alert.alert(
          'Sin PDFs',
          'No hay PDFs de auditoría para eliminar.',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert(
        'ELIMINAR TODOS LOS PDFs',
        `¿Estás seguro de que quieres eliminar TODOS los PDFs de auditoría?\n\nEsta acción NO se puede deshacer.\n\nTotal de PDFs: ${totalPDFs}`,
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'ELIMINAR TODOS',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                logger.info('Eliminando TODOS los PDFs de auditoría...');
                
                // Timeout de seguridad para evitar que se quede cargando indefinidamente
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => {
                    reject(new Error('TIMEOUT'));
                  }, 125000); // 2 minutos + 5 segundos de margen
                });
                
                const result = await Promise.race([
                  auditoriaService.deleteAllPDFs(),
                  timeoutPromise
                ]);
                
                if (result && result.success) {
                  logger.info('Todos los PDFs eliminados');
                  
                  const deletedCount = result.data?.deleted_count || 0;
                  
                  // Limpiar la lista inmediatamente
                  setPdfs([]);
                  setFilteredPdfs([]);
                  setDownloadedPDFs(new Set());
                  
                  // Limpiar todos los filtros para evitar mostrar datos antiguos
                  setFiltroDia(null);
                  setFiltroMes(null);
                  setFiltroAnio(null);
                  setFiltroLinea(null);
                  setFiltroTurno(null);
                  setFiltroTecnico(null);
                  
                  // Recargar estadísticas y técnicos de forma segura (sin await para no bloquear)
                  if (loadStats && typeof loadStats === 'function') {
                    loadStats().catch(err => {
                      logger.error('Error en loadStats:', err);
                    });
                  }
                  if (loadTecnicos && typeof loadTecnicos === 'function') {
                    loadTecnicos().catch(err => {
                      logger.error('Error en loadTecnicos:', err);
                    });
                  }
                  
                  // Mostrar alerta solo si se eliminaron PDFs
                  if (deletedCount > 0) {
                    Alert.alert(
                      'Éxito',
                      `Se eliminaron ${deletedCount} PDFs correctamente.\n\nNota: Los nuevos reportes generados después de esta eliminación aparecerán normalmente.`,
                      [{ text: 'OK' }]
                    );
                  } else {
                    Alert.alert(
                      'Sin cambios',
                      'No había PDFs para eliminar.',
                      [{ text: 'OK' }]
                    );
                  }
                } else {
                  const errorMsg = result?.message || result?.error || 'Error al eliminar todos los PDFs';
                  
                  // Si es timeout, mostrar mensaje especial
                  if (result?.error === 'TIMEOUT') {
                    Alert.alert(
                      'Operación en progreso',
                      'La eliminación está tomando más tiempo del esperado. Los PDFs pueden estar eliminándose en segundo plano. Por favor, espera unos momentos y recarga la pantalla.',
                      [
                        {
                          text: 'Recargar ahora',
                          onPress: () => {
                            setPdfs([]);
                            setFilteredPdfs([]);
                            setDownloadedPDFs(new Set());
                            if (loadStats) {
                              loadStats();
                            }
                          }
                        },
                        { text: 'OK' }
                      ]
                    );
                  } else {
                    Alert.alert('Error', errorMsg);
                  }
                }
              } catch (error) {
                logger.error('Error eliminando todos los PDFs:', error);
                
                // Si es timeout, limpiar estado y mostrar mensaje
                if (error?.message === 'TIMEOUT' || error?.code === 'ECONNABORTED') {
                  Alert.alert(
                    'Tiempo de espera agotado',
                    'La operación está tomando más tiempo del esperado. Los PDFs pueden estar eliminándose en segundo plano. Por favor, espera unos momentos y recarga la pantalla.',
                    [
                      {
                        text: 'Recargar ahora',
                        onPress: () => {
                          setPdfs([]);
                          setFilteredPdfs([]);
                          setDownloadedPDFs(new Set());
                          if (loadStats) {
                            loadStats();
                          }
                        }
                      },
                      { text: 'OK' }
                    ]
                  );
                } else {
                  const errorMessage = error?.message || 'Error inesperado al eliminar todos los PDFs';
                  Alert.alert('Error', errorMessage);
                }
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Error en handleDeleteAllPDFs:', error);
      Alert.alert('Error', 'Error inesperado al intentar eliminar PDFs');
    }
  }, [user, stats, loadStats, loadTecnicos]);

  // Ver PDF descargado
  const handleViewPDF = async (fileUri, pdfId = null) => {
    try {
      // En web, descargar el PDF autenticado y abrirlo en una nueva pestaña
      if (Platform.OS === 'web' || isWeb) {
        if (pdfId) {
          try {
            // Descargar el PDF usando el servicio (que incluye autenticación)
            const result = await auditoriaService.downloadPDF(pdfId);
            if (result.success) {
              // Crear blob URL y abrirlo en nueva pestaña
              const blob = result.data;
              const url = window.URL.createObjectURL(blob);
              
              // Intentar abrir en nueva pestaña
              const newWindow = window.open(url, '_blank');
              
              // Si window.open fue bloqueado, mostrar el PDF en un iframe o descargarlo
              if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                // Fallback: crear un link y hacer click programáticamente
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Limpiar el URL después de un tiempo
                setTimeout(() => {
                  try {
                    window.URL.revokeObjectURL(url);
                  } catch (e) {
                    // Ignorar errores al revocar URL
                  }
                }, 100);
              } else {
                // Limpiar el URL cuando se cierre la ventana o después de un tiempo
                const cleanup = () => {
                  try {
                    window.URL.revokeObjectURL(url);
                  } catch (e) {
                    // Ignorar errores al revocar URL
                  }
                };
                
                // Intentar detectar cuando se cierra la ventana
                const checkClosed = setInterval(() => {
                  if (newWindow.closed) {
                    clearInterval(checkClosed);
                    cleanup();
                  }
                }, 1000);
                
                // Limpiar después de 5 minutos como respaldo
                setTimeout(() => {
                  clearInterval(checkClosed);
                  cleanup();
                }, 300000);
              }
              
              logger.info('✅ PDF abierto en nueva pestaña');
            } else {
              Alert.alert('Error', result.message || 'Error al obtener el PDF');
            }
          } catch (error) {
            logger.error('Error obteniendo PDF para ver:', error);
            Alert.alert('Error', 'Error al obtener el PDF');
          }
        } else {
          Alert.alert('Error', 'No se pudo obtener el ID del PDF');
        }
        return;
      }

      // En móvil, usar Sharing o Linking
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
      // En web, usar confirm y descargar directamente el blob
      if (Platform.OS === 'web' || isWeb) {
        if (window.confirm(`¿Deseas descargar el PDF: ${pdf.nombre_archivo}?`)) {
          try {
            const result = await auditoriaService.downloadPDF(pdf.id);
            if (result.success) {
              // Descargar directamente usando blob
              const blob = result.data;
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = pdf.nombre_archivo;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              // Marcar como descargado en web
              setDownloadedPDFs(prev => new Set([...prev, pdf.id]));
              
              // Mostrar opción de ver PDF
              if (window.confirm('PDF descargado exitosamente. ¿Deseas ver el PDF en una nueva pestaña?')) {
                handleViewPDF(null, pdf.id);
              }
              
              logger.info('✅ PDF descargado exitosamente en web:', pdf.nombre_archivo);
            } else {
              Alert.alert('Error', result.message || 'Error al descargar PDF');
            }
          } catch (error) {
            logger.error('Error descargando PDF:', error);
            Alert.alert('Error', 'Error al descargar PDF');
          }
        }
        return;
      }
      
      // En móvil, usar Alert.alert
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
                      
                      // Verificar que FileSystem esté disponible
                      if (!FileSystem || !FileSystem.documentDirectory) {
                        Alert.alert('Error', 'FileSystem no disponible');
                        return;
                      }
                      
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
    setFiltroLinea(null);
    setFiltroTurno(null);
    setFiltroTecnico(null);
  };
  
  // Determinar si un filtro debe estar habilitado según la jerarquía
  const isMesEnabled = filtroAnio !== null;
  const isDiaEnabled = filtroMes !== null && filtroAnio !== null;

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
              Turno {normalizeTurno(pdf.turno)}
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
                // En web, abrir directamente en nueva pestaña
                if (Platform.OS === 'web' || isWeb) {
                  handleViewPDF(null, pdf.id);
                  return;
                }
                
                // En móvil, verificar que FileSystem esté disponible
                if (!FileSystem || !FileSystem.documentDirectory) {
                  Alert.alert('Error', 'FileSystem no disponible');
                  return;
                }
                
                const auditoriaDir = FileSystem.documentDirectory + 'auditoria/';
                const fileUri = auditoriaDir + pdf.nombre_archivo;
                try {
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
                } catch (error) {
                  logger.error('Error verificando archivo:', error);
                  Alert.alert('Error', 'Error al verificar el archivo');
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

  // Normalizar turno: convertir "mañana", "noche", "fines" a "A", "B", "C"
  const normalizeTurno = (turno) => {
    if (!turno) return 'N/A';
    const turnoLower = turno.toLowerCase().trim();
    switch (turnoLower) {
      case 'mañana':
      case 'manana':
      case 'a':
        return 'A';
      case 'noche':
      case 'b':
        return 'B';
      case 'fines':
      case 'c':
        return 'C';
      default:
        // Si ya es A, B o C, retornarlo en mayúsculas
        if (turnoLower === 'a' || turnoLower === 'b' || turnoLower === 'c') {
          return turnoLower.toUpperCase();
        }
        return turno.toUpperCase();
    }
  };

  // Obtener color del turno
  const getTurnoColor = (turno) => {
    const normalizedTurno = normalizeTurno(turno);
    switch (normalizedTurno) {
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
  
  // Usar años disponibles del backend, o fallback solo si no se han cargado
  const anios = aniosDisponibles !== null 
    ? aniosDisponibles // Usar los años del backend (pueden ser array vacío si no hay PDFs)
    : (() => {
        // Fallback: generar años solo si aún no se han cargado del backend
        const anioActual = new Date().getFullYear();
        return Array.from({ length: 10 }, (_, i) => anioActual + i)
          .filter(anio => anio >= anioActual)
          .sort((a, b) => b - a);
      })();
  const turnos = ['A', 'B', 'C'];
  // Usar líneas disponibles del backend en lugar de lista hardcodeada
  const lineas = lineasDisponibles.length > 0 ? lineasDisponibles : [];

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
      {/* Filtros - Jerarquía mejorada */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {/* Filtros principales */}
          <TouchableOpacity
            style={[styles.filterButton, styles.filterButtonPrimary, filtroAnio && styles.filterButtonActive]}
            onPress={() => setShowAnioModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroAnio && styles.filterButtonTextActive]}>
              📅 Año {filtroAnio ? `(${filtroAnio})` : '*'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, styles.filterButtonPrimary, filtroTecnico && styles.filterButtonActive]}
            onPress={() => setShowTecnicoModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroTecnico && styles.filterButtonTextActive]}>
              👤 {filtroTecnico ? filtroTecnico.nombre.split(' ')[0] : 'Técnico'}
            </Text>
          </TouchableOpacity>
          
          {/* Filtros secundarios */}
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filtroMes && styles.filterButtonActive,
              !isMesEnabled && styles.filterButtonDisabled
            ]}
            onPress={() => isMesEnabled && setShowMesModal(true)}
            disabled={!isMesEnabled}
          >
            <Text style={[
              styles.filterButtonText, 
              filtroMes && styles.filterButtonTextActive,
              !isMesEnabled && styles.filterButtonTextDisabled
            ]}>
              Mes {filtroMes ? `(${meses.find(m => m.value === filtroMes)?.label})` : ''}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filtroDia && styles.filterButtonActive,
              !isDiaEnabled && styles.filterButtonDisabled
            ]}
            onPress={() => isDiaEnabled && setShowDiaModal(true)}
            disabled={!isDiaEnabled}
          >
            <Text style={[
              styles.filterButtonText, 
              filtroDia && styles.filterButtonTextActive,
              !isDiaEnabled && styles.filterButtonTextDisabled
            ]}>
              Día {filtroDia ? `(${filtroDia})` : ''}
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
          
          <TouchableOpacity
            style={[styles.filterButton, filtroTurno && styles.filterButtonActive]}
            onPress={() => setShowTurnoModal(true)}
          >
            <Text style={[styles.filterButtonText, filtroTurno && styles.filterButtonTextActive]}>
              Turno {filtroTurno ? `(${filtroTurno})` : ''}
            </Text>
          </TouchableOpacity>
          
          {(filtroDia || filtroMes || filtroAnio || filtroLinea || filtroTurno || filtroTecnico) && (
            <TouchableOpacity
              style={[styles.filterButton, styles.clearFilterButton]}
              onPress={clearFilters}
            >
              <Text style={styles.filterButtonText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
      
      {/* Estadísticas rápidas */}
      {hasActiveFilters && (
        <View style={styles.statsContainer}>
          <Card style={styles.statsCard}>
            <Card.Content>
              <Text style={styles.statsText}>
                📊 {filteredPdfs.length} {filteredPdfs.length === 1 ? 'reporte encontrado' : 'reportes encontrados'}
                {stats?.total_pdfs !== undefined && ` • Total en sistema: ${stats.total_pdfs}`}
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}

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
                <Text style={styles.infoListItem}>• <Text style={styles.infoListItemBold}>Año</Text> (selecciona primero, pero requiere otro filtro)</Text>
                <Text style={styles.infoListItem}>• <Text style={styles.infoListItemBold}>Técnico</Text> (quien generó el reporte)</Text>
                <Text style={styles.infoListItem}>• Mes (requiere año)</Text>
                <Text style={styles.infoListItem}>• Día (requiere mes y año)</Text>
                <Text style={styles.infoListItem}>• Línea (1-6) - opcional</Text>
                <Text style={styles.infoListItem}>• Turno (A, B, C) - opcional</Text>
              </View>
              <Paragraph style={[styles.infoText, { marginTop: 16, fontStyle: 'italic', color: '#FF9800' }]}>
                ⚠️ Nota: El año solo no mostrará resultados. Debes seleccionar al menos otro filtro (técnico, mes, día, línea o turno) para ver los PDFs.
              </Paragraph>
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
              {dias.map((dia, index) => {
                const isSelected = filtroDia === dia;
                return (
                  <TouchableOpacity
                    key={`dia-${dia}-${index}`}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      // Si el día ya está seleccionado, deseleccionarlo (toggle)
                      if (isSelected) {
                        setFiltroDia(null);
                      } else {
                        setFiltroDia(dia);
                      }
                      setShowDiaModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {dia}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
              {meses.map((mes, index) => {
                const isSelected = filtroMes === mes.value;
                return (
                  <TouchableOpacity
                    key={`mes-${mes.value}-${index}`}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      // Si el mes ya está seleccionado, deseleccionarlo (toggle)
                      if (isSelected) {
                        setFiltroMes(null);
                      } else {
                        setFiltroMes(mes.value);
                      }
                      setShowMesModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {mes.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
              {anios.length > 0 ? (
                anios.map((anio, index) => {
                  const isSelected = filtroAnio === anio;
                  return (
                    <TouchableOpacity
                      key={`anio-${anio}-${index}`}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        // Si el año ya está seleccionado, deseleccionarlo (toggle)
                        if (isSelected) {
                          setFiltroAnio(null);
                        } else {
                          setFiltroAnio(anio);
                        }
                        setShowAnioModal(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                        {anio} {stats?.por_anio?.[String(anio)] ? `(${stats.por_anio[String(anio)]} PDFs)` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : aniosDisponibles !== null ? (
                <Text style={styles.modalItemText}>No hay reportes disponibles</Text>
              ) : (
                <Text style={styles.modalItemText}>Cargando años disponibles...</Text>
              )}
            </ScrollView>
            <Button onPress={() => setShowAnioModal(false)}>Cerrar</Button>
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
              {lineas.map((linea, index) => {
                const isSelected = filtroLinea === linea;
                return (
                  <TouchableOpacity
                    key={`linea-${linea}-${index}`}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      // Si la línea ya está seleccionada, deseleccionarla (toggle)
                      if (isSelected) {
                        setFiltroLinea(null);
                      } else {
                        setFiltroLinea(linea);
                      }
                      setShowLineaModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {linea}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Button onPress={() => setShowLineaModal(false)}>Cerrar</Button>
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
              {turnos.map((turno, index) => {
                const isSelected = filtroTurno === turno;
                return (
                  <TouchableOpacity
                    key={`turno-${turno}-${index}`}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      // Si el turno ya está seleccionado, deseleccionarlo (toggle)
                      if (isSelected) {
                        setFiltroTurno(null);
                      } else {
                        setFiltroTurno(turno);
                      }
                      setShowTurnoModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      Turno {turno}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Button onPress={() => setShowTurnoModal(false)}>Cerrar</Button>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar técnico */}
      <Modal
        visible={showTecnicoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTecnicoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Seleccionar Técnico</Title>
            <ScrollView style={styles.modalList}>
              {tecnicos.length > 0 ? (
                tecnicos.map((tecnico, index) => {
                  const isSelected = filtroTecnico?.id === tecnico.id;
                  return (
                    <TouchableOpacity
                      key={`tecnico-${tecnico.id}-${index}`}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        // Si el técnico ya está seleccionado, deseleccionarlo (toggle)
                        if (isSelected) {
                          setFiltroTecnico(null);
                        } else {
                          setFiltroTecnico(tecnico);
                        }
                        setShowTecnicoModal(false);
                      }}
                    >
                      <View style={styles.modalItemContent}>
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                          {tecnico.nombre}
                        </Text>
                        <Text style={[styles.modalItemSubtext, isSelected && styles.modalItemSubtextSelected]}>
                          {tecnico.numero_empleado} • {tecnico.total_reportes} {tecnico.total_reportes === 1 ? 'reporte' : 'reportes'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.modalItemText}>No se encontraron técnicos</Text>
                  <Text style={[styles.modalItemText, { fontSize: 12, color: '#B0B0B0', marginTop: 8 }]}>
                    No hay técnicos con rol 'tecnico' o 'validaciones' activos
                  </Text>
                </View>
              )}
            </ScrollView>
            <Button onPress={() => setShowTecnicoModal(false)}>Cerrar</Button>
          </View>
        </View>
      </Modal>

      {/* Botón para eliminar todos los PDFs - Solo Admin */}
      {(user?.tipo_usuario === 'admin' || user?.usuario === 'admin' || user?.usuario === 'adminAlex' || user?.usuario === 'superadmin') && (
        <FAB
          icon="delete"
          style={styles.fabDeleteAll}
          onPress={() => {
            try {
              handleDeleteAllPDFs();
            } catch (error) {
              logger.error('Error al presionar botón eliminar todos:', error);
              Alert.alert('Error', 'Error inesperado al intentar eliminar PDFs');
            }
          }}
          label="Borrar Todos"
          color="#FFFFFF"
        />
      )}
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
  filterButtonPrimary: {
    backgroundColor: '#3C3C3C',
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  filterButtonDisabled: {
    opacity: 0.4,
    backgroundColor: '#1C1C1C',
  },
  filterButtonTextDisabled: {
    color: '#666666',
  },
  clearFilterButton: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  statsCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  statsText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  infoListItemBold: {
    fontWeight: 'bold',
    color: '#9C27B0',
  },
  searchInput: {
    marginBottom: 16,
    backgroundColor: '#2C2C2C',
  },
  modalItemContent: {
    flexDirection: 'column',
  },
  modalItemSubtext: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 4,
  },
  modalItemSubtextSelected: {
    color: '#E0E0E0',
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
  fabDeleteAll: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#F44336',
  },
});

