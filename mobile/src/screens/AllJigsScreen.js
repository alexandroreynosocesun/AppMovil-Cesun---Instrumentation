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
  Modal
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Searchbar,
  Chip,
  ActivityIndicator,
  FAB,
  IconButton
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { jigService } from '../services/JigService';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

export default function AllJigsScreen({ navigation }) {
  const [jigs, setJigs] = useState([]);
  const [filteredJigs, setFilteredJigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('Todos');
  const [types, setTypes] = useState(['Todos', 'manual', 'semiautomatic', 'new semiautomatic']);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' o 'list'
  const [typeGroups, setTypeGroups] = useState({});
  const [modelGroups, setModelGroups] = useState({});
  const [currentView, setCurrentView] = useState('types'); // 'types', 'models', 'list'
  const [jigToDelete, setJigToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Función para agrupar jigs por tipo
  const groupJigsByType = (jigsList) => {
    console.log('🔧 groupJigsByType called with:', jigsList.length, 'jigs');
    const grouped = {};
    jigsList.forEach(jig => {
      const type = jig.tipo || 'Sin Tipo';
      console.log('🔧 Processing jig:', { numero: jig.numero_jig, tipo: jig.tipo, modelo: jig.modelo_actual });
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(jig);
    });
    
    // Ordenar jigs dentro de cada tipo por número
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => {
        const numA = parseInt(a.numero_jig?.replace(/\D/g, '') || '0');
        const numB = parseInt(b.numero_jig?.replace(/\D/g, '') || '0');
        return numA - numB;
      });
    });
    
    console.log('🔧 groupJigsByType result:', Object.keys(grouped));
    return grouped;
  };

  // Función para agrupar jigs por modelo (para tipo Manual)
  const groupJigsByModel = (jigsList) => {
    console.log('🔧 groupJigsByModel called with:', jigsList.length, 'jigs');
    const grouped = {};
    jigsList.forEach(jig => {
      const model = jig.modelo_actual || 'Sin Modelo';
      console.log('🔧 Processing jig for model grouping:', { 
        numero: jig.numero_jig, 
        tipo: jig.tipo, 
        modelo: jig.modelo_actual,
        modeloProcessed: model 
      });
      if (!grouped[model]) {
        grouped[model] = [];
      }
      grouped[model].push(jig);
    });
    
    // Ordenar jigs dentro de cada modelo por número
    Object.keys(grouped).forEach(model => {
      grouped[model].sort((a, b) => {
        const numA = parseInt(a.numero_jig?.replace(/\D/g, '') || '0');
        const numB = parseInt(b.numero_jig?.replace(/\D/g, '') || '0');
        return numA - numB;
      });
    });
    
    console.log('🔧 groupJigsByModel result:', Object.keys(grouped));
    console.log('🔧 groupJigsByModel details:', grouped);
    return grouped;
  };

  // Cargar jigs al montar el componente
  useFocusEffect(
    useCallback(() => {
      loadJigs();
    }, [])
  );

  const loadJigs = async () => {
    try {
      setLoading(true);
      console.log('🔍 Cargando todos los jigs...');
      
      // Debug: Verificar token antes de hacer la petición
      const { getAuthToken } = await import('../utils/authUtils');
      const token = await getAuthToken();
      console.log('🔍 Token disponible:', token ? 'Sí' : 'No');
      console.log('🔍 Token preview:', token ? token.substring(0, 20) + '...' : 'null');
      
      const result = await jigService.getAllJigs();
      
      if (result.success) {
        console.log('✅ Jigs cargados:', result.data.length);
        console.log('📊 Sample jig data:', result.data[0]);
        console.log('📊 Jig types found:', [...new Set(result.data.map(jig => jig.tipo))]);
        console.log('📊 Jig models found:', [...new Set(result.data.map(jig => jig.modelo_actual))]);
        
        // Debug: Mostrar todos los jigs con su tipo
        console.log('📊 All jigs with types:');
        result.data.forEach((jig, index) => {
          console.log(`  ${index + 1}. ${jig.numero_jig} - ${jig.tipo} - ${jig.modelo_actual}`);
        });
        
        // Agregar jigs ficticios para probar la funcionalidad
        const mockJigs = [
          // Jigs de tipo "semiautomatic"
          {
            id: 'mock_1',
            numero_jig: '1',
            codigo_qr: 'QR_SEMI_001',
            modelo_actual: 'Modelo Semi A',
            tipo: 'semiautomatic',
            estado: 'activo',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          },
          {
            id: 'mock_2',
            numero_jig: '2',
            codigo_qr: 'QR_SEMI_002',
            modelo_actual: 'Modelo Semi B',
            tipo: 'semiautomatic',
            estado: 'activo',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          },
          {
            id: 'mock_3',
            numero_jig: '3',
            codigo_qr: 'QR_SEMI_003',
            modelo_actual: 'Modelo Semi A',
            tipo: 'semiautomatic',
            estado: 'inactivo',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          },
          // Jigs de tipo "new semiautomatic"
          {
            id: 'mock_4',
            numero_jig: '4',
            codigo_qr: 'QR_NEW_SEMI_001',
            modelo_actual: 'Modelo New Semi X',
            tipo: 'new semiautomatic',
            estado: 'activo',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          },
          {
            id: 'mock_5',
            numero_jig: '5',
            codigo_qr: 'QR_NEW_SEMI_002',
            modelo_actual: 'Modelo New Semi Y',
            tipo: 'new semiautomatic',
            estado: 'activo',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          },
          {
            id: 'mock_6',
            numero_jig: '6',
            codigo_qr: 'QR_NEW_SEMI_003',
            modelo_actual: 'Modelo New Semi Z',
            tipo: 'new semiautomatic',
            estado: 'activo',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          },
          {
            id: 'mock_7',
            numero_jig: '7',
            codigo_qr: 'QR_NEW_SEMI_004',
            modelo_actual: 'Modelo New Semi X',
            tipo: 'new semiautomatic',
            estado: 'inactivo',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          }
        ];

        // Combinar jigs reales con jigs ficticios
        const allJigs = [...result.data, ...mockJigs];
        console.log('📊 Total jigs (reales + ficticios):', allJigs.length);
        console.log('📊 Jig types with mock data:', [...new Set(allJigs.map(jig => jig.tipo))]);

        setJigs(allJigs);
        setFilteredJigs(allJigs);
        
        // Agrupar jigs por tipo
        const grouped = groupJigsByType(allJigs);
        setTypeGroups(grouped);
        console.log('📊 Initial type groups:', Object.keys(grouped));
      } else {
        console.error('❌ Error cargando jigs:', result.error);
        
        // Manejar diferentes tipos de errores
        if (result.error === 'UNAUTHORIZED') {
          Alert.alert(
            'Sesión Expirada',
            result.message,
            [
              { 
                text: 'Iniciar Sesión', 
                onPress: () => {
                  // Usar reset para limpiar el stack de navegación
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }
              }
            ]
          );
        } else if (result.error === 'NETWORK_ERROR') {
          Alert.alert('Sin Conexión', result.message);
        } else if (result.error === 'SERVER_ERROR') {
          Alert.alert('Error del Servidor', result.message);
        } else {
          Alert.alert('Error', result.message || 'No se pudieron cargar los jigs. Intenta nuevamente.');
        }
      }
    } catch (error) {
      console.error('❌ Error en loadJigs:', error);
      Alert.alert('Error', 'Error de conexión. Verifica tu internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJigs();
    setRefreshing(false);
  };

  // Función para eliminar jig
  const handleDeleteJig = async () => {
    if (!jigToDelete) return;

    try {
      console.log('🗑️ Eliminando jig:', jigToDelete);
      
      const result = await jigService.deleteJig(jigToDelete.id);
      
      if (result.success) {
        console.log('✅ Jig eliminado exitosamente');
        
        // Actualizar la lista de jigs
        const updatedJigs = jigs.filter(jig => jig.id !== jigToDelete.id);
        setJigs(updatedJigs);
        
        // Mantener el filtro actual según la vista
        if (currentView === 'list') {
          // Si estamos en lista, mantener solo los jigs del modelo seleccionado
          const filteredByModel = updatedJigs.filter(jig => 
            jig.tipo === selectedType && 
            jig.modelo_actual === jigToDelete.modelo_actual
          );
          setFilteredJigs(filteredByModel);
        } else {
          // Si estamos en otras vistas, aplicar el filtro normal
          filterJigs(searchQuery, selectedType);
        }
        
        // Reagrupar los jigs para las vistas de tarjetas
        if (selectedType === 'Todos') {
          const grouped = groupJigsByType(updatedJigs);
          setTypeGroups(grouped);
        } else {
          const filtered = updatedJigs.filter(jig => jig.tipo === selectedType);
          const grouped = groupJigsByModel(filtered);
          setModelGroups(grouped);
        }
        
        Alert.alert('Éxito', 'Jig eliminado correctamente');
      } else {
        console.error('❌ Error al eliminar jig:', result.error);
        
        let errorMessage = 'Error al eliminar el jig';
        switch (result.error) {
          case 'UNAUTHORIZED':
            errorMessage = 'No tienes permisos para eliminar este jig';
            break;
          case 'NOT_FOUND':
            errorMessage = 'El jig no fue encontrado';
            break;
          case 'SERVER_ERROR':
            errorMessage = 'Error del servidor. Intenta nuevamente';
            break;
          case 'NETWORK_ERROR':
            errorMessage = 'Error de conexión. Verifica tu internet';
            break;
          default:
            errorMessage = result.error;
        }
        
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('❌ Error inesperado al eliminar jig:', error);
      Alert.alert('Error', 'Error inesperado al eliminar el jig');
    } finally {
      setShowDeleteModal(false);
      setJigToDelete(null);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    filterJigs(query, selectedType);
  };

  const handleTypeFilter = (type) => {
    setSelectedType(type);
    filterJigs(searchQuery, type);
  };

  const filterJigs = (query, type) => {
    console.log('🔍 filterJigs called with:', { query, type });
    let filtered = [...jigs];
    console.log('📊 Total jigs before filtering:', jigs.length);

    // Filtrar por tipo
    if (type !== 'Todos') {
      console.log(`🔧 Filtering by type "${type}"...`);
      console.log('🔧 Available types in data:', [...new Set(jigs.map(jig => jig.tipo))]);
      console.log('🔧 Looking for exact match:', type);
      
      filtered = filtered.filter(jig => {
        const matches = jig.tipo === type;
        if (jig.tipo.includes('semi') || type.includes('semi')) {
          console.log(`🔧 Checking jig ${jig.numero_jig}: tipo="${jig.tipo}" vs "${type}" = ${matches}`);
        }
        return matches;
      });
      console.log(`🔧 Filtered by type "${type}":`, filtered.length, 'jigs');
    }

    // Filtrar por búsqueda
    if (query.trim()) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(jig => 
        jig.numero_jig?.toLowerCase().includes(searchLower) ||
        jig.codigo_qr?.toLowerCase().includes(searchLower) ||
        jig.modelo_actual?.toLowerCase().includes(searchLower) ||
        jig.tipo?.toLowerCase().includes(searchLower)
      );
      console.log('🔍 After search filter:', filtered.length, 'jigs');
    }

    setFilteredJigs(filtered);
    
    // Actualizar grupos según el tipo seleccionado
    if (type === 'Todos') {
      console.log('📋 Grouping by TYPE for "Todos"');
      // Para "Todos", agrupar por tipo
      const grouped = groupJigsByType(filtered);
      console.log('📋 Type groups created:', Object.keys(grouped));
      setTypeGroups(grouped);
      setModelGroups({}); // Limpiar grupos de modelo
      setCurrentView('types'); // Mostrar vista de tipos
    } else {
      console.log(`📋 Grouping by MODEL for type "${type}"`);
      // Para cualquier tipo específico (manual, semiautomatic, new semiautomatic), agrupar por modelo
      const grouped = groupJigsByModel(filtered);
      console.log('📋 Model groups created:', Object.keys(grouped));
      console.log('📋 Model groups details:', grouped);
      setModelGroups(grouped);
      setTypeGroups({}); // Limpiar grupos de tipo
      setCurrentView('models'); // Mostrar vista de modelos
    }
  };

  const renderTypeCard = ({ item: typeName }) => {
    const jigsInType = typeGroups[typeName] || [];
    const activeCount = jigsInType.filter(jig => jig.estado === 'activo').length;
    const totalCount = jigsInType.length;
    console.log('🎨 renderTypeCard for:', typeName, 'with', totalCount, 'jigs');
    
    // Capitalizar el nombre del tipo para mostrar
    const displayTypeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
    
    // Calcular el total de modelos únicos
    const uniqueModels = new Set(jigsInType.map(jig => jig.modelo_actual).filter(model => model));
    const totalModels = uniqueModels.size;
    
    return (
      <TouchableOpacity 
        style={styles.typeCard}
        onPress={() => {
          setSelectedType(typeName);
          // Filtrar por el tipo seleccionado (esto mostrará tarjetas por modelo)
          filterJigs(searchQuery, typeName);
        }}
      >
        <Card style={styles.typeCardContent}>
          <Card.Content>
            <View style={styles.typeCardHeader}>
              <Title style={styles.typeCardTitle}>{displayTypeName}</Title>
              <View style={styles.typeCardCount}>
                <Text style={styles.typeCardCountText}>{totalCount} jigs</Text>
                {activeCount !== totalCount && (
                  <Text style={styles.typeCardActiveText}>
                    {activeCount} activos
                  </Text>
                )}
              </View>
            </View>
            
            <View style={styles.typeCardDetails}>
              <View style={styles.typeCardDetailRow}>
                <Text style={styles.typeCardDetailLabel}>Total de jigs:</Text>
                <Text style={styles.typeCardDetailValue}>{totalCount}</Text>
              </View>
              <View style={styles.typeCardDetailRow}>
                <Text style={styles.typeCardDetailLabel}>Total de modelos:</Text>
                <Text style={styles.typeCardDetailValue}>{totalModels}</Text>
              </View>
              <View style={styles.typeCardDetailRow}>
                <Text style={styles.typeCardDetailLabel}>Jigs activos:</Text>
                <Text style={[styles.typeCardDetailValue, { color: '#4CAF50' }]}>
                  {activeCount}
                </Text>
              </View>
              {activeCount !== totalCount && (
                <View style={styles.typeCardDetailRow}>
                  <Text style={styles.typeCardDetailLabel}>Jigs inactivos:</Text>
                  <Text style={[styles.typeCardDetailValue, { color: '#FF9800' }]}>
                    {totalCount - activeCount}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.typeCardFooter}>
              <Text style={styles.typeCardFooterText}>
                Toca para ver detalles →
              </Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderModelCard = ({ item: modelName }) => {
    const jigsInModel = modelGroups[modelName] || [];
    const activeCount = jigsInModel.filter(jig => jig.estado === 'activo').length;
    const totalCount = jigsInModel.length;
    console.log('🎨 renderModelCard for:', modelName, 'with', totalCount, 'jigs');
    
    return (
      <TouchableOpacity 
        style={styles.modelCard}
        onPress={() => {
          setCurrentView('list');
          setViewMode('list');
          // Filtrar por modelo específico dentro del tipo seleccionado
          const filteredByModel = jigs.filter(jig => 
            jig.tipo === selectedType && jig.modelo_actual === modelName
          );
          setFilteredJigs(filteredByModel);
        }}
      >
        <Card style={styles.modelCardContent}>
          <Card.Content>
            <View style={styles.modelCardHeader}>
              <Title style={styles.modelCardTitle}>{modelName}</Title>
              <View style={styles.modelCardCount}>
                <Text style={styles.modelCardCountText}>{totalCount} jigs</Text>
                {activeCount !== totalCount && (
                  <Text style={styles.modelCardActiveText}>
                    {activeCount} activos
                  </Text>
                )}
              </View>
            </View>
            
            <View style={styles.modelCardDetails}>
              <View style={styles.modelCardDetailRow}>
                <Text style={styles.modelCardDetailLabel}>Total:</Text>
                <Text style={styles.modelCardDetailValue}>{totalCount}</Text>
              </View>
              <View style={styles.modelCardDetailRow}>
                <Text style={styles.modelCardDetailLabel}>Activos:</Text>
                <Text style={[styles.modelCardDetailValue, { color: '#4CAF50' }]}>
                  {activeCount}
                </Text>
              </View>
              {activeCount !== totalCount && (
                <View style={styles.modelCardDetailRow}>
                  <Text style={styles.modelCardDetailLabel}>Inactivos:</Text>
                  <Text style={[styles.modelCardDetailValue, { color: '#FF9800' }]}>
                    {totalCount - activeCount}
                  </Text>
                </View>
              )}
              <View style={styles.modelCardDetailRow}>
                <Text style={styles.modelCardDetailLabel}>Tipo:</Text>
                <Text style={styles.modelCardDetailValue}>
                  {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
                </Text>
              </View>
            </View>
            
            <View style={styles.modelCardFooter}>
              <Text style={styles.modelCardFooterText}>
                Toca para ver jigs ordenados →
              </Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderJigItem = ({ item: jig }) => (
    <Card style={styles.jigCard}>
      <Card.Content>
        <View style={styles.jigHeader}>
          <Title style={styles.jigNumber}>{jig.numero_jig}</Title>
          <View style={styles.jigActions}>
            <Chip 
              mode="outlined" 
              style={[
                styles.statusChip, 
                { backgroundColor: jig.estado === 'activo' ? '#4CAF50' : '#FF9800' }
              ]}
              textStyle={styles.statusText}
            >
              {jig.estado}
            </Chip>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                setJigToDelete(jig);
                setShowDeleteModal(true);
              }}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.jigDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Modelo:</Text>
            <Text style={styles.detailValue}>{jig.modelo_actual || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo:</Text>
            <Text style={styles.detailValue}>{jig.tipo || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>QR:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{jig.codigo_qr}</Text>
          </View>
          
          {jig.created_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Creado:</Text>
              <Text style={styles.detailValue}>
                {formatDate(jig.created_at)} {formatTime12Hour(jig.created_at)}
              </Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconButton icon="package-variant" size={64} iconColor="#666" />
      <Text style={styles.emptyTitle}>No hay jigs</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || selectedType !== 'Todos' 
          ? 'No se encontraron jigs con los filtros aplicados'
          : 'No hay jigs registrados en el sistema'
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando jigs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con búsqueda */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Buscar por número, QR, modelo o tipo..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          placeholderTextColor="#B0B0B0"
          iconColor="#B0B0B0"
          inputStyle={styles.searchbarInput}
        />
      </View>

      {/* Filtros por tipo */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={types}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Chip
              mode={selectedType === item ? 'flat' : 'outlined'}
              selected={selectedType === item}
              onPress={() => handleTypeFilter(item)}
              style={[
                styles.typeChip,
                selectedType === item && styles.selectedTypeChip
              ]}
              textStyle={[
                styles.typeChipText,
                selectedType === item && styles.selectedTypeChipText
              ]}
            >
              {item}
            </Chip>
          )}
        />
      </View>

      {/* Botones de cambio de vista */}
      <View style={styles.viewModeButtons}>
        {currentView === 'models' && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setCurrentView('types');
              setSelectedType('Todos');
              filterJigs(searchQuery, 'Todos');
            }}
          >
            <Text style={styles.backButtonText}>← Atrás</Text>
          </TouchableOpacity>
        )}
        {currentView === 'list' && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setCurrentView('models');
              setViewMode('cards');
              // Volver a mostrar tarjetas por modelo del tipo seleccionado
              filterJigs(searchQuery, selectedType);
            }}
          >
            <Text style={styles.backButtonText}>← Atrás</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'cards' && styles.viewModeButtonActive]}
          onPress={() => {
            setViewMode('cards');
            // Aplicar filtro actual al cambiar a tarjetas
            filterJigs(searchQuery, selectedType);
          }}
        >
          <Text style={[styles.viewModeButtonText, viewMode === 'cards' && styles.viewModeButtonTextActive]}>
            Tarjetas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          onPress={() => {
            setViewMode('list');
            // Aplicar filtro actual al cambiar a lista
            filterJigs(searchQuery, selectedType);
          }}
        >
          <Text style={[styles.viewModeButtonText, viewMode === 'list' && styles.viewModeButtonTextActive]}>
            Lista
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de jigs o tarjetas de tipo/modelo */}
      {currentView === 'list' ? (
        <FlatList
          data={filteredJigs}
          keyExtractor={(item) => item.id || item.numero_jig}
          renderItem={renderJigItem}
          onLayout={() => {
            console.log('🎯 FlatList rendering LIST with:', {
              selectedType,
              currentView,
              filteredJigsCount: filteredJigs.length
            });
          }}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2196F3']}
              tintColor="#2196F3"
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      ) : currentView === 'types' ? (
        <FlatList
          data={Object.keys(typeGroups).sort()}
          keyExtractor={(item) => item}
          renderItem={renderTypeCard}
          onLayout={() => {
            console.log('🎯 FlatList rendering TYPES with:', {
              selectedType,
              currentView,
              typeGroupsKeys: Object.keys(typeGroups)
            });
          }}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2196F3']}
              tintColor="#2196F3"
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={Object.keys(modelGroups).sort()}
          keyExtractor={(item) => item}
          renderItem={renderModelCard}
          onLayout={() => {
            console.log('🎯 FlatList rendering MODELS with:', {
              selectedType,
              currentView,
              modelGroupsKeys: Object.keys(modelGroups)
            });
          }}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2196F3']}
              tintColor="#2196F3"
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB para agregar jig */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddJig')}
        label="Agregar Jig"
      />

      {/* Modal de confirmación de eliminación */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eliminar Jig</Text>
            <Text style={styles.modalMessage}>
              ¿Estás seguro de que quieres eliminar el jig #{jigToDelete?.numero_jig}?
              {'\n\n'}
              Esta acción no se puede deshacer.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButtonModal]}
                onPress={handleDeleteJig}
              >
                <Text style={styles.deleteButtonTextModal}>Eliminar</Text>
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
    fontWeight: '500',
  },
  header: {
    padding: 20,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  searchbar: {
    backgroundColor: '#2D2D2D',
    elevation: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#404040',
  },
  searchbarInput: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  filtersContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  typeChip: {
    marginRight: 8,
    backgroundColor: '#2D2D2D',
    borderColor: '#404040',
    borderWidth: 1,
  },
  selectedTypeChip: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  typeChipText: {
    color: '#E0E0E0',
    fontWeight: '500',
  },
  selectedTypeChipText: {
    color: '#000000',
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
    backgroundColor: '#121212',
  },
  jigCard: {
    marginBottom: 16,
    backgroundColor: '#1E1E1E',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  jigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jigActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  jigNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  jigDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  detailLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    color: '#E0E0E0',
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#B0B0B0',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#1976D2',
  },
  viewModeButtons: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  backButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginRight: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#1976D2',
  },
  viewModeButtonText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
  },
  viewModeButtonTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  typeCard: {
    marginBottom: 16,
  },
  typeCardContent: {
    backgroundColor: '#1E1E1E',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  typeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  typeCardCount: {
    alignItems: 'flex-end',
  },
  typeCardCountText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '700',
  },
  typeCardActiveText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  typeCardDetails: {
    marginBottom: 12,
  },
  typeCardDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeCardDetailLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  typeCardDetailValue: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '500',
  },
  typeCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 8,
  },
  typeCardFooterText: {
    color: '#1976D2',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  modelCard: {
    marginBottom: 16,
  },
  modelCardContent: {
    backgroundColor: '#1E1E1E',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modelCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modelCardCount: {
    alignItems: 'flex-end',
  },
  modelCardCountText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '700',
  },
  modelCardActiveText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  modelCardDetails: {
    marginBottom: 12,
  },
  modelCardDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelCardDetailLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  modelCardDetailValue: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '500',
  },
  modelCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 8,
  },
  modelCardFooterText: {
    color: '#1976D2',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalMessage: {
    color: '#B0B0B0',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666666',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonModal: {
    backgroundColor: '#F44336',
  },
  deleteButtonTextModal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
