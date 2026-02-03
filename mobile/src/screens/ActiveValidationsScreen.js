import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
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
  const canBulkDelete = user?.tipo_usuario === 'admin' || user?.usuario === 'admin' || user?.usuario === 'superadmin';

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

  // Función para verificar si una validación ya expiró según su turno y día
  const isValidationExpired = (validation) => {
    if (!validation.fecha || !validation.turno) {
      return false; // Si no tiene fecha o turno, no expirar
    }
    
    const now = new Date();
    const validationDate = new Date(validation.fecha);
    const validationDay = validationDate.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Normalizar fechas para comparar solo día/mes/año (sin hora)
    const validationDateOnly = new Date(validationDate.getFullYear(), validationDate.getMonth(), validationDate.getDate());
    const currentDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = currentDateOnly.getTime() - validationDateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Turno A: Lunes (1), Martes (2), Miércoles (3), Jueves (4)
    // Se borra el mismo día a las 6:30 PM
    if (validation.turno === 'A') {
      // Verificar que el día de la validación sea lunes, martes, miércoles o jueves
      if (validationDay >= 1 && validationDay <= 4) {
        // Si pasó más de un día desde la validación, expiró
        if (diffDays > 0) {
          return true;
        } else if (diffDays === 0) {
          // Mismo día: verificar si ya pasó las 6:30 PM
          if (currentHour > 18 || (currentHour === 18 && currentMinute >= 30)) {
            return true;
          }
        }
      }
    }
    
    // Turno B: Martes (2), Miércoles (3), Jueves (4), Viernes (5)
    // Se borra al día siguiente a las 6:30 AM
    if (validation.turno === 'B') {
      // Verificar que el día de la validación sea martes, miércoles, jueves o viernes
      if (validationDay >= 2 && validationDay <= 5) {
        // El turno B cruza medianoche, así que se borra a las 6:30 AM del día siguiente
        // Si pasó más de un día desde la validación, expiró
        if (diffDays > 1) {
          return true;
        } else if (diffDays === 1) {
          // Día siguiente: verificar si ya pasó las 6:30 AM
          if (currentHour > 6 || (currentHour === 6 && currentMinute >= 30)) {
            return true;
          }
        }
        // Si diffDays === 0 (mismo día), no expira hasta el día siguiente a las 6:30 AM
      }
    }
    
    // Turno C: Viernes (5), Sábado (6), Domingo (0)
    // Se borra cada día a las 6:30 PM
    if (validation.turno === 'C') {
      // Verificar que el día de la validación sea viernes, sábado o domingo
      if (validationDay === 0 || validationDay === 5 || validationDay === 6) {
        // Si pasó más de un día desde la validación, expiró
        if (diffDays > 0) {
          return true;
        } else if (diffDays === 0) {
          // Mismo día: verificar si ya pasó las 6:30 PM
          if (currentHour > 18 || (currentHour === 18 && currentMinute >= 30)) {
            return true;
          }
        }
      }
    }
    
    return false;
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
    
    // PRIMERO: Filtrar por fecha si se especificó un filtro de fecha
    if (targetDate !== null) {
      filtered = filtered.filter(v => {
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

    // SEGUNDO: Aplicar filtro de estado (solo 'pending' o 'all')
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
        logger.info(`👤 [ActiveValidationsScreen] Usuario actual ID: ${user?.id} (tipo: ${typeof user?.id}), Rol: ${user?.tipo_usuario}`);
        
        // Mostrar TODAS las validaciones para todos los usuarios (ingenieros y técnicos)
        // Ya no se filtra por rol - todos pueden ver todas las validaciones
        const allValidationsArray = Array.isArray(all) ? all : [];
        logger.info(`✅ [ActiveValidationsScreen] Mostrando todas las validaciones para todos los usuarios: ${allValidationsArray.length}`);

        let cleanedValidations = allValidationsArray;
        if (canBulkDelete) {
          const expiredValidations = allValidationsArray.filter(isValidationExpired);
          if (expiredValidations.length) {
            logger.info(`🧹 [ActiveValidationsScreen] Eliminando expiradas: ${expiredValidations.length}`);
            const results = await Promise.allSettled(
              expiredValidations.map(v => validationService.deleteValidation(v.id))
            );
            const deletedIds = [];
            results.forEach((result, index) => {
              if (result.status === 'fulfilled' && result.value?.success) {
                deletedIds.push(expiredValidations[index].id);
              }
            });
            if (deletedIds.length) {
              cleanedValidations = allValidationsArray.filter(v => !deletedIds.includes(v.id));
            }
          }
        }

        setAllValidations(cleanedValidations);
        
        // Aplicar filtros de fecha y estado
        const filtered = filterValidations(cleanedValidations, dateFilter, selectedDate, statusFilter);
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
        logger.info(`✅ Técnicos cargados: ${tecnicosList.length}`);
      } else {
        // Si no tiene permisos o hay error, continuar sin cargar técnicos
        logger.warn('⚠️ No se pudieron cargar los técnicos, continuando sin nombres:', result.error || 'Error desconocido');
        setTecnicosMap({});
      }
    } catch (error) {
      // Manejar error silenciosamente - las validaciones se mostrarán con IDs en lugar de nombres
      logger.warn('⚠️ Error cargando técnicos para mapa (continuando sin nombres):', error.message || error);
      setTecnicosMap({});
    }
  };

  useEffect(() => {
    // Cargar validaciones para todos los roles excepto gestión
    if (user?.tipo_usuario !== 'gestion' && user?.tipo_usuario !== 'Gestion') {
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

  const handleDeleteValidation = async (validationId) => {
    Alert.alert(
      'Eliminar Validación',
      '¿Estás seguro de que quieres eliminar esta validación? Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await validationService.deleteValidation(validationId);
              if (result.success) {
                setAllValidations(prev => prev.filter(v => v.id !== validationId));
                setFilteredValidations(prev => prev.filter(v => v.id !== validationId));
                Alert.alert('Éxito', 'Validación eliminada correctamente');
              } else {
                Alert.alert('Error', result.error || 'Error al eliminar validación');
              }
            } catch (error) {
              logger.error('Error eliminando validación:', error);
              Alert.alert('Error', 'Error al eliminar validación');
            }
          }
        }
      ]
    );
  };

  const handleDeleteUnassignedValidations = async () => {
    const targets = allValidations.filter(v => !v.tecnico_asignado_id && !v.completada);
    if (!targets.length) {
      Alert.alert('Sin cambios', 'No hay validaciones sin técnico para eliminar.');
      return;
    }
    Alert.alert(
      'Eliminar validaciones',
      `Se eliminarán ${targets.length} validaciones sin técnico asignado. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const results = await Promise.allSettled(
                targets.map(v => validationService.deleteValidation(v.id))
              );
              const deletedIds = [];
              let failed = 0;
              results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value?.success) {
                  deletedIds.push(targets[index].id);
                } else {
                  failed += 1;
                }
              });
              if (deletedIds.length) {
                setAllValidations(prev => prev.filter(v => !deletedIds.includes(v.id)));
                setFilteredValidations(prev => prev.filter(v => !deletedIds.includes(v.id)));
              }
              if (failed) {
                Alert.alert('Aviso', `Se eliminaron ${deletedIds.length}. Fallaron ${failed}.`);
              } else {
                Alert.alert('Éxito', 'Validaciones eliminadas correctamente');
              }
            } catch (error) {
              logger.error('Error eliminando validaciones sin técnico:', error);
              Alert.alert('Error', 'Error al eliminar validaciones');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Permitir acceso a todos los roles excepto gestión
  if (user?.tipo_usuario === 'gestion' || user?.tipo_usuario === 'Gestion') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Esta pantalla no está disponible para usuarios de Gestión.
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
              Validaciones creadas por {user?.nombre || 'usuario'}
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
            {canBulkDelete && (
              <Button
                mode="outlined"
                onPress={handleDeleteUnassignedValidations}
                style={styles.deleteUnassignedButton}
                icon="delete"
                textColor="#F44336"
              >
                Eliminar sin técnico
              </Button>
            )}
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
                  ? 'No hay validaciones activas.'
                  : `No hay validaciones para la fecha seleccionada.`}
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        {!loading && filteredValidations.length > 0 && (
          <View style={styles.listContainer}>
            <Card style={styles.summaryCard}>
              <Card.Content>
                <Title style={styles.sectionTitle}>
                  Validaciones activas: {filteredValidations.length}
                </Title>
              </Card.Content>
            </Card>

            {filteredValidations.map((v) => {
                // Debug: Log de datos de validación
                logger.debug('📋 Validación:', {
                  id: v.id,
                  tecnico_asignado_id: v.tecnico_asignado_id,
                  comentario: v.comentario?.substring(0, 100),
                  modelo_actual: v.modelo_actual
                });
                
                const tecnicoAsignado = tecnicosMap[v.tecnico_asignado_id];
                const tecnicoLabel = tecnicoAsignado
                  ? `${tecnicoAsignado.nombre} - #${tecnicoAsignado.numero_empleado}`
                  : (v.tecnico_asignado_id ? `ID: ${v.tecnico_asignado_id}` : 'Sin técnico asignado');
                
                // Debug: Log del técnico encontrado
                if (v.tecnico_asignado_id) {
                  logger.debug(`👤 Técnico asignado ID ${v.tecnico_asignado_id}:`, tecnicoAsignado ? 'Encontrado' : 'No encontrado en mapa');
                }

                // Convertir fecha UTC del backend a hora local
                let fechaTexto = 'Sin fecha';
                if (v.fecha) {
                  try {
                    let fechaStr = String(v.fecha);
                    
                    // El backend ahora siempre envía fechas con 'Z' al final (UTC)
                    // Si por alguna razón no tiene timezone, agregarlo
                    if (!/[Zz]$|[+-]\d{2}:\d{2}$/.test(fechaStr)) {
                      if (fechaStr.includes('T')) {
                        fechaStr = fechaStr + 'Z';
                      } else {
                        fechaStr = fechaStr + 'T00:00:00Z';
                      }
                    }
                    
                    // Crear objeto Date (JavaScript interpreta 'Z' como UTC)
                    const fechaObj = new Date(fechaStr);
                    
                    // Verificar que la fecha es válida
                    if (isNaN(fechaObj.getTime())) {
                      fechaTexto = 'Fecha inválida';
                      logger.warn('Fecha inválida recibida:', v.fecha);
                    } else {
                      // toLocaleString automáticamente convierte UTC a la zona horaria local del dispositivo
                      fechaTexto = fechaObj.toLocaleString('es-MX', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      });
                    }
                  } catch (e) {
                    logger.error('Error formateando fecha:', e, v.fecha);
                    fechaTexto = 'Fecha inválida';
                  }
                }

                // Parsear comentario para extraer información estructurada
                // Usar modelo_actual directamente, y solo parsear del comentario si no existe
                let modeloTexto = v.modelo_actual || '';
                let lineaTexto = '';
                let toolsTexto = '';
                let convertidoresTexto = '';
                let adaptadoresTexto = '';
                
                if (v.comentario) {
                  try {
                    const parts = v.comentario.split('|').map(p => p.trim());
                    parts.forEach(part => {
                      if (part.toLowerCase().startsWith('modelo:')) {
                        // Solo sobrescribir si modelo_actual no existe
                        if (!modeloTexto) {
                          modeloTexto = part.split(':').slice(1).join(':').trim();
                        }
                      } else if (part.toLowerCase().startsWith('línea:') || part.toLowerCase().startsWith('linea:')) {
                        lineaTexto = part.split(':').slice(1).join(':').trim();
                      } else if (part.toLowerCase().startsWith('tools:') || part.toLowerCase().startsWith('emulador de panel:')) {
                        toolsTexto = part.split(':').slice(1).join(':').trim();
                      } else if (part.toLowerCase().startsWith('convertidores:')) {
                        convertidoresTexto = part.split(':').slice(1).join(':').trim();
                      } else if (part.toLowerCase().startsWith('adaptadores:')) {
                        adaptadoresTexto = part.split(':').slice(1).join(':').trim();
                      }
                    });
                  } catch (e) {
                    // Si falla el parseo, usar comentario completo
                  }
                }

                const statusInfo = (() => {
                  const estado = String(v.estado || '').toLowerCase();
                  if (estado === 'no_validado' || estado === 'no validado') {
                    return { label: '⚠️ No validado', isCompleted: false, isNoValidado: true };
                  }
                  if (v.completada) {
                    return { label: '✓ Completada', isCompleted: true, isNoValidado: false };
                  }
                  return { label: '⏳ Pendiente', isCompleted: false, isNoValidado: false };
                })();

                return (
                  <Card key={v.id} style={styles.validationCard}>
                    <Card.Content style={styles.validationCardContent}>
                      {/* Header con Estado */}
                      <View style={styles.validationHeader}>
                        <View style={styles.validationHeaderLeft}>
                          <Text style={styles.validationDate}>{fechaTexto}</Text>
                          <Text style={styles.validationTurno}>Turno {v.turno || 'N/A'}</Text>
                        </View>
                        <Chip
                          mode="outlined"
                          style={[
                            styles.statusChip,
                            statusInfo.isCompleted && styles.statusChipCompleted,
                            statusInfo.isNoValidado && styles.statusChipNoValidado,
                          ]}
                          textStyle={{
                            color: statusInfo.isNoValidado
                              ? '#EF5350'
                              : (statusInfo.isCompleted ? '#4CAF50' : '#FFC107'),
                            fontWeight: 'bold',
                            fontSize: 12,
                          }}
                        >
                          {statusInfo.label}
                        </Chip>
                      </View>

                      <Divider style={styles.validationDivider} />

                      {/* Información Principal */}
                      <View style={styles.validationInfoSection}>
                        <View style={styles.validationInfoRow}>
                          <Text style={styles.validationLabel}>Modelo:</Text>
                          <Text style={styles.validationValue}>{modeloTexto || 'N/A'}</Text>
                        </View>
                        {lineaTexto ? (
                          <View style={styles.validationInfoRow}>
                            <Text style={styles.validationLabel}>Línea:</Text>
                            <Text style={styles.validationValue}>{lineaTexto}</Text>
                          </View>
                        ) : null}
                        <View style={styles.validationInfoRow}>
                          <Text style={styles.validationLabel}>Técnico Asignado:</Text>
                          <Text style={styles.validationValue}>{tecnicoLabel}</Text>
                        </View>
                      </View>

                      {/* Herramientas y Equipos */}
                      {(toolsTexto || convertidoresTexto || adaptadoresTexto) && (
                        <>
                          <Divider style={styles.validationDivider} />
                          <View style={styles.validationEquipmentSection}>
                            {toolsTexto ? (
                              <View style={styles.validationEquipmentItem}>
                                <Text style={styles.validationEquipmentLabel}>🔧 Emulador de Panel:</Text>
                                <Text style={styles.validationEquipmentValue}>{toolsTexto}</Text>
                              </View>
                            ) : null}
                            {convertidoresTexto ? (
                              <View style={styles.validationEquipmentItem}>
                                <Text style={styles.validationEquipmentLabel}>⚡ Convertidores:</Text>
                                <Text style={styles.validationEquipmentValue}>{convertidoresTexto}</Text>
                              </View>
                            ) : null}
                            {adaptadoresTexto ? (
                              <View style={styles.validationEquipmentItem}>
                                <Text style={styles.validationEquipmentLabel}>🔌 Adaptadores:</Text>
                                <Text style={styles.validationEquipmentValue}>{adaptadoresTexto}</Text>
                              </View>
                            ) : null}
                          </View>
                        </>
                      )}

                      {/* Botón de Eliminar (solo para admin) */}
                      {(user?.usuario === 'admin' || user?.usuario === 'superadmin') && (
                        <>
                          <Divider style={styles.validationDivider} />
                          <View style={styles.deleteButtonContainer}>
                            <Button
                              mode="outlined"
                              onPress={() => handleDeleteValidation(v.id)}
                              icon="delete"
                              buttonColor="#d32f2f"
                              textColor="#fff"
                              style={styles.deleteButton}
                            >
                              Eliminar
                            </Button>
                          </View>
                        </>
                      )}
                    </Card.Content>
                  </Card>
                );
            })}
          </View>
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
  listContainer: {
    marginTop: 8,
  },
  summaryCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#3C3C3C',
  },
  validationCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    borderWidth: 2,
    borderColor: '#2C2C2C',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  validationCardContent: {
    padding: 16,
  },
  validationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  validationHeaderLeft: {
    flex: 1,
  },
  validationDate: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  validationTurno: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  validationDivider: {
    backgroundColor: '#3C3C3C',
    marginVertical: 12,
    height: 1,
  },
  validationInfoSection: {
    marginBottom: 8,
  },
  validationInfoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  validationLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
    width: 130,
    marginRight: 8,
  },
  validationValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  validationEquipmentSection: {
    marginTop: 4,
  },
  validationEquipmentItem: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  validationEquipmentLabel: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  validationEquipmentValue: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  statusChip: {
    borderColor: '#FFC107',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderWidth: 1.5,
  },
  statusChipCompleted: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  statusChipNoValidado: {
    borderColor: '#EF5350',
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
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
  deleteUnassignedButton: {
    marginTop: 12,
    borderColor: '#F44336',
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
  deleteButtonContainer: {
    marginTop: 12,
    paddingTop: 12,
  },
  deleteButton: {
    borderColor: '#d32f2f',
  },
});


