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
import { useLanguage } from '../contexts/LanguageContext';
import logger from '../utils/logger';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

export default function JigNGScreen({ navigation }) {
  const { t } = useLanguage();
  const [jigsNG, setJigsNG] = useState([]);
  const [filteredJigsNG, setFilteredJigsNG] = useState([]);
  const [modelGroups, setModelGroups] = useState({});
  const [typeGroups, setTypeGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalToRepair, setTotalToRepair] = useState(0);
  const [currentView, setCurrentView] = useState('types'); // 'types', 'models'
  const [selectedType, setSelectedType] = useState(null);
  const typeDisplayNames = {
    manual: { name: 'Manuales', letter: 'M', color: '#2196F3' },
    semiautomatic: { name: 'Semi-automático', letter: 'S', color: '#4CAF50' },
    'new semiautomatic': { name: 'Nuevo Semi-automático', letter: 'N', color: '#FF9800' }
  };
  const typeOrder = ['manual', 'semiautomatic', 'new semiautomatic'];

  // Función para agrupar jigs NG por tipo y modelo
  const groupJigsNGByTypeAndModel = (jigsList) => {
    const grouped = {};
    jigsList.forEach(jigNG => {
      const type = jigNG.jig?.tipo || 'manual';
      const model = jigNG.jig?.modelo_actual || t('noModel');
      if (!grouped[type]) {
        grouped[type] = {};
      }
      if (!grouped[type][model]) {
        grouped[type][model] = [];
      }
      grouped[type][model].push(jigNG);
    });
    Object.keys(grouped).forEach(type => {
      Object.keys(grouped[type]).forEach(model => {
        grouped[type][model].sort((a, b) => {
          const dateA = new Date(a.fecha_ng || 0);
          const dateB = new Date(b.fecha_ng || 0);
          return dateB - dateA;
        });
      });
    });
    return grouped;
  };

  // Función para cargar jigs NG (solo pendientes)
  const loadJigsNG = useCallback(async () => {
    logger.info('🔄 Cargando jigs NG...');
    setLoading(true);
    
    try {
      const result = await jigNGService.getJigsNG({
        estado: ['pendiente', 'en_reparacion'],
        include_foto: false,
        page_size: 100
      });
      
      if (result.success && result.data) {
        // Manejar estructura paginada (con items) o array directo
        let jigsNGArray = [];
        
        if (result.data.items && Array.isArray(result.data.items)) {
          // Estructura paginada: usar items
          jigsNGArray = result.data.items;
          logger.info('✅ Jigs NG recibidos (paginados):', jigsNGArray.length, 'de', result.data.total);
        } else if (Array.isArray(result.data)) {
          // Array directo (compatibilidad hacia atrás)
          jigsNGArray = result.data;
          logger.info('✅ Jigs NG recibidos (array directo):', jigsNGArray.length);
        } else {
          logger.error('❌ result.data no tiene formato válido:', result.data);
          setJigsNG([]);
          setFilteredJigsNG([]);
          setModelGroups({});
          setTotalToRepair(0);
          Alert.alert(t('error'), t('invalidDataFormat'));
          return;
        }
        
        // Filtrar solo pendientes y en reparación
        const pendingJigs = jigsNGArray.filter(jigNG => 
          jigNG.estado === 'pendiente' || jigNG.estado === 'en reparación'
        );
        
        logger.info('✅ Jigs NG pendientes:', pendingJigs.length);
        setJigsNG(pendingJigs);
        
        // Agrupar por tipo y modelo
        const grouped = groupJigsNGByTypeAndModel(pendingJigs);
        setTypeGroups(grouped);
        setModelGroups({});
        
        // Actualizar lista filtrada (tipos)
        const typeNames = Object.keys(grouped);
        setFilteredJigsNG(typeNames);
        
        // Actualizar total
        setTotalToRepair(pendingJigs.length);
      } else {
        logger.error('❌ Error cargando jigs NG:', result.error || 'result.success es false');
        setJigsNG([]);
        setFilteredJigsNG([]);
        setModelGroups({});
        setTotalToRepair(0);
        Alert.alert(t('error'), result.error || result.message || t('errorLoadingJigsNG'));
      }
    } catch (error) {
      logger.error('❌ Error inesperado:', error);
      setJigsNG([]);
      setFilteredJigsNG([]);
      setModelGroups({});
      setTotalToRepair(0);
      Alert.alert(t('error'), t('unexpectedErrorLoading'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Función para filtrar jigs NG
  const filterJigsNG = useCallback((query) => {
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

    // Agrupar por modelo
    const grouped = groupJigsNGByTypeAndModel(filtered);
    setTypeGroups(grouped);
    setModelGroups({});
    
    // Actualizar lista filtrada con nombres de tipos
    const typeNames = Object.keys(grouped);
    setFilteredJigsNG(typeNames);
    
    // Actualizar total
    setTotalToRepair(filtered.length);
  }, [jigsNG]);

  // Función para manejar búsqueda
  const handleSearch = (query) => {
    setSearchQuery(query);
    filterJigsNG(query);
  };

  // Función para obtener el color del estado
  const getStatusColor = (estado) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente':
        return '#FF9800';
      case 'en reparación':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  // Función para capitalizar estado
  const capitalizeStatus = (estado) => {
    if (!estado) return t('noStatus');
    return estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();
  };

  // Función para eliminar jig NG de la lista cuando se marca como reparado
  const removeJigNGFromList = (jigNGId) => {
    const updatedJigs = jigsNG.filter(jig => jig.id !== jigNGId);
    setJigsNG(updatedJigs);
    
    // Reagrupar
    const grouped = groupJigsNGByTypeAndModel(updatedJigs);
    setTypeGroups(grouped);
    setModelGroups({});
    
    // Actualizar lista filtrada
    const typeNames = Object.keys(grouped);
    setFilteredJigsNG(typeNames);
    
    // Actualizar total
    setTotalToRepair(updatedJigs.length);
    
    // Reaplicar búsqueda si hay
    if (searchQuery.trim()) {
      filterJigsNG(searchQuery);
    }
  };

  // Cargar datos al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      loadJigsNG();
    }, [loadJigsNG])
  );

  const openTypeModels = (typeName) => {
    setSelectedType(typeName);
    setCurrentView('models');
  };

  // Renderizar tarjeta de modelo con múltiples jigs NG
  const renderModelCard = ({ item: modelName }) => {
    const jigsInModel = typeGroups[selectedType]?.[modelName] || [];
    
    return (
      <Card style={styles.modelCard}>
        <Card.Content>
          <View style={styles.modelCardHeader}>
            <Title style={styles.modelCardTitle}>{modelName}</Title>
            <Chip 
              style={[styles.modelCountChip]}
              textStyle={styles.modelCountChipText}
            >
              {jigsInModel.length} {jigsInModel.length === 1 ? t('jig') : t('jigs')}
            </Chip>
          </View>
          
          {/* Lista de jigs NG dentro del modelo */}
          {jigsInModel.map((jigNG, index) => (
            <View key={jigNG.id} style={styles.jigNGItem}>
              {index > 0 && <View style={styles.divider} />}
              
              <TouchableOpacity
                onPress={() => navigation.navigate('JigNGDetail', { 
                  jigId: jigNG.id
                })}
                activeOpacity={0.7}
              >
                <View style={styles.jigNGHeader}>
                  <View style={styles.jigNGHeaderLeft}>
                    <Text style={styles.jigNGNumber}>{jigNG.jig?.numero_jig || 'N/A'}</Text>
                    <Chip 
                      style={[styles.statusChip, { backgroundColor: getStatusColor(jigNG.estado) }]}
                      textStyle={styles.statusChipText}
                    >
                      {capitalizeStatus(jigNG.estado)}
                    </Chip>
                  </View>
                </View>
                
                <View style={styles.jigNGDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('type')}</Text>
                    <Text style={styles.detailValue}>{jigNG.jig?.tipo || 'N/A'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('problem')}</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>
                      {jigNG.motivo || t('noDescription')}
                    </Text>
                  </View>
                  
                  {jigNG.fecha_ng && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('date')}</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(jigNG.fecha_ng)} {formatTime12Hour(jigNG.fecha_ng)}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('reportedBy')}</Text>
                    <Text style={styles.detailValue}>
                      {jigNG.tecnico_ng?.nombre || jigNG.usuario_reporte || 'N/A'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </Card.Content>
      </Card>
    );
  };

  const renderTypeCard = ({ item: typeName }) => {
    const models = Object.keys(typeGroups[typeName] || {});
    if (!models.length) return null;
    const typeInfo = typeDisplayNames[typeName] || {
      name: typeName.charAt(0).toUpperCase() + typeName.slice(1),
      letter: typeName.charAt(0).toUpperCase(),
      color: '#1976D2'
    };
    const totalCount = models.reduce((acc, model) => acc + (typeGroups[typeName]?.[model]?.length || 0), 0);
    return (
      <TouchableOpacity
        style={styles.typeCard}
        onPress={() => openTypeModels(typeName)}
        activeOpacity={0.8}
      >
        <Card style={styles.typeCardContent}>
          <Card.Content>
            <View style={styles.typeCardHeader}>
              <View style={[styles.typeBadge, { backgroundColor: typeInfo.color }]}>
                <Text style={styles.typeBadgeText}>{typeInfo.letter}</Text>
              </View>
              <Text style={styles.typeTitle}>{typeInfo.name}</Text>
            </View>
            <Text style={styles.typeCountText}>{totalCount} {totalCount === 1 ? t('jig') : t('jigs')}</Text>
            <Text style={styles.typeHint}>Toca para ver jigs</Text>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  // Renderizar estado vacío
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{t('noPendingJigsNG')}</Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery
          ? t('noJigsNGFound')
          : t('noJigsNGToRepair')
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>{t('loadingJigsNG')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Searchbar
          placeholder={t('searchJigsNGPlaceholder')}
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          placeholderTextColor="#B0B0B0"
          iconColor="#B0B0B0"
          inputStyle={styles.searchbarInput}
        />
        
        {/* Total de jigs a reparar */}
        <View style={styles.totalContainer}>
          <View style={styles.totalBox}>
            <Text style={styles.totalIcon}>🔧</Text>
            <Text style={styles.totalNumber}>{totalToRepair}</Text>
            <Text style={styles.totalLabel}>{t('totalJigsToRepair')}</Text>
          </View>
        </View>
      </View>

      {currentView === 'models' && (
        <View style={styles.backButtonContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setCurrentView('types');
              setSelectedType(null);
            }}
          >
            <Text style={styles.backButtonText}>← Atrás</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de modelos con jigs NG */}
      <FlatList
        data={
          currentView === 'models'
            ? Object.keys(typeGroups[selectedType] || {}).sort()
            : typeOrder.filter(type => (typeGroups[type] && Object.keys(typeGroups[type]).length > 0))
        }
        keyExtractor={(item) => item}
        renderItem={currentView === 'models' ? renderModelCard : renderTypeCard}
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
  totalContainer: {
    marginBottom: 12,
  },
  totalBox: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  totalIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  totalNumber: {
    color: '#FF9800',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  totalLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modelCard: {
    backgroundColor: '#1E1E1E',
    elevation: 4,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 170,
  },
  modelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modelCardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  typeSection: {
    marginBottom: 16,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  typeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  typeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  typeCard: {
    marginBottom: 16,
  },
  typeCardContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    minHeight: 150,
    justifyContent: 'center',
  },
  typeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'center',
  },
  typeCountText: {
    color: '#E0E0E0',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  typeHint: {
    color: '#2196F3',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  typeModelCard: {
    marginBottom: 12,
  },
  modelCountChip: {
    backgroundColor: '#2C2C2C',
  },
  modelCountChipText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
  },
  jigNGItem: {
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#333333',
    marginVertical: 12,
  },
  jigNGHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jigNGHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  jigNGNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusChip: {
    height: 30,
    paddingHorizontal: 8,
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  jigNGDetails: {
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
});
