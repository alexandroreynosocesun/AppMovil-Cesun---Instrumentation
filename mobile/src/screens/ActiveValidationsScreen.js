import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
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
import adminService from '../services/AdminService';
import DateTimePicker from '@react-native-community/datetimepicker';
import logger from '../utils/logger';

export default function ActiveValidationsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allValidations, setAllValidations] = useState([]);
  const [filteredValidations, setFilteredValidations] = useState([]);
  const [tecnicosMap, setTecnicosMap] = useState({});
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'custom'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'completed'

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
      // Si es después de las 6:30 PM, "hoy" es el día siguiente
      // Si es antes de las 6:30 AM, "hoy" es el día anterior
      if (currentHour > 18 || (currentHour === 18 && currentMinute >= 30)) {
        // Después de 6:30 PM, "hoy" es mañana
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      } else if (currentHour < 6 || (currentHour === 6 && currentMinute < 30)) {
        // Antes de 6:30 AM, "hoy" es ayer
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      } else {
        // Entre 6:30 AM y 6:30 PM, "hoy" es hoy
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    } else {
      // Turno B: 6:30 PM - 6:30 AM (cruza medianoche)
      // Si es después de las 6:30 PM hasta antes de medianoche → "hoy" es hoy
      // Si es después de medianoche hasta antes de las 6:30 AM → "hoy" es ayer
      // (porque el turno empezó ayer, así que las validaciones aparecen en "ayer")
      if (currentHour >= 18 && currentMinute >= 30) {
        // Después de 6:30 PM hasta medianoche, "hoy" es hoy
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else {
        // Después de medianoche hasta antes de 6:30 AM, "hoy" es ayer
        // (porque el turno empezó ayer, las validaciones aparecen en "ayer")
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      }
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
      filtered = validations.filter(v => {
        if (!v.fecha) {
          logger.debug(`⚠️ [filterValidations] Validación ${v.id} sin fecha, excluyendo del filtro de fecha`);
          return false;
        }
        const validationDate = normalizeDate(new Date(v.fecha));
        const targetTime = targetDate.getTime();
        const validationTime = validationDate.getTime();
        
        const matches = validationTime === targetTime;
        if (!matches) {
          logger.debug(`⚠️ [filterValidations] Validación ${v.id} fecha ${validationDate.toISOString()} no coincide con ${targetDate.toISOString()}`);
        }
        return matches;
      });
    }

    // Aplicar filtro de estado (solo 'pending' o 'all')
    if (statusFilterType === 'pending') {
      filtered = filtered.filter(v => !v.completada);
    }
    // No hay filtro 'completed' - solo se muestran Todas o Pendientes

    return filtered;
  };

  const loadValidations = async () => {
    try {
      setLoading(true);
      logger.info('🔄 [ActiveValidationsScreen] Cargando validaciones...');
      logger.info(`🔄 [ActiveValidationsScreen] Usuario actual: ${user?.usuario} (ID: ${user?.id}), tipo: ${user?.tipo_usuario}`);
      
      const result = await validationService.getValidations();

      if (result.success) {
        // Manejar respuesta paginada o array directo
        let all = [];
        if (result.data) {
          if (Array.isArray(result.data)) {
            // Array directo (compatibilidad hacia atrás)
            all = result.data;
            logger.info('✅ [ActiveValidationsScreen] Data es un array directo');
          } else if (result.data.items && Array.isArray(result.data.items)) {
            // Respuesta paginada
            all = result.data.items;
            logger.info('✅ [ActiveValidationsScreen] Data es un objeto paginado, extrayendo items');
          } else {
            logger.warn('⚠️ [ActiveValidationsScreen] Formato de datos inesperado:', result.data);
            all = [];
          }
        }
        
        logger.info(`📊 [ActiveValidationsScreen] Total de validaciones recibidas: ${all.length}`);
        
        // Solo mostrar las validaciones asignadas por este usuario (tecnico_id que creó la asignación)
        const mine = Array.isArray(all) ? all.filter(v => {
          const matches = v.tecnico_id === user?.id;
          if (!matches) {
            logger.debug(`❌ [ActiveValidationsScreen] Excluyendo validación ${v.id}: tecnico_id=${v.tecnico_id} !== user.id=${user?.id}`);
          }
          return matches;
        }) : [];
        
        logger.info(`✅ [ActiveValidationsScreen] Validaciones creadas por este usuario: ${mine.length}`);
        logger.info(`📋 [ActiveValidationsScreen] Detalles de validaciones:`);
        mine.forEach(v => {
          logger.info(`  - ID: ${v.id}, Modelo: ${v.modelo_actual || 'N/A'}, Completada: ${v.completada}, Fecha: ${v.fecha}, Técnico asignado: ${v.tecnico_asignado_id}`);
        });
        
        setAllValidations(mine);
        
        // Aplicar filtros de fecha y estado
        const filtered = filterValidations(mine, dateFilter, selectedDate, statusFilter);
        logger.info(`🔍 [ActiveValidationsScreen] Validaciones después de filtros: ${filtered.length}`);
        logger.info(`🔍 [ActiveValidationsScreen] Filtro de fecha: ${dateFilter}, Filtro de estado: ${statusFilter}`);
        setFilteredValidations(filtered);
      } else {
        logger.error('❌ [ActiveValidationsScreen] Error cargando validaciones:', result.error);
      }
    } catch (error) {
      logger.error('❌ [ActiveValidationsScreen] Error cargando validaciones:', error);
      logger.error('❌ [ActiveValidationsScreen] Error completo:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  // Efecto para aplicar filtros cuando cambian dateFilter, selectedDate o statusFilter
  useEffect(() => {
    if (allValidations.length > 0) {
      const filtered = filterValidations(allValidations, dateFilter, selectedDate, statusFilter);
      setFilteredValidations(filtered);
    }
  }, [dateFilter, selectedDate, statusFilter]);

  const loadTecnicos = async () => {
    try {
      const result = await adminService.getTecnicos();
      if (result.success) {
        // Manejar respuesta paginada o array directo
        let tecnicosList = [];
        if (result.data) {
          if (Array.isArray(result.data)) {
            // Array directo (compatibilidad hacia atrás)
            tecnicosList = result.data;
          } else if (result.data.items && Array.isArray(result.data.items)) {
            // Respuesta paginada
            tecnicosList = result.data.items;
          } else {
            logger.warn('Formato de datos inesperado en técnicos:', result.data);
            tecnicosList = [];
          }
        }
        
        const map = {};
        if (Array.isArray(tecnicosList)) {
          tecnicosList.forEach(t => {
            map[t.id] = t;
          });
        }
        setTecnicosMap(map);
      }
    } catch (error) {
      logger.error('Error cargando técnicos para mapa:', error);
    }
  };

  useEffect(() => {
    if (user?.tipo_usuario === 'asignaciones') {
      loadValidations();
      loadTecnicos();
    }
  }, [user]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadValidations(), loadTecnicos()]);
    setRefreshing(false);
  };

  if (user?.tipo_usuario !== 'asignaciones') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Esta pantalla solo está disponible para usuarios con rol de Asignaciones.
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
            <Title style={styles.title}>Estatus de Validaciones</Title>
            <Paragraph style={styles.subtitle}>
              Validaciones creadas por {user?.nombre}
            </Paragraph>
          </Card.Content>
        </Card>

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

        {/* Date Picker Modal con Calendario */}
        {showDatePicker && (
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
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <Title style={styles.datePickerTitle}>Seleccionar Fecha</Title>
                  <IconButton
                    icon="close"
                    size={24}
                    iconColor="#FFFFFF"
                    onPress={() => setShowDatePicker(false)}
                  />
                </View>
                <View style={styles.calendarContainer}>
                  {DateTimePicker ? (
                    Platform.OS === 'android' ? (
                      <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="calendar"
                        onChange={handleDatePickerChange}
                        maximumDate={new Date()}
                      />
                    ) : (
                      <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="spinner"
                        onChange={handleDatePickerChange}
                        maximumDate={new Date()}
                      />
                    )
                  ) : (
                    <Text style={styles.errorText}>
                      El selector de fecha no está disponible. Por favor, reinstala la aplicación.
                    </Text>
                  )}
                </View>
                <Button
                  mode="contained"
                  onPress={() => {
                    setShowDatePicker(false);
                    setDateFilter('custom');
                  }}
                  style={styles.datePickerConfirmButton}
                >
                  Confirmar
                </Button>
              </View>
            </View>
          </Modal>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Paragraph style={styles.loadingText}>Cargando validaciones...</Paragraph>
          </View>
        )}

        {!loading && filteredValidations.length === 0 && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>
                {allValidations.length === 0 
                  ? 'No has creado validaciones aún.'
                  : `No hay validaciones para la fecha seleccionada.`}
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        {!loading && filteredValidations.length > 0 && (
          <Card style={styles.listCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>
                Validaciones activas: {filteredValidations.length}
              </Title>
              <Divider style={styles.divider} />

              {filteredValidations.map((v) => {
                const tecnicoAsignado = tecnicosMap[v.tecnico_asignado_id];
                const tecnicoLabel = tecnicoAsignado
                  ? `${tecnicoAsignado.nombre} - #${tecnicoAsignado.numero_empleado}`
                  : (v.tecnico_asignado_id ? `ID: ${v.tecnico_asignado_id}` : 'Sin técnico asignado');

                const fechaTexto = v.fecha ? new Date(v.fecha).toLocaleString('es-MX') : 'Sin fecha';

                // Intentar obtener el modelo: primero del campo modelo_actual, luego del comentario
                let modeloTexto = v.modelo_actual;
                if (!modeloTexto && v.comentario) {
                  try {
                    const firstPart = v.comentario.split('|')[0].trim(); // ej. "Modelo: 12345"
                    const match = firstPart.match(/Modelo:\s*(.+)/i);
                    if (match && match[1]) {
                      modeloTexto = match[1].trim();
                    }
                  } catch (e) {
                    // Si falla el parseo, dejamos modeloTexto como undefined
                  }
                }

                return (
                  <View key={v.id} style={styles.itemContainer}>
                    {/* Fila superior: fecha izquierda, estado derecha */}
                    <View style={styles.itemTopRow}>
                      <Text style={styles.itemDateMain}>{fechaTexto}</Text>
                      <Chip
                        mode="outlined"
                        style={[
                          styles.statusChip,
                          v.completada && styles.statusChipCompleted,
                        ]}
                        textStyle={{
                          color: v.completada ? '#4CAF50' : '#FFC107',
                          fontWeight: 'bold',
                        }}
                      >
                        {v.completada ? 'Completada' : 'Pendiente'}
                      </Chip>
                    </View>

                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>
                        Modelo: {modeloTexto || 'Sin modelo'}
                      </Text>
                    </View>

                    <Text style={styles.itemSubtext}>
                      Técnico asignado: {tecnicoLabel}
                    </Text>
                    <Text style={styles.itemSubtext}>
                      Turno: {v.turno}
                    </Text>
                    <Text style={styles.itemSubtext}>
                      Detalle: {v.comentario || 'Sin detalles'}
                    </Text>
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
    borderColor: '#2196F3',
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
    marginBottom: 6,
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
    borderColor: '#4CAF50',
  },
  itemSubtext: {
    color: '#B0B0B0',
    fontSize: 14,
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
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
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
    backgroundColor: '#2196F3',
  },
});


