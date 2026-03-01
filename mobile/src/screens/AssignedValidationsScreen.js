import React, { useEffect, useState } from 'react';
import { showAlert } from '../utils/alertUtils';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  Divider,
  Chip,
  Text,
  Button,
  IconButton,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { validationService } from '../services/ValidationService';
import DateTimePicker from '@react-native-community/datetimepicker';
import logger from '../utils/logger';

export default function AssignedValidationsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allValidations, setAllValidations] = useState([]);
  const [filteredValidations, setFilteredValidations] = useState([]);
  // Filtros de fecha removidos - solo se muestran todas las validaciones
  const [dateFilter, setDateFilter] = useState('all'); // Siempre 'all' - no hay filtros de fecha
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending' (solo dos opciones)

  // Función para determinar el turno actual según la hora
  const getCurrentTurno = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Turno A: 6:30 AM - 6:30 PM
    // Turno B: 6:30 PM - 6:30 AM (cruza medianoche)
    
    if (currentHour > 18 || (currentHour === 18 && currentMinute >= 30)) {
      // Después de 6:30 PM hasta antes de medianoche → Turno B
      return 'B';
    } else if (currentHour < 6 || (currentHour === 6 && currentMinute < 30)) {
      // Después de medianoche hasta antes de 6:30 AM → Turno B (sigue siendo el turno que empezó ayer)
      return 'B';
    } else {
      // Entre 6:30 AM y 6:30 PM → Turno A
      return 'A';
    }
  };

  // Función para obtener la fecha de "hoy" según el turno actual
  const getTodayDate = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const turno = getCurrentTurno();
    
    if (turno === 'A') {
      // Turno A: 6:30 AM - 6:30 PM
      // Solo mostrar validaciones cuando realmente esté en el turno A
      // Si es antes de las 6:30 AM, no mostrar nada de "hoy" (aún no ha empezado el turno)
      // Si es después de las 6:30 PM, "hoy" es mañana (el turno del día siguiente)
      if (currentHour < 6 || (currentHour === 6 && currentMinute < 30)) {
        // Antes de 6:30 AM, el turno A aún no ha empezado
        // Devolver una fecha muy lejana para que no coincida con nada
        const farFuture = new Date(now);
        farFuture.setDate(farFuture.getDate() + 365);
        return farFuture;
      } else if (currentHour > 18 || (currentHour === 18 && currentMinute >= 30)) {
        // Después de 6:30 PM, "hoy" es mañana (turno A del día siguiente)
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      } else {
        // Entre 6:30 AM y 6:30 PM, "hoy" es hoy
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    } else {
      // Turno B: 6:30 PM - 6:30 AM (cruza medianoche)
      // Siempre devolver "hoy" porque las validaciones creadas después de medianoche tienen fecha de hoy
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  };

  // Función para obtener la fecha de "ayer" según el turno actual
  const getYesterdayDate = () => {
    const today = getTodayDate();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  };

  // Función para normalizar fecha (solo año, mes, día)
  const normalizeDate = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Función para filtrar validaciones por fecha y estado
  const filterValidations = (validations, filterType, customDate = null, statusFilterType = 'all') => {
    let targetDate = null;
    
    switch (filterType) {
      case 'all':
        // No filtrar por fecha, mostrar todas
        targetDate = null;
        break;
      case 'today':
        targetDate = getTodayDate();
        break;
      case 'yesterday':
        targetDate = getYesterdayDate();
        break;
      case 'custom':
        targetDate = customDate ? normalizeDate(customDate) : getTodayDate();
        break;
      default:
        targetDate = null; // Por defecto mostrar todas
    }

    let filtered = validations;
    
    // Solo filtrar por fecha si se especificó un filtro de fecha
    if (targetDate !== null) {
      const turno = getCurrentTurno();
      logger.info('🔍 Filtro - Tipo:', filterType, 'Turno:', turno);
      logger.info('🔍 Filtro - Fecha objetivo:', targetDate.toISOString().split('T')[0]);
      logger.info('🔍 Filtro - Total validaciones:', validations.length);

      filtered = validations.filter(v => {
        if (!v.fecha) {
          logger.debug(`⚠️ [filterValidations] Validación ${v.id} sin fecha, excluyendo del filtro de fecha`);
          return false;
        }
        
        const validationDate = normalizeDate(new Date(v.fecha));
        const targetTime = targetDate.getTime();
        const validationTime = validationDate.getTime();
        
        // Si estamos en turno B y el filtro es "today", también incluir validaciones de ayer
        // (porque el turno B cruza medianoche)
        if (filterType === 'today' && turno === 'B') {
          const yesterday = new Date(targetDate);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayTime = yesterday.getTime();
          
          return validationTime === targetTime || validationTime === yesterdayTime;
        }
        
        const matches = validationTime === targetTime;
        if (!matches) {
          logger.debug(`⚠️ [filterValidations] Validación ${v.id} fecha ${validationDate.toISOString()} no coincide con ${targetDate.toISOString()}`);
        }
        return matches;
      });
      
      logger.info('🔍 Filtro - Validaciones filtradas por fecha:', filtered.length);
    }

    // Aplicar filtro de estado (solo 'pending' o 'all')
    if (statusFilterType === 'pending') {
      filtered = filtered.filter(v => !v.completada);
    }
    // No hay filtro 'completed' - solo se muestran Todas o Pendientes

    logger.info(`🔍 [filterValidations] Validaciones después de filtros: ${filtered.length}`);
    return filtered;
  };

  const loadValidations = async () => {
    try {
      setLoading(true);
      logger.info('🔄 [AssignedValidationsScreen] Cargando validaciones asignadas...');
      logger.info(`🔄 [AssignedValidationsScreen] Usuario: ${user?.usuario} (ID: ${user?.id}), tipo: ${user?.tipo_usuario}`);
      
      const result = await validationService.getValidations();

      if (result.success) {
        // Manejar respuesta paginada o array directo
        let all = [];
        if (result.data) {
          if (Array.isArray(result.data)) {
            all = result.data;
            logger.info('✅ [AssignedValidationsScreen] Data es un array directo');
          } else if (result.data.items && Array.isArray(result.data.items)) {
            all = result.data.items;
            logger.info('✅ [AssignedValidationsScreen] Data es un objeto paginado, extrayendo items');
          } else {
            logger.warn('⚠️ [AssignedValidationsScreen] Formato de datos inesperado:', result.data);
            all = [];
          }
        }
        
        logger.info(`📊 [AssignedValidationsScreen] Total de validaciones recibidas: ${all.length}`);
        
        // Para técnicos: solo mostrar las validaciones asignadas a este usuario
        const mine = all.filter(v => {
          const matches = v.tecnico_asignado_id === user?.id;
          if (!matches) {
            logger.debug(`❌ [AssignedValidationsScreen] Excluyendo validación ${v.id}: tecnico_asignado_id=${v.tecnico_asignado_id} !== user.id=${user?.id}`);
          }
          return matches;
        });
        
        logger.info(`✅ [AssignedValidationsScreen] Validaciones asignadas a este usuario: ${mine.length}`);
        logger.info(`📋 [AssignedValidationsScreen] Detalles:`);
        mine.forEach(v => {
          logger.info(`  - ID: ${v.id}, Modelo: ${v.modelo_actual || 'N/A'}, Completada: ${v.completada}, Técnico asignado: ${v.tecnico_asignado_id}`);
        });
        
        setAllValidations(mine);
        
        // Aplicar filtros de fecha y estado
        const filtered = filterValidations(mine, dateFilter, selectedDate, statusFilter);
        logger.info(`🔍 [AssignedValidationsScreen] Validaciones después de filtros: ${filtered.length}`);
        setFilteredValidations(filtered);
      } else {
        logger.error('Error cargando validaciones asignadas:', result.error);
        
        // Manejar error 401 (sesión expirada)
        if (result.error === 'UNAUTHORIZED' || result.error === 401) {
          showAlert(
            '🔐 Sesión Expirada',
            result.message || 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
            [
              { 
                text: 'Iniciar Sesión', 
                onPress: async () => {
                  await logout();
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      logger.error('Error obteniendo validaciones:', error);
      
      // Manejar error 401 en el catch también
      if (error.response?.status === 401) {
        showAlert(
          '🔐 Sesión Expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          [
            { 
              text: 'Iniciar Sesión', 
              onPress: async () => {
                await logout();
              }
            }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.tipo_usuario === 'tecnico' || user.tipo_usuario === 'validaciones' || user.tipo_usuario === 'validacion')) {
      loadValidations();
    }
  }, [user]);

  // Efecto para aplicar filtros cuando cambian dateFilter, selectedDate o statusFilter
  useEffect(() => {
    if (allValidations.length > 0) {
      const filtered = filterValidations(allValidations, dateFilter, selectedDate, statusFilter);
      setFilteredValidations(filtered);
    }
  }, [dateFilter, selectedDate, statusFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadValidations();
    setRefreshing(false);
  };

  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
    if (filter === 'custom') {
      setShowDatePicker(true);
    }
  };

  const handleDatePickerChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      setDateFilter('custom');
    }
  };

  const parseComentario = (comentario) => {
    if (!comentario) return {};
    const parts = comentario.split('|').map(p => p.trim());
    const result = {};
    parts.forEach(part => {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) return;
      const key = part.substring(0, colonIdx).trim().toLowerCase();
      const value = part.substring(colonIdx + 1).trim();
      if (key === 'modelo') result.modeloCompleto = value;
      else if (key === 'línea' || key === 'linea') result.linea = value;
      else if (key === 'emulador de panel') result.emuladorPanel = value;
      else if (key === 'convertidores') result.convertidores = value;
    });
    if (result.modeloCompleto) {
      const match = result.modeloCompleto.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) { result.modelo = match[1].trim(); result.tipoLabel = match[2].trim(); }
      else { result.modelo = result.modeloCompleto; result.tipoLabel = ''; }
    }
    return result;
  };

  const tipoLabelToType = (tipoLabel) => {
    const lower = tipoLabel?.toLowerCase() || '';
    if (lower.includes('new semi') || lower.includes('nuevo semi')) return 'new semiautomatic';
    if (lower.includes('semi')) return 'semiautomatic';
    return 'manual';
  };

  const handleValidar = (v) => {
    const parsed = parseComentario(v.comentario);
    const modelName = parsed.modelo || v.modelo_actual;
    const tipoType = tipoLabelToType(parsed.tipoLabel || v.tipo_jig);
    navigation.navigate('AllJigs', { model: modelName, type: tipoType, validationModeReturn: true });
  };

  const handleMarcarCompletada = async (validationId) => {
    showAlert(
      'Marcar como Completada',
      '¿Estás seguro de que quieres marcar esta validación como completada?',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Marcar Completada',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await validationService.marcarCompletada(validationId);
              
              if (result.success) {
                // Actualizar el estado local
                const updated = allValidations.map(v => 
                  v.id === validationId 
                    ? { ...v, completada: true }
                    : v
                );
                setAllValidations(updated);
                
                // Re-aplicar filtros después de actualizar
                const filtered = filterValidations(updated, dateFilter, selectedDate, statusFilter);
                setFilteredValidations(filtered);
                
                // Verificar si quedan validaciones pendientes (no completadas)
                const pendingValidations = updated.filter(v => 
                  v.tecnico_asignado_id === user?.id && !v.completada
                );
                
                logger.info(`🔍 [AssignedValidationsScreen] Validaciones pendientes después de completar: ${pendingValidations.length}`);
                
                if (pendingValidations.length === 0) {
                  // No hay más validaciones pendientes, regresar a Home
                  logger.info('✅ [AssignedValidationsScreen] No hay más validaciones pendientes, regresando a Home');
                  showAlert(
                    '✅ Completada',
                    'La validación ha sido marcada como completada exitosamente.\n\nNo hay más validaciones pendientes.',
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
                  // Aún hay validaciones pendientes
                  showAlert(
                    '✅ Completada',
                    'La validación ha sido marcada como completada exitosamente.'
                  );
                }
              } else {
                showAlert(
                  'Error',
                  result.error || 'No se pudo marcar la validación como completada. Intenta nuevamente.'
                );
              }
            } catch (error) {
              logger.error('Error marcando validación como completada:', error);
              showAlert(
                'Error',
                'Ocurrió un error al marcar la validación como completada. Intenta nuevamente.'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (user?.tipo_usuario !== 'tecnico' && user?.tipo_usuario !== 'validaciones') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Esta pantalla solo está disponible para usuarios con rol de Validaciones.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A1A1A', '#2C2C2C', '#1A1A1A']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={styles.title}>Validaciones Asignadas</Title>
            <Paragraph style={styles.subtitle}>
              Validaciones que tienes pendientes de validar
            </Paragraph>
          </Card.Content>
        </Card>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Paragraph style={styles.loadingText}>Cargando validaciones...</Paragraph>
          </View>
        )}

        {/* Filtros de Estado - Solo Todas y Pendientes */}
        <Card style={styles.filterCard}>
          <Card.Content>
            {/* Filtros de Estado */}
            <View style={styles.statusFilterContainer}>
              <TouchableOpacity
                style={[
                  styles.statusFilterButton,
                  statusFilter === 'all' && styles.statusFilterButtonActive
                ]}
                onPress={() => setStatusFilter('all')}
              >
                <Text style={[
                  styles.statusFilterButtonText,
                  statusFilter === 'all' && styles.statusFilterButtonTextActive
                ]}>
                  Todas
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusFilterButton,
                  statusFilter === 'pending' && styles.statusFilterButtonActive
                ]}
                onPress={() => setStatusFilter('pending')}
              >
                <Text style={[
                  styles.statusFilterButtonText,
                  statusFilter === 'pending' && styles.statusFilterButtonTextActive
                ]}>
                  Pendiente
                </Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Date Picker Modal - Removido ya que no hay filtros de fecha */}
        {false && showDatePicker && (
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerModal}>
              <TouchableOpacity
                style={styles.datePickerModalOverlay}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              />
            </View>
          </Modal>
        )}

        {!loading && filteredValidations.length === 0 && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>
                {allValidations.length === 0 
                  ? 'No tienes validaciones asignadas aún.'
                  : `No hay validaciones ${statusFilter === 'pending' ? 'pendientes' : ''} para mostrar.`}
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        {!loading && filteredValidations.length > 0 && (
          <Card style={styles.listCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>
                Validaciones asignadas: {filteredValidations.length}
              </Title>
              <Divider style={styles.divider} />

              {filteredValidations.map((v) => {
                const parsed = parseComentario(v.comentario);
                const fechaTexto = v.fecha ? new Date(v.fecha).toLocaleString('es-MX') : 'Sin fecha';
                const modeloNombre = parsed.modelo || v.modelo_actual || 'Sin modelo';
                const tipoLabel = parsed.tipoLabel || '';
                const linea = parsed.linea || '';
                const emulador = parsed.emuladorPanel || '';
                const convertidores = parsed.convertidores || '';

                return (
                  <View key={v.id} style={[styles.itemContainer, v.completada && styles.itemContainerCompleted]}>

                    {/* Header: fecha + chip estado */}
                    <View style={styles.itemTopRow}>
                      <Text style={styles.itemDate}>{fechaTexto}</Text>
                      {v.completada ? (
                        <Chip mode="flat" style={styles.statusChipCompleted} textStyle={styles.statusChipCompletedText}>
                          Completada
                        </Chip>
                      ) : (
                        <TouchableOpacity onPress={() => handleMarcarCompletada(v.id)} activeOpacity={0.7}>
                          <View style={styles.pendienteButton}>
                            <Text style={styles.pendienteButtonText}>● Pendiente</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Modelo y tipo */}
                    <View style={styles.modeloRow}>
                      <Text style={styles.modeloText}>{modeloNombre}</Text>
                      {tipoLabel ? (
                        <View style={styles.tipoChip}>
                          <Text style={styles.tipoChipText}>{tipoLabel}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Info de validación */}
                    <View style={styles.infoGrid}>
                      {linea ? (
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>Línea</Text>
                          <Text style={styles.infoValue}>{linea}</Text>
                        </View>
                      ) : null}
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Turno</Text>
                        <Text style={styles.infoValue}>{v.turno || '-'}</Text>
                      </View>
                    </View>

                    {/* Lo que hay que validar */}
                    {(emulador || convertidores) ? (
                      <View style={styles.validarSection}>
                        <Text style={styles.validarSectionTitle}>Equipos a validar</Text>
                        {emulador ? (
                          <View style={styles.equipoRow}>
                            <View style={styles.equipoDot} />
                            <Text style={styles.equipoText}>Emulador de Panel: <Text style={styles.equipoValor}>{emulador}</Text></Text>
                          </View>
                        ) : null}
                        {convertidores ? (
                          <View style={styles.equipoRow}>
                            <View style={styles.equipoDot} />
                            <Text style={styles.equipoText}>Convertidores: <Text style={styles.equipoValor}>{convertidores}</Text></Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Botón Validar */}
                    <View style={styles.actionsRow}>
                      {v.completada ? (
                        <View style={styles.validatedButtonDisabled}>
                          <Text style={styles.validatedButtonText}>✓ Validado</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.validateButton}
                          onPress={() => handleValidar(v)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.validateButtonText}>Ir a Validar →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#B0B0B0',
    marginTop: 4,
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#B0B0B0',
    marginTop: 8,
  },
  infoCard: {
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
  },
  listCard: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#3C3C3C',
  },
  itemContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  itemContainerCompleted: {
    opacity: 0.6,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemDate: {
    color: '#B0B0B0',
    fontSize: 13,
  },
  pendienteButton: {
    backgroundColor: '#332200',
    borderWidth: 1,
    borderColor: '#FFC107',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pendienteButtonText: {
    color: '#FFC107',
    fontSize: 13,
    fontWeight: '700',
  },
  statusChipCompleted: {
    backgroundColor: '#1B5E20',
    borderColor: '#4CAF50',
  },
  statusChipCompletedText: {
    color: '#81C784',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modeloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modeloText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  tipoChip: {
    backgroundColor: '#1A3A5C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tipoChipText: {
    color: '#64B5F6',
    fontSize: 12,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  infoItem: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  validarSection: {
    backgroundColor: '#1A2A1A',
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  validarSectionTitle: {
    color: '#81C784',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  equipoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  equipoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginTop: 5,
  },
  equipoText: {
    color: '#B0B0B0',
    fontSize: 13,
    flex: 1,
  },
  equipoValor: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  itemSubtext: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  actionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  validateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
  },
  validateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  validatedButtonDisabled: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#81C784',
    opacity: 0.6,
  },
  validatedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 16,
  },
  filterCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2C2C2C',
    borderWidth: 1,
    borderColor: '#3C3C3C',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterButtonText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  statusFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusFilterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2C2C2C',
    borderWidth: 1,
    borderColor: '#3C3C3C',
    alignItems: 'center',
  },
  statusFilterButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  statusFilterButtonText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
  },
  statusFilterButtonTextActive: {
    color: '#FFFFFF',
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  datePickerModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerContainer: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '60%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  datePickerConfirmButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
  },
});


