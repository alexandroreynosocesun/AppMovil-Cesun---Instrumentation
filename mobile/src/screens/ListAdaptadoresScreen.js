import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Button, Chip, ActivityIndicator, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { adaptadorService } from '../services/AdaptadorService';
import logger from '../utils/logger';

export default function ListAdaptadoresScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const isFocused = useIsFocused();
  const [adaptadores, setAdaptadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedModelo, setSelectedModelo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyNg, setOnlyNg] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState({});
  const modelos = ['ADA20100_01', 'ADA20100_02', 'CSTH-100/ZH-S20'];

  useEffect(() => {
    loadAdaptadores();
  }, []); // Cargar solo una vez al montar

  useEffect(() => {
    if (isFocused) {
      setSelectedIds({});
      setSelectionMode(false);
      loadAdaptadores();
    }
  }, [isFocused]);

  const loadAdaptadores = async () => {
    try {
      setLoading(true);
      // Cargar todos los adaptadores sin filtrar por modelo
      const result = await adaptadorService.getAdaptadores('adaptador', null, { includeConectores: true });
      if (result.success) {
        setAdaptadores(result.data || []);
      } else {
        logger.error('Error cargando adaptadores:', result.error);
        setAdaptadores([]);
      }
    } catch (error) {
      logger.error('Error cargando adaptadores:', error);
      setAdaptadores([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAdaptadores();
  };

  const normalizeSearch = (value) => String(value || '').trim();
  const searchValue = normalizeSearch(searchQuery);

  const hasNgConector = (adaptador) =>
    Array.isArray(adaptador.conectores) && adaptador.conectores.some(c => c.estado === 'NG');

  const getFilteredAdaptadores = () => {
    let items = adaptadores;
    if (selectedModelo) {
      items = items.filter(a => a.modelo_adaptador === selectedModelo);
    }
    if (onlyNg) {
      items = items.filter(hasNgConector);
    }
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      items = items.filter(a => {
        const numero = String(a.numero_adaptador || '').toLowerCase();
        const qr = String(a.codigo_qr || '').toLowerCase();
        const lastTwo = numero.slice(-2);
        return numero.includes(searchLower) || qr.includes(searchLower) || lastTwo === searchLower;
      });
    }
    return items;
  };

  const filteredAdaptadores = getFilteredAdaptadores();
  const ngCount = adaptadores.filter(hasNgConector).length;

  const handleSelectModelo = (modelo) => {
    setSelectedModelo(modelo);
  };

  const toggleSelection = (adaptadorId) => {
    setSelectedIds(prev => {
      const next = { ...prev };
      if (next[adaptadorId]) {
        delete next[adaptadorId];
      } else {
        next[adaptadorId] = true;
      }
      return next;
    });
  };

  const handleBulkMarkAsOK = () => {
    const count = Object.keys(selectedIds).length;
    if (count === 0) {
      Alert.alert('Sin selección', 'No hay adaptadores seleccionados.');
      return;
    }

    // Obtener los adaptadores seleccionados con sus conectores
    const selectedAdaptadores = adaptadores.filter(a => selectedIds[a.id]);

    // Navegar a la pantalla de actualización
    navigation.navigate('UpdateAdaptadorConectores', {
      adaptadores: selectedAdaptadores
    });
  };

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWeb && { maxWidth: maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
          }
        >
          <View style={styles.header}>
            <Title style={styles.mainTitle}>Adaptadores</Title>
            <Paragraph style={styles.subtitle}>
              Lista de adaptadores registrados
            </Paragraph>
          </View>

          {/* Filtros por Modelo */}
          <View style={styles.filtersContainer}>
            {modelos.map((modelo) => {
              const count = adaptadores.filter(a => a.modelo_adaptador === modelo).length;
              const isSelected = selectedModelo === modelo;
              return (
                <View key={modelo} style={styles.filterButtonWrapper}>
                  <Button
                    mode={isSelected ? 'contained' : 'outlined'}
                    onPress={() => handleSelectModelo(isSelected ? null : modelo)}
                    style={styles.filterButton}
                    buttonColor={isSelected ? '#4CAF50' : undefined}
                  >
                    {modelo}
                  </Button>
                  <View style={styles.qtyBadge}>
                    <Paragraph style={styles.qtyText}>{count}</Paragraph>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Filtros y Modo Selección */}
          <View style={styles.ngFilterContainer}>
            <View style={styles.filterButtonWrapper}>
              <Button
                mode={onlyNg ? 'contained' : 'outlined'}
                onPress={() => setOnlyNg(!onlyNg)}
                style={styles.ngFilterButton}
                buttonColor={onlyNg ? '#E53935' : undefined}
              >
                Solo con NG
              </Button>
              <View style={[styles.qtyBadge, styles.ngQtyBadge]}>
                <Paragraph style={styles.qtyText}>{ngCount}</Paragraph>
              </View>
            </View>
            <Button
              mode={selectionMode ? 'contained' : 'outlined'}
              onPress={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) {
                  setSelectedIds({});
                }
              }}
              style={styles.selectionModeButton}
              buttonColor={selectionMode ? '#4CAF50' : undefined}
              textColor={selectionMode ? '#FFFFFF' : '#4CAF50'}
              icon={selectionMode ? 'check-circle' : 'checkbox-multiple-blank-outline'}
            >
              {selectionMode ? 'Cancelar' : 'Seleccionar'}
            </Button>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              label="Buscar por número o últimos 2 dígitos"
              value={searchQuery}
              onChangeText={setSearchQuery}
              mode="outlined"
              style={styles.searchInput}
              placeholder="Ej: 91 o 0091"
              textColor="#FFFFFF"
              placeholderTextColor="#808080"
              outlineColor="#3A3A3A"
              activeOutlineColor="#4CAF50"
              theme={{
                colors: {
                  primary: '#4CAF50',
                  background: '#1E1E1E',
                  surface: '#1E1E1E',
                  text: '#FFFFFF',
                  placeholder: '#808080',
                }
              }}
            />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
            </View>
          ) : (selectedModelo && filteredAdaptadores.length === 0) ? (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Paragraph style={styles.emptyText}>
                  {onlyNg
                    ? `No hay adaptadores con conectores NG para el modelo ${selectedModelo}.`
                    : `No hay adaptadores registrados para el modelo ${selectedModelo}.`}
                </Paragraph>
              </Card.Content>
            </Card>
          ) : selectedModelo ? (
            filteredAdaptadores
              .sort((a, b) => parseInt(a.numero_adaptador) - parseInt(b.numero_adaptador))
              .map((adaptador) => {
                const isSelected = selectedIds[adaptador.id];
                return (
                  <TouchableOpacity
                    key={adaptador.id}
                    activeOpacity={selectionMode ? 0.7 : 0.9}
                    onPress={() =>
                      selectionMode
                        ? toggleSelection(adaptador.id)
                        : navigation.navigate('AdaptadorDetail', { codigo_qr: adaptador.codigo_qr })
                    }
                  >
                    <Card
                      style={[
                        styles.itemCard,
                        isSelected && styles.itemCardSelected
                      ]}
                    >
                      <Card.Content>
                        <View style={styles.itemHeader}>
                          {selectionMode && (
                            <Chip
                              icon={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                              style={styles.checkboxChip}
                              selected={isSelected}
                              onPress={() => toggleSelection(adaptador.id)}
                            />
                          )}
                          <Title style={styles.itemTitle}>Adaptador #{adaptador.numero_adaptador}</Title>
                          {!selectionMode && (
                            <Chip icon="check-circle" style={styles.statusChip}>
                              {adaptador.estado}
                            </Chip>
                          )}
                        </View>
                        <Paragraph style={styles.itemText}>QR: {adaptador.codigo_qr}</Paragraph>
                        <Paragraph style={styles.itemText}>Modelo: {adaptador.modelo_adaptador}</Paragraph>
                      </Card.Content>
                    </Card>
                  </TouchableOpacity>
                );
              })
          ) : (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Paragraph style={styles.emptyText}>
                  Selecciona un modelo para ver la lista de adaptadores.
                </Paragraph>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Floating Button */}
      {selectionMode && Object.keys(selectedIds).length > 0 && (
        <View style={styles.floatingContainer}>
          <View style={styles.floatingContent}>
            <Paragraph style={styles.floatingCount}>
              {Object.keys(selectedIds).length} seleccionado{Object.keys(selectedIds).length > 1 ? 's' : ''}
            </Paragraph>
            <Button
              mode="contained"
              onPress={handleBulkMarkAsOK}
              style={styles.floatingButton}
              buttonColor="#4CAF50"
              icon="check-all"
            >
              Marcar como OK
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 4,
    paddingBottom: 80,
  },
  header: {
    marginBottom: 12,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ngFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#1E1E1E',
  },
  filterButtonWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  filterButton: {
    minWidth: 120,
  },
  ngFilterButton: {
    minWidth: 160,
  },
  qtyBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#0F0F0F',
  },
  qtyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ngQtyBadge: {
    backgroundColor: '#E53935',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#2A2A2A',
    marginBottom: 20,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    fontSize: 16,
  },
  itemCard: {
    backgroundColor: '#2A2A2A',
    marginBottom: 16,
    borderRadius: 12,
  },
  itemCardSelected: {
    backgroundColor: '#1E3A1E',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  statusChip: {
    backgroundColor: '#4CAF50',
  },
  itemText: {
    color: '#E0E0E0',
    fontSize: 14,
    marginBottom: 4,
  },
  selectionModeButton: {
    minWidth: 120,
  },
  checkboxChip: {
    marginRight: 8,
  },
  floatingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#3A3A3A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  floatingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingCount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  floatingButton: {
    borderRadius: 8,
  },
});

