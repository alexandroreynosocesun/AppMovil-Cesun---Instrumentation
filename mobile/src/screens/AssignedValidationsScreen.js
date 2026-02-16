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
                const fechaTexto = v.fecha ? new Date(v.fecha).toLocaleString('es-MX') : 'Sin fecha';

                // Obtener modelo desde modelo_actual o comentario
                let modeloTexto = v.modelo_actual;
                if (!modeloTexto && v.comentario) {
                  try {
                    const parts = v.comentario.split('|').map(p => p.trim());
                    const modeloPart = parts.find(p => p.toLowerCase().startsWith('modelo:'));
                    if (modeloPart) {
                      modeloTexto = modeloPart.split(':')[1].trim();
                    }
                  } catch (e) {
                    // ignorar error de parseo
                  }
                }

                // Extraer línea (si está en el comentario)
                let lineaTexto = '';
                if (v.comentario) {
                  try {
                    const parts = v.comentario.split('|').map(p => p.trim());
                    const lineaPart = parts.find(p => p.toLowerCase().startsWith('línea:') || p.toLowerCase().startsWith('linea:'));
                    if (lineaPart) {
                      lineaTexto = lineaPart.split(':')[1].trim();
                    }
                  } catch (e) {
                    // ignorar
                  }
                }

                return (
                  <View key={v.id} style={styles.itemContainer}>
                    {/* Fila superior: fecha izquierda, estado derecha */}
                    <View style={styles.itemTopRow}>
                      <Text style={styles.itemDateMain}>{fechaTexto}</Text>
                      {v.completada ? (
                        <Chip
                          mode="flat"
                          style={styles.statusChipCompleted}
                          textStyle={{
                            color: '#FFFFFF',
                            fontWeight: 'bold',
                          }}
                        >
                          Completada
                        </Chip>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleMarcarCompletada(v.id)}
                          activeOpacity={0.7}
                        >
                          <Chip
                            mode="outlined"
                            style={styles.statusChip}
                            textStyle={{
                              color: '#FFC107',
                              fontWeight: 'bold',
                            }}
                          >
                            Pendiente
                          </Chip>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>
                        Modelo: {modeloTexto || 'Sin modelo'}
                      </Text>
                    </View>

                    {lineaTexto ? (
                      <Text style={styles.itemSubtext}>
                        Línea: {lineaTexto}
                      </Text>
                    ) : null}

                    <Text style={styles.itemSubtext}>
                      Turno: {v.turno}
                    </Text>
                    <Text style={styles.itemSubtext}>
                      Detalle: {v.comentario || 'Sin detalles'}
                    </Text>

                    {/* Botón Validar / Validado */}
                    <View style={styles.actionsRow}>
                      {v.completada ? (
                        <View style={styles.validatedButtonDisabled}>
                          <Text style={styles.validatedButtonText}>Validado</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.validateButton}
                          onPress={() => navigation.navigate('QRScanner')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.validateButtonText}>Validar</Text>
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
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemDateMain: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusChip: {
    borderColor: '#FFC107',
    backgroundColor: 'transparent',
  },
  statusChipCompleted: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  itemSubtext: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  validateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
  },
  validateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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


