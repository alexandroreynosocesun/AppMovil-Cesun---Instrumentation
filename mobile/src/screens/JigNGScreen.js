import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Card, Title, Paragraph, Searchbar, Chip, FAB, IconButton } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { jigNGService } from '../services/JigNGService';

const { width } = Dimensions.get('window');

export default function JigNGScreen({ navigation }) {
  const [jigsNG, setJigsNG] = useState([]);
  const [filteredJigsNG, setFilteredJigsNG] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' o 'list'
  const [jigToDelete, setJigToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    reparados: 0
  });
  const [selectedStat, setSelectedStat] = useState('total');

  const statusOptions = ['Todos', 'Pendiente', 'En Reparación', 'Reparado', 'Retirado'];

  // Función para calcular estadísticas
  const calculateStats = (jigsList) => {
    const total = jigsList.length;
    const pendientes = jigsList.filter(jig => 
      jig.estado === 'pendiente' || jig.estado === 'en reparación'
    ).length;
    const reparados = jigsList.filter(jig => 
      jig.estado === 'reparado' || jig.estado === 'falso_defecto'
    ).length;
    
    return { total, pendientes, reparados };
  };

  // Función para cargar jigs NG
  const loadJigsNG = useCallback(async () => {
    console.log('🔄 Cargando jigs NG...');
    setLoading(true);
    
    try {
      const result = await jigNGService.getAllJigsNG();
      
      if (result.success) {
        console.log('✅ Jigs NG cargados:', result.data.length);
        setJigsNG(result.data);
        setFilteredJigsNG(result.data);
        
        // Calcular estadísticas
        const newStats = calculateStats(result.data);
        setStats(newStats);
        console.log('📊 Estadísticas calculadas:', newStats);
      } else {
        console.error('❌ Error cargando jigs NG:', result.error);
        Alert.alert('Error', result.message || 'Error al cargar jigs NG');
      }
    } catch (error) {
      console.error('❌ Error inesperado:', error);
      Alert.alert('Error', 'Error inesperado al cargar jigs NG');
    } finally {
      setLoading(false);
    }
  }, []);

  // Función para filtrar jigs NG
  const filterJigsNG = useCallback((query, status) => {
    let filtered = jigsNG;

    // Filtrar por búsqueda
    if (query.trim()) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(jigNG => 
        jigNG.jig?.numero_jig?.toLowerCase().includes(searchLower) ||
        jigNG.jig?.modelo_actual?.toLowerCase().includes(searchLower) ||
        jigNG.jig?.tipo?.toLowerCase().includes(searchLower) ||
        jigNG.motivo?.toLowerCase().includes(searchLower) ||
        jigNG.usuario_reporte?.toLowerCase().includes(searchLower)
      );
    }

    // Filtrar por estado
    if (status !== 'Todos') {
      filtered = filtered.filter(jigNG => jigNG.estado === status.toLowerCase());
    }

    setFilteredJigsNG(filtered);
    
    // Recalcular estadísticas con los datos filtrados
    const newStats = calculateStats(filtered);
    setStats(newStats);
  }, [jigsNG]);

  // Función para manejar búsqueda
  const handleSearch = (query) => {
    setSearchQuery(query);
    // Aplicar filtro basado en la estadística seleccionada
    handleStatSelection(selectedStat);
  };

  // Función para manejar filtro de estado
  const handleStatusFilter = (status) => {
    setSelectedStatus(status);
    filterJigsNG(searchQuery, status);
  };

  // Función para manejar selección de estadística
  const handleStatSelection = (statType) => {
    setSelectedStat(statType);
    
    let filtered = jigsNG;
    
    // Filtrar por búsqueda primero
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(jig => 
        jig.numero_jig?.toLowerCase().includes(searchLower) ||
        jig.modelo_actual?.toLowerCase().includes(searchLower) ||
        jig.tipo?.toLowerCase().includes(searchLower) ||
        jig.motivo?.toLowerCase().includes(searchLower) ||
        jig.usuario_reporte?.toLowerCase().includes(searchLower)
      );
    }
    
    // Filtrar por tipo de estadística
    switch (statType) {
      case 'total':
        // Mostrar todos
        break;
      case 'pendientes':
        filtered = filtered.filter(jig => 
          jig.estado === 'pendiente' || jig.estado === 'en reparación'
        );
        break;
      case 'reparados':
        filtered = filtered.filter(jig => 
          jig.estado === 'reparado' || jig.estado === 'falso_defecto'
        );
        break;
    }
    
    setFilteredJigsNG(filtered);
    
    // Recalcular estadísticas con los datos filtrados
    const newStats = calculateStats(filtered);
    setStats(newStats);
  };

  // Función para eliminar jig NG
  const handleDeleteJigNG = async () => {
    if (!jigToDelete) return;

    try {
      const result = await jigNGService.deleteJigNG(jigToDelete.id);
      
      if (result.success) {
        // Actualizar la lista local
        const updatedJigs = jigsNG.filter(jig => jig.id !== jigToDelete.id);
        setJigsNG(updatedJigs);
        
        // Recalcular estadísticas con la lista actualizada
        const newStats = calculateStats(updatedJigs);
        setStats(newStats);
        
        filterJigsNG(searchQuery, selectedStatus);
        setShowDeleteModal(false);
        setJigToDelete(null);
        Alert.alert('Éxito', 'Jig NG eliminado correctamente');
      } else {
        Alert.alert('Error', result.message || 'Error al eliminar jig NG');
      }
    } catch (error) {
      console.error('❌ Error al eliminar jig NG:', error);
      Alert.alert('Error', 'Error inesperado al eliminar jig NG');
    }
  };

  // Función para obtener el color del estado
  const getStatusColor = (estado) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente':
        return '#FF9800';
      case 'en reparación':
        return '#2196F3';
      case 'reparado':
        return '#4CAF50';
      case 'retirado':
        return '#F44336';
      case 'falso_defecto':
        return '#9C27B0';
      default:
        return '#9E9E9E';
    }
  };

  // Función para capitalizar estado
  const capitalizeStatus = (estado) => {
    if (!estado) return 'Sin Estado';
    if (estado === 'falso_defecto') return 'Falso Defecto';
    return estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();
  };

  // Cargar datos al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      loadJigsNG();
    }, [loadJigsNG])
  );

  // Renderizar tarjeta de jig NG
  const renderJigNGCard = ({ item: jigNG }) => (
    <TouchableOpacity
      style={styles.jigCard}
      onPress={() => navigation.navigate('JigNGDetail', { jigId: jigNG.id })}
    >
      <Card style={styles.jigCardContent}>
        <Card.Content>
          <View style={styles.jigCardHeader}>
            <Title style={styles.jigNumber}>{jigNG.jig?.numero_jig || 'N/A'}</Title>
            <Chip 
              style={[styles.statusChip, { backgroundColor: getStatusColor(jigNG.estado) }]}
              textStyle={styles.statusChipText}
            >
              {capitalizeStatus(jigNG.estado)}
            </Chip>
          </View>
          
          <View style={styles.jigCardDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Modelo:</Text>
              <Text style={styles.detailValue}>{jigNG.jig?.modelo_actual || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tipo:</Text>
              <Text style={styles.detailValue}>{jigNG.jig?.tipo || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Problema:</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {jigNG.motivo || 'Sin descripción'}
              </Text>
            </View>
            {jigNG.fecha_ng && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fecha:</Text>
                <Text style={styles.detailValue}>
                  {new Date(jigNG.fecha_ng).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Renderizar item de lista
  const renderJigNGItem = ({ item: jigNG }) => (
    <TouchableOpacity
      style={styles.jigListItem}
      onPress={() => navigation.navigate('JigNGDetail', { jigId: jigNG.id })}
    >
      <View style={styles.jigListItemContent}>
        <View style={styles.jigListItemHeader}>
          <Text style={styles.jigListItemNumber}>{jigNG.jig?.numero_jig || 'N/A'}</Text>
          <Chip 
            style={[styles.statusChip, { backgroundColor: getStatusColor(jigNG.estado) }]}
            textStyle={styles.statusChipText}
          >
            {capitalizeStatus(jigNG.estado)}
          </Chip>
        </View>
        <Text style={styles.jigListItemModel}>{jigNG.jig?.modelo_actual || 'N/A'}</Text>
        <Text style={styles.jigListItemProblem} numberOfLines={1}>
          {jigNG.motivo || 'Sin descripción'}
        </Text>
      </View>
      <IconButton
        icon="delete"
        size={20}
        iconColor="#F44336"
        onPress={() => {
          setJigToDelete(jigNG);
          setShowDeleteModal(true);
        }}
      />
    </TouchableOpacity>
  );

  // Renderizar estado vacío
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No hay jigs NG</Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery || selectedStatus !== 'Todos' 
          ? 'No se encontraron jigs NG con los filtros aplicados'
          : 'No hay jigs NG registrados'
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando jigs NG...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Buscar por número, modelo, tipo o problema..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          placeholderTextColor="#B0B0B0"
          iconColor="#B0B0B0"
          inputStyle={styles.searchbarInput}
        />
        
        {/* Marcador de estadísticas */}
        <View style={styles.statsContainer}>
          <TouchableOpacity 
            style={[
              styles.statBox, 
              selectedStat === 'total' && styles.selectedStatBox
            ]}
            onPress={() => handleStatSelection('total')}
            activeOpacity={0.7}
          >
            <View style={styles.statIconContainer}>
              <Text style={styles.statIcon}>📊</Text>
            </View>
            <Text style={[
              styles.statNumber,
              selectedStat === 'total' && styles.selectedStatNumber
            ]}>
              {stats.total}
            </Text>
            <Text style={[
              styles.statLabel,
              selectedStat === 'total' && styles.selectedStatLabel
            ]}>
              Total
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.statBox, 
              selectedStat === 'pendientes' && styles.selectedStatBox
            ]}
            onPress={() => handleStatSelection('pendientes')}
            activeOpacity={0.7}
          >
            <View style={styles.statIconContainer}>
              <Text style={styles.statIcon}>⏳</Text>
            </View>
            <Text style={[
              styles.statNumber,
              { color: '#FF9800' },
              selectedStat === 'pendientes' && styles.selectedStatNumber
            ]}>
              {stats.pendientes}
            </Text>
            <Text style={[
              styles.statLabel,
              selectedStat === 'pendientes' && styles.selectedStatLabel
            ]}>
              Pendientes
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.statBox, 
              selectedStat === 'reparados' && styles.selectedStatBox
            ]}
            onPress={() => handleStatSelection('reparados')}
            activeOpacity={0.7}
          >
            <View style={styles.statIconContainer}>
              <Text style={styles.statIcon}>✅</Text>
            </View>
            <Text style={[
              styles.statNumber,
              { color: '#4CAF50' },
              selectedStat === 'reparados' && styles.selectedStatNumber
            ]}>
              {stats.reparados}
            </Text>
            <Text style={[
              styles.statLabel,
              selectedStat === 'reparados' && styles.selectedStatLabel
            ]}>
              Reparados
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botones de vista */}
        <View style={styles.viewModeButtons}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'cards' && styles.activeViewModeButton]}
            onPress={() => setViewMode('cards')}
          >
            <Text style={[styles.viewModeButtonText, viewMode === 'cards' && styles.activeViewModeButtonText]}>
              Tarjetas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewModeButton]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.viewModeButtonText, viewMode === 'list' && styles.activeViewModeButtonText]}>
              Lista
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de jigs NG */}
      <FlatList
        data={filteredJigsNG}
        keyExtractor={(item) => item.id.toString()}
        renderItem={viewMode === 'cards' ? renderJigNGCard : renderJigNGItem}
        numColumns={viewMode === 'cards' ? 1 : 1}
        key={viewMode} // Forzar re-render al cambiar vista
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadJigsNG}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB para agregar */}
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('AddJigNG')}
        label="Agregar Jig NG"
      />

      {/* Modal de confirmación de eliminación */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Eliminar Jig NG</Text>
            <Text style={styles.modalMessage}>
              ¿Estás seguro de que quieres eliminar el jig NG {jigToDelete?.numero_jig}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteJigNG}
              >
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  searchbar: {
    backgroundColor: '#2C2C2C',
    marginBottom: 12,
    elevation: 0,
  },
  searchbarInput: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 4,
    borderWidth: 2,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    transform: [{ scale: 1 }],
  },
  selectedStatBox: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2196F3',
    borderWidth: 2,
    elevation: 8,
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.4,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 24,
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectedStatNumber: {
    color: '#2196F3',
    fontSize: 30,
  },
  statLabel: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  selectedStatLabel: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  viewModeButtons: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeViewModeButton: {
    backgroundColor: '#2196F3',
  },
  viewModeButtonText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
  },
  activeViewModeButtonText: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  jigCard: {
    marginBottom: 16,
  },
  jigCardContent: {
    backgroundColor: '#1E1E1E',
    elevation: 4,
    borderRadius: 12,
  },
  jigCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jigNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  jigCardDetails: {
    gap: 8,
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
  jigListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 2,
  },
  jigListItemContent: {
    flex: 1,
  },
  jigListItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  jigListItemNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  jigListItemModel: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 2,
  },
  jigListItemProblem: {
    color: '#E0E0E0',
    fontSize: 12,
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    margin: 16,
    minWidth: 280,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    color: '#E0E0E0',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2C2C2C',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  cancelButtonText: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
