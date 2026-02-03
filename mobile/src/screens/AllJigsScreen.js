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
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../contexts/ValidationContext';
import logger from '../utils/logger';

const { width } = Dimensions.get('window');

export default function AllJigsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { addValidation, getValidationsByModel, validations, setLineaForModel, getLineaForModel } = useValidation();
  const [jigs, setJigs] = useState([]);
  const [filteredJigs, setFilteredJigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('Todos');
  const [types, setTypes] = useState(['Todos', 'manual', 'semiautomatic', 'new semiautomatic']);
  
  // Mapeo de tipos a nombres de visualización y letras
  const typeDisplayNames = {
    'manual': { name: 'Manuales', letter: 'M', color: '#2196F3' },
    'semiautomatic': { name: 'Semi-automático', letter: 'S', color: '#4CAF50' },
    'new semiautomatic': { name: 'Nuevo Semi-automático', letter: 'N', color: '#FF9800' }
  };
  
  // Orden específico para los tipos
  const typeOrder = ['manual', 'semiautomatic', 'new semiautomatic'];
  const [typeGroups, setTypeGroups] = useState({});
  const [modelGroups, setModelGroups] = useState({});
  const [searchModelGroupsByType, setSearchModelGroupsByType] = useState({});
  const [currentView, setCurrentView] = useState('types'); // 'types', 'models', 'list'
  const [selectedModel, setSelectedModel] = useState(null); // Modelo actual cuando estás en la vista de lista
  const [jigToDelete, setJigToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [validationMode, setValidationMode] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedJig, setSelectedJig] = useState(null);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedComment, setSelectedComment] = useState('');
  const lineModel = selectedJig?.modelo_actual || selectedModel;
  const lockedLine = lineModel ? getLineaForModel(lineModel) : '';
  const currentModelValidationsCount = selectedModel ? getValidationsByModel(selectedModel).length : 0;
  const showSummaryOnly = currentView === 'types' && !searchQuery.trim();
  const canInteractWithTypes = !showSummaryOnly;
  const [searchCommitted, setSearchCommitted] = useState(false);
  const showSearchResults = searchCommitted;

  const filterByModelAndType = (modelName, typeName, jigsSource) => {
    const resolvedType = typeName && typeName !== 'Todos'
      ? typeName
      : (selectedType !== 'Todos' ? selectedType : null);
    let filteredByModel = (jigsSource || jigs).filter(jig =>
      jig.modelo_actual === modelName && (!resolvedType || jig.tipo === resolvedType)
    );
    filteredByModel.sort((a, b) => {
      const numA = parseInt(a.numero_jig?.replace(/\D/g, '') || '0');
      const numB = parseInt(b.numero_jig?.replace(/\D/g, '') || '0');
      return numA - numB;
    });
    setFilteredJigs(filteredByModel);
  };

  const mergeUniqueJigs = (existing, incoming) => {
    const seen = new Set(existing.map(item => item.id ?? item.codigo_qr));
    const merged = [...existing];
    for (const item of incoming) {
      const key = item.id ?? item.codigo_qr;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
    return merged;
  };

  const handleClearSearch = async () => {
    setSearchQuery('');
    setSelectedModel(null);
    setSelectedType('Todos');
    setCurrentView('types');
    setModelGroups({});
    setValidationMode(false);
    setSearchCommitted(false);
  };

  const openModelList = (modelName, typeName) => {
    const resolvedType = typeName && typeName !== 'Todos'
      ? typeName
      : (selectedType !== 'Todos' ? selectedType : null);
    setCurrentView('list');
    setSelectedModel(modelName);
    if (resolvedType) {
      setSelectedType(resolvedType);
    }
    filterByModelAndType(modelName, resolvedType);
  };

  useEffect(() => {
    if (!jigs.length) return;
    if (route?.params?.validationModeReturn && route?.params?.model) {
      openModelList(route.params.model, route.params.type);
      setValidationMode(true);
      navigation.setParams({ validationModeReturn: false, model: undefined, type: undefined });
    }
  }, [route?.params?.validationModeReturn, route?.params?.model, route?.params?.type, jigs.length]);

  const normalizeTurno = (turno) => {
    if (!turno) return 'A';
    const turnoLower = String(turno).toLowerCase().trim();
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
        if (turnoLower === 'a' || turnoLower === 'b' || turnoLower === 'c') {
          return turnoLower.toUpperCase();
        }
        return String(turno).toUpperCase();
    }
  };

  const isNgJig = (jig) => {
    const estado = String(jig?.estado || '').toLowerCase();
    return estado === 'reparacion' || estado === 'ng';
  };

  useEffect(() => {
    if (currentView !== 'list') {
      setValidationMode(false);
      setShowValidationModal(false);
      setSelectedJig(null);
      setSelectedLine('');
      setSelectedComment('');
    }
  }, [currentView]);

  // Función para agrupar jigs por tipo
  const groupJigsByType = (jigsList) => {
    logger.info('🔧 groupJigsByType called with:', jigsList.length, 'jigs');
    const grouped = {};
    jigsList.forEach(jig => {
      const type = jig.tipo || 'Sin Tipo';
      logger.info('🔧 Processing jig:', { numero: jig.numero_jig, tipo: jig.tipo, modelo: jig.modelo_actual });
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
    
    logger.info('🔧 groupJigsByType result:', Object.keys(grouped));
    return grouped;
  };

  // Función para agrupar jigs por modelo (para tipo Manual)
  const groupJigsByModel = (jigsList) => {
    logger.info('🔧 groupJigsByModel called with:', jigsList.length, 'jigs');
    const grouped = {};
    jigsList.forEach(jig => {
      const model = jig.modelo_actual || 'Sin Modelo';
      logger.info('🔧 Processing jig for model grouping:', { 
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
    
    logger.info('🔧 groupJigsByModel result:', Object.keys(grouped));
    logger.info('🔧 groupJigsByModel details:', grouped);
    return grouped;
  };

  const groupModelsByType = (jigsList) => {
    const grouped = {};
    jigsList.forEach(jig => {
      const type = jig.tipo || 'Sin Tipo';
      const model = jig.modelo_actual || 'Sin Modelo';
      if (!grouped[type]) {
        grouped[type] = {};
      }
      if (!grouped[type][model]) {
        grouped[type][model] = [];
      }
      grouped[type][model].push(jig);
    });
    return grouped;
  };

  // Cargar jigs al montar el componente
  useFocusEffect(
    useCallback(() => {
      setLoading(false);
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedModel && validationMode && jigs.length) {
        setCurrentView('list');
        filterByModelAndType(selectedModel, selectedType, jigs);
      }
    }, [selectedModel, selectedType, validationMode, jigs.length])
  );

  const loadJigs = async () => {
    try {
      setLoading(true);
      logger.info('🔍 Cargando todos los jigs...');
      
      // Debug: Verificar token antes de hacer la petición
      const { getAuthToken } = await import('../utils/authUtils');
      const token = await getAuthToken();
      logger.info('🔍 Token disponible:', token ? 'Sí' : 'No');
      logger.info('🔍 Token preview:', token ? token.substring(0, 20) + '...' : 'null');
      
      let result;
      if (selectedType === 'Todos') {
        const [manualResult, semiResult, newSemiResult] = await Promise.all([
          jigService.getAllJigs({ page: 1, page_size: 1500, tipo: 'manual' }),
          jigService.getAllJigs({ page: 1, page_size: 1500, tipo: 'semiautomatic' }),
          jigService.getAllJigs({ page: 1, page_size: 1500, tipo: 'new semiautomatic' })
        ]);
        result = { success: manualResult.success && semiResult.success && newSemiResult.success, data: {
          items: [
            ...(manualResult.data?.items || []),
            ...(semiResult.data?.items || []),
            ...(newSemiResult.data?.items || [])
          ]
        }};
      } else {
        result = await jigService.getAllJigs({ page: 1, page_size: 1500, tipo: selectedType });
      }
      
      if (result.success && result.data) {
        // Manejar estructura paginada (con items) o array directo
        let jigsArray = [];
        
        if (result.data.items && Array.isArray(result.data.items)) {
          // Estructura paginada: usar items
          jigsArray = result.data.items;
          logger.info('✅ Jigs cargados (paginados):', jigsArray.length, 'de', result.data.total);
        } else if (Array.isArray(result.data)) {
          // Array directo (compatibilidad hacia atrás)
          jigsArray = result.data;
          logger.info('✅ Jigs cargados (array directo):', jigsArray.length);
        } else {
          logger.error('❌ result.data no tiene formato válido:', result.data);
          Alert.alert('Error', 'Formato de datos inválido del servidor');
          return;
        }
        
        logger.info('✅ Jigs cargados:', jigsArray.length);
        logger.info('📊 Sample jig data:', jigsArray[0]);
        logger.info('📊 Jig types found:', [...new Set(jigsArray.map(jig => jig.tipo))]);
        logger.info('📊 Jig models found:', [...new Set(jigsArray.map(jig => jig.modelo_actual))]);
        
        // Debug: Mostrar todos los jigs con su tipo
        logger.info('📊 All jigs with types:');
        jigsArray.forEach((jig, index) => {
          logger.info(`  ${index + 1}. ${jig.numero_jig} - ${jig.tipo} - ${jig.modelo_actual}`);
        });

        setJigs(jigsArray);
        if (selectedModel) {
          setCurrentView('list');
          filterByModelAndType(selectedModel, selectedType, jigsArray);
        } else {
          setFilteredJigs(jigsArray);
        }
        
        // Agrupar jigs por tipo
        const grouped = groupJigsByType(jigsArray);
        setTypeGroups(grouped);
        logger.info('📊 Initial type groups:', Object.keys(grouped));
      } else {
        logger.error('❌ Error cargando jigs:', result.error);
        
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
      logger.error('❌ Error en loadJigs:', error);
      Alert.alert('Error', 'Error de conexión. Verifica tu internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!searchQuery.trim()) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    await loadJigs();
    setRefreshing(false);
  };

  // Función para eliminar jig
  const handleDeleteAllJigs = async () => {
    Alert.alert(
      '⚠️ ELIMINAR TODOS LOS JIGS',
      `¿Estás seguro de que quieres eliminar TODOS los jigs?\n\nEsta acción NO se puede deshacer.\n\nTotal de jigs: ${jigs.length}`,
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
              logger.info('⚠️ Eliminando TODOS los jigs...');
              
              const result = await jigService.deleteAllJigs();
              
              if (result.success) {
                logger.info('✅ Todos los jigs eliminados');
                Alert.alert(
                  '✅ Éxito',
                  `Se eliminaron ${result.data?.deleted_count || 0} jigs correctamente.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Recargar la lista (estará vacía)
                        loadJigs();
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Error', result.message || result.error || 'Error al eliminar todos los jigs');
              }
            } catch (error) {
              logger.error('❌ Error eliminando todos los jigs:', error);
              const errorMessage = error?.message || 'Error inesperado al eliminar todos los jigs';
              Alert.alert('Error', errorMessage);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteJig = async () => {
    if (!jigToDelete) return;

    try {
      logger.info('🗑️ Eliminando jig:', jigToDelete);
      
      // Si es un jig mock, solo removerlo del estado local
      if (typeof jigToDelete.id === 'string' && jigToDelete.id.startsWith('mock_')) {
        const updatedJigs = jigs.filter(jig => jig.id !== jigToDelete.id);
        setJigs(updatedJigs);
        filterJigs(searchQuery, selectedType);
        Alert.alert('Éxito', 'Jig mock eliminado');
        setShowDeleteModal(false);
        setJigToDelete(null);
        return;
      }
      
      const result = await jigService.deleteJig(jigToDelete.id);
      
      if (result.success) {
        logger.info('✅ Jig eliminado exitosamente');
        
        // Actualizar la lista de jigs
        const updatedJigs = jigs.filter(jig => jig.id !== jigToDelete.id);
        setJigs(updatedJigs);
        
        // Mantener el filtro actual según la vista
        if (currentView === 'list') {
          // Si estamos en lista, mantener solo los jigs del modelo seleccionado
          let filteredByModel = updatedJigs.filter(jig => 
            jig.tipo === selectedType && 
            jig.modelo_actual === jigToDelete.modelo_actual
          );
          // Ordenar numéricamente de menor a mayor
          filteredByModel.sort((a, b) => {
            const numA = parseInt(a.numero_jig?.replace(/\D/g, '') || '0');
            const numB = parseInt(b.numero_jig?.replace(/\D/g, '') || '0');
            return numA - numB;
          });
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
        logger.error('❌ Error al eliminar jig:', result.error);
        
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
      logger.error('❌ Error inesperado al eliminar jig:', error);
      Alert.alert('Error', 'Error inesperado al eliminar el jig');
    } finally {
      setShowDeleteModal(false);
      setJigToDelete(null);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const executeSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSelectedModel(null);
      setCurrentView('types');
      setSearchCommitted(false);
      await loadJigs();
      return;
    }

    if (trimmed.length < 4) {
      Alert.alert('Buscar', 'Escribe al menos 4 caracteres para buscar.');
      return;
    }

    setLoading(true);
    setSearchCommitted(true);
    const result = await jigService.searchJigs(trimmed, 1, 1500);
    setLoading(false);

    if (result.success && result.data) {
      const data = result.data;
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setJigs(items);
      setFilteredJigs(items);
      setSelectedType('Todos');
      setSelectedModel(null);
      const groupedByType = groupModelsByType(items);
      setSearchModelGroupsByType(groupedByType);
      setTypeGroups({});
      setModelGroups({});
      setCurrentView('types');
      return;
    }

    Alert.alert('Error', result.message || result.error || 'No se pudieron buscar los jigs.');
  };


  const handleTypeFilter = (type) => {
    setSelectedType(type);
    filterJigs(searchQuery, type);
  };

  const filterJigs = (query, type) => {
    logger.info('🔍 filterJigs called with:', { query, type });
    let filtered = [...jigs];
    logger.info('📊 Total jigs before filtering:', jigs.length);

    // Filtrar por tipo
    if (type !== 'Todos') {
      logger.info(`🔧 Filtering by type "${type}"...`);
      logger.info('🔧 Available types in data:', [...new Set(jigs.map(jig => jig.tipo))]);
      logger.info('🔧 Looking for exact match:', type);
      
      filtered = filtered.filter(jig => {
        const matches = jig.tipo === type;
        if (jig.tipo.includes('semi') || type.includes('semi')) {
          logger.info(`🔧 Checking jig ${jig.numero_jig}: tipo="${jig.tipo}" vs "${type}" = ${matches}`);
        }
        return matches;
      });
      logger.info(`🔧 Filtered by type "${type}":`, filtered.length, 'jigs');
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
      logger.info('🔍 After search filter:', filtered.length, 'jigs');
    }

    setFilteredJigs(filtered);
    
    // Actualizar grupos según el tipo seleccionado
    if (type === 'Todos') {
      logger.info('📋 Grouping by TYPE for "Todos"');
      // Para "Todos", agrupar por tipo
      const grouped = groupJigsByType(filtered);
      logger.info('📋 Type groups created:', Object.keys(grouped));
      setTypeGroups(grouped);
      setModelGroups({}); // Limpiar grupos de modelo
      setCurrentView('types'); // Mostrar vista de tipos
    } else {
      logger.info(`📋 Grouping by MODEL for type "${type}"`);
      // Para cualquier tipo específico (manual, semiautomatic, new semiautomatic), agrupar por modelo
      const grouped = groupJigsByModel(filtered);
      logger.info('📋 Model groups created:', Object.keys(grouped));
      logger.info('📋 Model groups details:', grouped);
      setModelGroups(grouped);
      setTypeGroups({}); // Limpiar grupos de tipo
      setCurrentView('models'); // Mostrar vista de modelos
    }
  };

  const renderTypeCard = ({ item: typeName }) => {
    const jigsInType = typeGroups[typeName] || [];
    const activeCount = jigsInType.filter(jig => jig.estado === 'activo').length;
    const totalCount = jigsInType.length;
    logger.info('🎨 renderTypeCard for:', typeName, 'with', totalCount, 'jigs');
    
    // Obtener información de visualización del tipo
    const typeInfo = typeDisplayNames[typeName] || { 
      name: typeName.charAt(0).toUpperCase() + typeName.slice(1), 
      letter: typeName.charAt(0).toUpperCase(),
      color: '#1976D2'
    };
    
    // Calcular el total de modelos únicos
    const uniqueModels = new Set(jigsInType.map(jig => jig.modelo_actual).filter(model => model));
    const totalModels = uniqueModels.size;
    
    return (
      <TouchableOpacity 
        style={[styles.typeCard, !canInteractWithTypes && styles.typeCardDisabled]}
        disabled={!canInteractWithTypes}
        onPress={() => {
          if (!canInteractWithTypes) return;
          setSelectedType(typeName);
          // Filtrar por el tipo seleccionado (esto mostrará tarjetas por modelo)
          filterJigs(searchQuery, typeName);
        }}
        activeOpacity={canInteractWithTypes ? 0.7 : 1}
      >
        <Card style={styles.typeCardContent}>
          {/* Letra en el fondo */}
          <View style={[styles.typeCardBackgroundLetter, { opacity: 0.1 }]}>
            <Text style={[styles.typeCardBackgroundLetterText, { color: typeInfo.color }]}>
              {typeInfo.letter}
            </Text>
          </View>
          
          <Card.Content>
            {/* Enunciado arriba con letra */}
            <View style={styles.typeCardLabelContainer}>
              <View style={[styles.typeCardLetterBadge, { backgroundColor: typeInfo.color }]}>
                <Text style={styles.typeCardLetterText}>{typeInfo.letter}</Text>
              </View>
              <Text style={styles.typeCardLabelText}>
                {typeInfo.name}
              </Text>
            </View>
            
            <View style={styles.typeCardHeader}>
              <Title style={styles.typeCardTitle}>{typeInfo.name}</Title>
              <View style={styles.typeCardCount}>
                <Text style={styles.typeCardCountText}>{totalCount} jigs</Text>
                {activeCount !== totalCount && (
                  <Text style={styles.typeCardActiveText}>
                    {activeCount} OK
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
                <Text style={styles.typeCardDetailLabel}>Jigs OK:</Text>
                <Text style={[styles.typeCardDetailValue, { color: '#4CAF50' }]}>
                  {activeCount}
                </Text>
              </View>
              {activeCount !== totalCount && (
                <View style={styles.typeCardDetailRow}>
                  <Text style={styles.typeCardDetailLabel}>Jigs NG:</Text>
                  <Text style={[styles.typeCardDetailValue, { color: '#F44336' }]}>
                    {totalCount - activeCount}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.typeCardFooter}>
              <Text style={styles.typeCardFooterText}>
                {canInteractWithTypes ? 'Toca para ver detalles →' : 'Usa el buscador para ver modelos'}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderSearchHint = () => (
    <View style={styles.searchHintContainer}>
      <Text style={styles.searchHintTitle}>Usa el buscador</Text>
      <Text style={styles.searchHintSubtitle}>
        Escribe un modelo o número para ver resultados
      </Text>
    </View>
  );

  const renderSearchTypeSection = ({ item: typeName }) => {
    const models = Object.keys(searchModelGroupsByType[typeName] || {}).sort();
    if (!models.length) return null;
    const typeInfo = typeDisplayNames[typeName] || {
      name: typeName.charAt(0).toUpperCase() + typeName.slice(1),
      letter: typeName.charAt(0).toUpperCase(),
      color: '#1976D2'
    };
    return (
      <View style={styles.searchTypeSection}>
        <View style={styles.searchTypeHeader}>
          <View style={[styles.typeCardLetterBadge, { backgroundColor: typeInfo.color }]}>
            <Text style={styles.typeCardLetterText}>{typeInfo.letter}</Text>
          </View>
          <Text style={styles.searchTypeTitle}>{typeInfo.name}</Text>
        </View>
        {models.map(modelName => (
          <View key={`${typeName}-${modelName}`} style={styles.searchModelCardWrapper}>
            {renderModelCard({ item: modelName, typeOverride: typeName })}
          </View>
        ))}
      </View>
    );
  };


  const renderModelCard = ({ item: modelName, typeOverride }) => {
    const jigsInModel = (typeOverride ? searchModelGroupsByType[typeOverride]?.[modelName] : modelGroups[modelName]) || [];
    const activeCount = jigsInModel.filter(jig => jig.estado === 'activo').length;
    const totalCount = jigsInModel.length;
    logger.info('🎨 renderModelCard for:', modelName, 'with', totalCount, 'jigs');
    
    return (
      <TouchableOpacity 
        style={styles.modelCard}
        onPress={() => {
          // Ir directamente a la lista de jigs del modelo
          openModelList(modelName, typeOverride || selectedType);
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
                    {activeCount} OK
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
                <Text style={styles.modelCardDetailLabel}>OK:</Text>
                <Text style={[styles.modelCardDetailValue, { color: '#4CAF50' }]}>
                  {activeCount}
                </Text>
              </View>
              {activeCount !== totalCount && (
                <View style={styles.modelCardDetailRow}>
                  <Text style={styles.modelCardDetailLabel}>NG:</Text>
                  <Text style={[styles.modelCardDetailValue, { color: '#F44336' }]}>
                    {totalCount - activeCount}
                  </Text>
                </View>
              )}
              <View style={styles.modelCardDetailRow}>
                <Text style={styles.modelCardDetailLabel}>Tipo:</Text>
                <Text style={styles.modelCardDetailValue}>
                  {(typeOverride || selectedType).charAt(0).toUpperCase() + (typeOverride || selectedType).slice(1)}
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

  const handleOpenValidationModal = (jig) => {
    if (isNgJig(jig)) {
      navigation.navigate('QuickRepairJig', { jig, jigData: jig, fromManualValidation: true });
      return;
    }
    const modelLine = jig?.modelo_actual ? getLineaForModel(jig.modelo_actual) : '';
    setSelectedJig(jig);
    setSelectedLine(modelLine || '');
    setSelectedComment('');
    setShowValidationModal(true);
  };

  const handleSubmitManualValidation = (comment) => {
    if (!selectedJig) return;
    if (!selectedLine) {
      Alert.alert('Línea requerida', 'Selecciona la línea antes de continuar.');
      return;
    }

    const jigYaAgregado = validations.some(v =>
      v.jig?.id === selectedJig.id && v.modelo_actual === selectedJig?.modelo_actual
    );

    if (jigYaAgregado) {
      Alert.alert(
        'Jig ya agregado',
        `El jig ${selectedJig.numero_jig} ya fue agregado a este modelo.`
      );
      return;
    }

    const turno = normalizeTurno(user?.turno_actual);
    const validationData = {
      jig: selectedJig,
      modelo_actual: selectedJig?.modelo_actual,
      turno,
      estado: 'OK',
      comentario: comment,
      cantidad: '1',
      linea: selectedLine,
      created_at: new Date().toISOString()
    };

    addValidation(validationData);
    setShowValidationModal(false);

    const modelValidations = getValidationsByModel(selectedJig?.modelo_actual);
    Alert.alert(
      '✅ Agregado',
      `Jig ${selectedJig?.numero_jig} agregado con éxito.\n\nTotal: ${modelValidations.length + 1} jigs agregados.`
    );
  };

  const isJigAlreadyValidated = (jig) => {
    return validations.some(v =>
      v.jig?.id === jig.id && v.modelo_actual === jig?.modelo_actual
    );
  };

  const renderJigItem = ({ item: jig }) => {
    const isNg = isNgJig(jig);
    const isAlreadyValidated = isJigAlreadyValidated(jig);
    const isTempRepaired = isNg && isAlreadyValidated;
    const statusLabel = jig.estado === 'activo'
      ? 'OK'
      : (isTempRepaired ? 'OK' : (isNg ? 'NG' : (jig.estado || 'N/A')));
    const statusColor = isTempRepaired
      ? '#4CAF50'
      : (isNg ? '#F44336' : (jig.estado === 'activo' ? '#4CAF50' : '#FF9800'));

    const content = (
      <Card
        style={[
          styles.jigCard,
          validationMode && styles.jigCardSelectable,
          isAlreadyValidated && styles.jigCardValidated
        ]}
      >
        <Card.Content>
          <View style={styles.jigHeader}>
            <View style={styles.jigNumberContainer}>
              <View style={styles.jigNumberBadge}>
                <Text style={styles.jigNumberLabel}>JIG</Text>
                <Text style={styles.jigNumber}>{jig.numero_jig}</Text>
              </View>
            </View>
            <View style={styles.jigActions}>
              <Chip 
                mode="outlined" 
                style={[
                  styles.statusChip, 
                  { 
                    backgroundColor: statusColor
                  }
                ]}
                textStyle={styles.statusText}
              >
                {statusLabel}
              </Chip>
              {(user?.tipo_usuario === 'admin' || user?.usuario === 'admin' || user?.usuario === 'superadmin') && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    setJigToDelete(jig);
                    setShowDeleteModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.deleteButtonContent}>
                    <Text style={styles.deleteButtonIcon}>🗑️</Text>
                  </View>
                </TouchableOpacity>
              )}
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
            
            {jig.fecha_ultima_validacion && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Última validación:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(jig.fecha_ultima_validacion)} {formatTime12Hour(jig.fecha_ultima_validacion)}
                </Text>
              </View>
            )}

            {jig.tecnico_ultima_validacion?.nombre && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Técnico:</Text>
                <Text style={styles.detailValue}>
                  {jig.tecnico_ultima_validacion.nombre}{jig.turno_ultima_validacion ? ` - T${jig.turno_ultima_validacion}` : ''}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );

    if (!validationMode) {
      return content;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleOpenValidationModal(jig)}
        disabled={isAlreadyValidated}
      >
        {content}
      </TouchableOpacity>
    );
  };

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

  const modelFilteredJigs = currentView === 'list' && selectedModel
    ? filteredJigs
        .filter(jig =>
          jig.modelo_actual === selectedModel &&
          (selectedType === 'Todos' || jig.tipo === selectedType)
        )
        .slice()
        .sort((a, b) => {
          const numA = parseInt(a.numero_jig?.replace(/\D/g, '') || '0');
          const numB = parseInt(b.numero_jig?.replace(/\D/g, '') || '0');
          return numA - numB;
        })
    : filteredJigs;

  return (
    <View style={styles.container}>
      {/* Header con búsqueda - Solo mostrar si NO estás en la vista de lista */}
      {currentView !== 'list' && (
        <>
          <View style={styles.header}>
            <Searchbar
              placeholder="Buscar por número, QR, modelo o tipo..."
              onChangeText={handleSearch}
              onIconPress={executeSearch}
              onClearIconPress={handleClearSearch}
              onSubmitEditing={executeSearch}
              value={searchQuery}
              style={styles.searchbar}
              placeholderTextColor="#B0B0B0"
              iconColor="#B0B0B0"
              inputStyle={styles.searchbarInput}
            />
          </View>

          {/* Filtros por tipo */}
          {!showSummaryOnly && !showSearchResults && (
            <View style={styles.filtersContainer}>
              <FlatList
                data={types}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const displayName = item === 'Todos' 
                    ? 'Todos' 
                    : (typeDisplayNames[item]?.name || item);
                  return (
                    <Chip
                      mode={selectedType === item ? 'flat' : 'outlined'}
                      selected={selectedType === item}
                      onPress={() => {
                        if (!canInteractWithTypes) return;
                        handleTypeFilter(item);
                      }}
                      style={[
                        styles.typeChip,
                        selectedType === item && styles.selectedTypeChip,
                        !canInteractWithTypes && styles.typeChipDisabled
                      ]}
                      textStyle={[
                        styles.typeChipText,
                        selectedType === item && styles.selectedTypeChipText
                      ]}
                    >
                      {displayName}
                    </Chip>
                  );
                }}
              />
            </View>
          )}
        </>
      )}

      {/* Botón de atrás solo cuando no estás en la vista principal */}
      {(currentView === 'models' || currentView === 'list') && (
        <View style={styles.backButtonContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              if (currentView === 'list') {
                // Volver a modelos desde lista
                setCurrentView('models');
                setSelectedModel(null);
                filterJigs(searchQuery, selectedType);
              } else {
                // Volver a tipos desde modelos
                setCurrentView('types');
                setSelectedType('Todos');
                filterJigs(searchQuery, 'Todos');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonIcon}>←</Text>
            <Text style={styles.backButtonText}>Atrás</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Enunciado cuando estás en la vista de lista (jigs del modelo) */}
      {currentView === 'list' && selectedModel && (
        <View style={styles.modelHeaderContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              const next = !validationMode;
              if (next && selectedModel) {
                openModelList(selectedModel, selectedType);
                setValidationMode(true);
              } else {
                setValidationMode(false);
              }
            }}
          >
            <Card style={[styles.modelHeaderCard, validationMode && styles.modelHeaderCardActive]}>
              <Card.Content style={styles.modelHeaderContent}>
                <Text style={styles.modelHeaderIcon}>📋</Text>
                <View style={styles.modelHeaderTextContainer}>
                  <Text style={styles.modelHeaderTitle}>
                    Todos los jigs del modelo
                  </Text>
                  <Text style={styles.modelHeaderModel}>
                    {selectedModel}
                  </Text>
                  <Text style={styles.modelHeaderCount}>
                    {modelFilteredJigs.length} {modelFilteredJigs.length === 1 ? 'jig encontrado' : 'jigs encontrados'}
                  </Text>
                  {validationMode && (
                    <Text style={styles.validationModeHint}>
                      Modo validación activo - toca un jig
                    </Text>
                  )}
                  {validationMode && (
                    <Text style={styles.validationCountText}>
                      {currentModelValidationsCount} jigs agregados
                    </Text>
                  )}
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de jigs o tarjetas de tipo/modelo */}
      {currentView === 'list' ? (
        <FlatList
          data={modelFilteredJigs}
          keyExtractor={(item) => item.id || item.numero_jig}
          renderItem={renderJigItem}
          onLayout={() => {
            logger.info('🎯 FlatList rendering LIST with:', {
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
          ListFooterComponent={
            validationMode ? (
              <View style={styles.reportFooter}>
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => {
                    navigation.setParams({
                      validationModeReturn: true,
                      model: selectedModel,
                      type: selectedType
                    });
                    navigation.navigate('Reporte', {
                      modelValidations: getValidationsByModel(selectedModel),
                      currentModel: selectedModel
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.reportButtonText}>Ir a reporte</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : showSummaryOnly ? (
        renderSearchHint()
      ) : showSearchResults ? (
        <FlatList
          data={typeOrder.filter(type => Object.keys(searchModelGroupsByType[type] || {}).length > 0)}
          keyExtractor={(item) => item}
          renderItem={renderSearchTypeSection}
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
          data={typeOrder.filter(type => typeGroups[type] && typeGroups[type].length > 0)}
          keyExtractor={(item) => item}
          renderItem={renderTypeCard}
          onLayout={() => {
            logger.info('🎯 FlatList rendering TYPES with:', {
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
            logger.info('🎯 FlatList rendering MODELS with:', {
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

      {/* Botón temporal para borrar todos los jigs - Solo Admin */}
      {(user?.tipo_usuario === 'admin' || user?.usuario === 'admin' || user?.usuario === 'superadmin') && (
        <FAB
          icon="delete-sweep"
          style={styles.fabDeleteAll}
          onPress={handleDeleteAllJigs}
          label="Borrar Todos (TEST)"
          color="#FFFFFF"
          customSize={56}
        />
      )}

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

      {/* Modal de validación manual */}
      <Modal
        visible={showValidationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowValidationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.validationModalContent}>
            <Text style={styles.modalTitle}>Validación manual</Text>
            <Text style={styles.modalMessage}>
              Jig {selectedJig?.numero_jig} • {selectedJig?.modelo_actual || 'N/A'}
            </Text>

            <Text style={styles.lineSelectorTitle}>Seleccionar línea</Text>
            <View style={styles.lineButtonsRow}>
              {['Línea 1', 'Línea 2', 'Línea 3', 'Línea 4', 'Línea 5', 'Línea 6'].map((lineValue) => {
                const line = lineValue.replace('Línea ', '');
                const selected = selectedLine === lineValue;
                return (
                  <TouchableOpacity
                    key={lineValue}
                    style={[styles.lineButton, selected && styles.lineButtonSelected]}
                    onPress={() => {
                      if (!lineModel) return;
                      if (lockedLine === lineValue) {
                        setLineaForModel(lineModel, '');
                        setSelectedLine('');
                        return;
                      }
                      setLineaForModel(lineModel, lineValue);
                      setSelectedLine(lineValue);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.lineButtonLabel, selected && styles.lineButtonTextSelected]}>
                      Línea
                    </Text>
                    <Text style={[styles.lineButtonText, selected && styles.lineButtonTextSelected]}>
                      {line}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.commentRow}>
              <TouchableOpacity
                style={[styles.commentButton, styles.commentButtonCleaning, selectedComment === 'Limpieza' && styles.commentButtonActive]}
                onPress={() => {
                  setSelectedComment('Limpieza');
                  handleSubmitManualValidation('Limpieza');
                }}
              >
                <Text style={styles.commentButtonText}>Limpieza</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commentButton, styles.commentButtonValidated, selectedComment === 'Validado' && styles.commentButtonActive]}
                onPress={() => {
                  setSelectedComment('Validado');
                  handleSubmitManualValidation('Validado');
                }}
              >
                <Text style={styles.commentButtonText}>Validado</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.commentRow}>
              <TouchableOpacity
                style={[styles.commentButtonWide, styles.commentButtonCombined, selectedComment === 'Limpieza y Validado' && styles.commentButtonActive]}
                onPress={() => {
                  setSelectedComment('Limpieza y Validado');
                  handleSubmitManualValidation('Limpieza y Validado');
                }}
              >
                <Text style={styles.commentButtonText}>Limpieza y Validado</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commentButtonSmall, styles.commentButtonCancel]}
                onPress={() => setShowValidationModal(false)}
              >
                <Text style={styles.commentButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.ngButton}
              onPress={() => {
                setShowValidationModal(false);
                if (selectedJig) {
                  navigation.navigate('QuickRepairJig', { jig: selectedJig, jigData: selectedJig, fromManualValidation: true });
                }
              }}
            >
              <Text style={styles.ngButtonText}>NG</Text>
            </TouchableOpacity>
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
    minHeight: 120, // Mejorado: Altura mínima para legibilidad
  },
  jigCardSelectable: {
    borderColor: '#2196F3',
  },
  jigCardValidated: {
    borderColor: '#FFFFFF',
    opacity: 0.85,
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
  jigNumberContainer: {
    flex: 1,
  },
  jigNumberBadge: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    elevation: 2,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#1565C0',
  },
  jigNumberLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginRight: 8,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  jigNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#D32F2F',
  },
  deleteButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonIcon: {
    fontSize: 18,
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
    gap: 12, // Mejorado: Espaciado consistente aumentado
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4, // Mejorado: Padding aumentado para mejor legibilidad
    gap: 8, // Mejorado: Espaciado entre label y valor
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
    backgroundColor: '#2196F3',
  },
  fabDeleteAll: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 80,
    backgroundColor: '#F44336',
  },
  backButtonContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  modelHeaderContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  modelHeaderCard: {
    backgroundColor: '#1E1E1E',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modelHeaderCardActive: {
    borderColor: '#2196F3',
  },
  modelHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modelHeaderIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  modelHeaderTextContainer: {
    flex: 1,
  },
  modelHeaderTitle: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modelHeaderModel: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modelHeaderCount: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  validationModeHint: {
    marginTop: 6,
    color: '#64B5F6',
    fontSize: 12,
    fontWeight: '500',
  },
  validationCountText: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reportFooter: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  reportButton: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0D47A1',
  },
  reportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    elevation: 3,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  backButtonIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  typeCard: {
    marginBottom: 16,
  },
  typeCardDisabled: {
    opacity: 1,
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
    aspectRatio: 1.7777777777777777,
    minHeight: 150,
    overflow: 'hidden', // Para que la letra del fondo se vea correctamente
    position: 'relative',
  },
  typeCardBackgroundLetter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  typeCardBackgroundLetterText: {
    fontSize: 120,
    fontWeight: 'bold',
    opacity: 0.15,
  },
  typeCardLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    zIndex: 1,
  },
  typeCardLetterBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  typeCardLetterText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  typeCardLabelText: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  typeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    zIndex: 1,
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
    zIndex: 1,
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
  summaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  summaryCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  summarySubtitle: {
    color: '#B0B0B0',
    fontSize: 13,
    marginBottom: 12,
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
    zIndex: 1,
  },
  typeCardFooterText: {
    color: '#1976D2',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  typeChipDisabled: {
    opacity: 0.6,
  },
  searchHintContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  searchHintTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  searchHintSubtitle: {
    color: '#B0B0B0',
    fontSize: 13,
    textAlign: 'center',
  },
  searchTypeSection: {
    marginBottom: 16,
  },
  searchTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  searchTypeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  searchModelCardWrapper: {
    marginBottom: 12,
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
    aspectRatio: 1.7777777777777777, // Mejorado: Mantiene proporción consistente (16/9)
    minHeight: 150, // Mejorado: Altura mínima para contenido
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
    zIndex: 100, // Mejorado: zIndex explícito para modales
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    minWidth: 280, // Mejorado: Ancho mínimo para legibilidad
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    alignSelf: 'center', // Mejorado: Centrado explícito
  },
  validationModalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 420,
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
  lineSelectorTitle: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  lineButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  lineButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555555',
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
  },
  lineButtonSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#1976D2',
  },
  lineButtonText: {
    color: '#E0E0E0',
    fontWeight: '600',
  },
  lineButtonLabel: {
    color: '#B0B0B0',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  lineButtonTextSelected: {
    color: '#FFFFFF',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  commentButtonWide: {
    flex: 3,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  commentButtonSmall: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginLeft: 10,
  },
  commentButtonCleaning: {
    backgroundColor: '#FF9800',
    marginRight: 10,
  },
  commentButtonValidated: {
    backgroundColor: '#4CAF50',
  },
  commentButtonCombined: {
    backgroundColor: '#2196F3',
  },
  commentButtonCancel: {
    backgroundColor: '#616161',
  },
  commentButtonActive: {
    opacity: 0.9,
  },
  commentButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  ngButton: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F44336',
    alignItems: 'center',
  },
  ngButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Mejorado: Distribución del espacio
    alignItems: 'center', // Mejorado: Alineación vertical
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
