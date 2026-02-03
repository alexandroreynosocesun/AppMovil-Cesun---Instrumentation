import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Button, Chip, ActivityIndicator, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { adaptadorService } from '../services/AdaptadorService';
import logger from '../utils/logger';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';

export default function ListConvertidoresScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const isFocused = useIsFocused();
  const [convertidores, setConvertidores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedModelo, setSelectedModelo] = useState(null);
  const [updatingIds, setUpdatingIds] = useState({});
  const [showNgModal, setShowNgModal] = useState(false);
  const [ngComment, setNgComment] = useState('');
  const [pendingConvertidor, setPendingConvertidor] = useState(null);
  const [onlyNg, setOnlyNg] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState({});
  const [selectionMode, setSelectionMode] = useState(false);
  const modelos = ['11477', '11479'];

  useEffect(() => {
    if (isFocused) {
      loadConvertidores();
      setSelectedIds({}); // Limpiar selecciones al volver
    }
  }, [isFocused]); // Recargar cuando la pantalla vuelve a estar en foco

  const loadConvertidores = async () => {
    try {
      setLoading(true);
      // Cargar todos los convertidores sin filtrar por modelo
      const result = await adaptadorService.getAdaptadores('convertidor', null, {
        includeConectores: true,
        includeTecnicos: true
      });
      if (result.success) {
        setConvertidores(result.data || []);
      } else {
        logger.error('Error cargando convertidores:', result.error);
        setConvertidores([]);
      }
    } catch (error) {
      logger.error('Error cargando convertidores:', error);
      setConvertidores([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConvertidores();
  };

  const getModeloColor = (modelo) => (modelo === '11477' ? '#4CAF50' : '#FF9800');

  const getConectorEstado = (convertidor) =>
    convertidor?.conectores?.[0]?.estado || null;

  const getConector = (convertidor) => convertidor?.conectores?.[0] || null;
  const hasNgConector = (convertidor) => getConectorEstado(convertidor) === 'NG';
  const normalizeSearch = (value) => String(value || '').trim();
  const searchValue = normalizeSearch(searchQuery);
  const getNumeroSuffix = (value) => {
    const text = String(value || '');
    const parts = text.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };
  const getNgInfo = (convertidor) => {
    const conector = getConector(convertidor);
    if (!conector) return null;
    const tecnico = conector.tecnico_ng;
    const fecha = conector.fecha_estado_ng;
    return {
      tecnico,
      fecha
    };
  };
  const getOkInfo = (convertidor) => {
    const conector = getConector(convertidor);
    if (!conector) return null;
    const tecnico = conector.tecnico_ultima_validacion;
    const fecha = conector.fecha_ultima_validacion;
    return {
      tecnico,
      fecha
    };
  };

  const handleOpenNg = (convertidor) => {
    const conector = convertidor?.conectores?.[0];
    if (!conector?.id) {
      Alert.alert('Sin conector', 'No se encontró el conector del convertidor.');
      return;
    }
    setPendingConvertidor(convertidor);
    setNgComment('');
    setShowNgModal(true);
  };

  const handleConfirmNg = async () => {
    const conector = getConector(pendingConvertidor);
    if (!conector?.id) {
      setShowNgModal(false);
      setPendingConvertidor(null);
      return;
    }

    const trimmedComment = ngComment.trim();
    if (!trimmedComment) {
      Alert.alert('Falta comentario', 'Escribe la falla antes de marcar NG.');
      return;
    }

    setUpdatingIds(prev => ({ ...prev, [conector.id]: true }));
    const result = await adaptadorService.updateConectorEstado(conector.id, 'NG', trimmedComment);
    if (result.success) {
      setConvertidores(prev => prev.map(item => {
        if (item.id !== pendingConvertidor.id) return item;
        const conectores = Array.isArray(item.conectores) && item.conectores.length > 0
          ? item.conectores.map((c, index) => index === 0 ? { ...c, ...result.data } : c)
          : [{ ...conector, ...result.data }];
        return { ...item, conectores };
      }));
      setShowNgModal(false);
      setPendingConvertidor(null);
    } else {
      Alert.alert('Error', 'No se pudo marcar el convertidor como NG.');
    }
    setUpdatingIds(prev => {
      const next = { ...prev };
      delete next[conector.id];
      return next;
    });
  };

  const handleMarkOk = (convertidor) => {
    const conector = getConector(convertidor);
    if (!conector?.id) {
      Alert.alert('Sin conector', 'No se encontró el conector del convertidor.');
      return;
    }

    Alert.alert(
      'Confirmar OK',
      '¿Marcar este convertidor como OK?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar OK',
          onPress: async () => {
            setUpdatingIds(prev => ({ ...prev, [conector.id]: true }));
            const result = await adaptadorService.updateConectorEstado(conector.id, 'OK');
            if (result.success) {
              setConvertidores(prev => prev.map(item => {
                if (item.id !== convertidor.id) return item;
                const conectores = Array.isArray(item.conectores) && item.conectores.length > 0
                  ? item.conectores.map((c, index) => index === 0 ? { ...c, ...result.data } : c)
                  : [{ ...conector, ...result.data }];
                return { ...item, conectores };
              }));
            } else {
              Alert.alert('Error', 'No se pudo marcar el convertidor como OK.');
            }
            setUpdatingIds(prev => {
              const next = { ...prev };
              delete next[conector.id];
              return next;
            });
          }
        }
      ]
    );
  };

  const getConectorId = (convertidor) => getConector(convertidor)?.id;
  const isSelected = (convertidor) => Boolean(selectedIds[getConectorId(convertidor)]);

  const toggleSelection = (convertidor) => {
    const conectorId = getConectorId(convertidor);
    if (!conectorId) return;
    setSelectedIds(prev => {
      const next = { ...prev };
      if (next[conectorId]) {
        delete next[conectorId];
      } else {
        next[conectorId] = true;
      }
      return next;
    });
  };

  const selectedCount = Object.keys(selectedIds).length;

  const handleOpenBulkUpdate = () => {
    if (!selectedCount) return;
    const selectedItems = filteredConvertidores.filter(item => selectedIds[getConectorId(item)]);
    const payload = selectedItems.map(item => ({
      conectorId: getConectorId(item),
      numero_adaptador: item.numero_adaptador,
      codigo_qr: item.codigo_qr
    }));
    navigation.navigate('UpdateVByOneUsage', {
      items: payload
    });
  };

  const filteredConvertidores = convertidores
    .filter(c => !selectedModelo || c.modelo_adaptador === selectedModelo)
    .filter(c => !onlyNg || hasNgConector(c))
    .filter(c => {
      if (!searchValue) return true;
      const numero = String(c.numero_adaptador || '');
      const suffix = getNumeroSuffix(numero);
      return suffix === searchValue || numero.includes(searchValue);
    });

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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF9800']} />
          }
        >
          <View style={styles.header}>
            <Title style={styles.mainTitle}>Convertidores</Title>
            <Paragraph style={styles.subtitle}>
              Lista de convertidores registrados
            </Paragraph>
          </View>

          {/* Filtros por Modelo */}
          <View style={styles.filtersContainer}>
            {modelos.map((modelo) => {
              const count = convertidores.filter(c => c.modelo_adaptador === modelo).length;
              const isSelected = selectedModelo === modelo;
              const modeloColor = getModeloColor(modelo);
              return (
                <View key={modelo} style={styles.filterButtonWrapper}>
                  <Button
                    mode={isSelected ? 'contained' : 'outlined'}
                    onPress={() => setSelectedModelo(isSelected ? null : modelo)}
                    style={styles.filterButton}
                    buttonColor={isSelected ? modeloColor : undefined}
                  >
                    {modelo}
                  </Button>
                  <View style={[styles.qtyBadge, { backgroundColor: modeloColor }]}>
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
                Solo NG
              </Button>
              <View style={[styles.qtyBadge, styles.ngQtyBadge]}>
                <Paragraph style={styles.qtyText}>{convertidores.filter(hasNgConector).length}</Paragraph>
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
              buttonColor={selectionMode ? '#FF9800' : undefined}
              icon={selectionMode ? 'check-circle' : 'checkbox-multiple-blank-outline'}
            >
              {selectionMode ? 'Cancelar' : 'Seleccionar'}
            </Button>
          </View>

          {selectionMode && (
            <View style={styles.bulkActions}>
              <Paragraph style={styles.bulkText}>
                Seleccionados: {selectedCount}
              </Paragraph>
              <Button
                mode="contained"
                onPress={handleOpenBulkUpdate}
                disabled={!selectedCount}
                buttonColor={selectedCount ? '#FF9800' : '#3A3A3A'}
              >
                Actualizar uso
              </Button>
            </View>
          )}

          <View style={styles.searchContainer}>
            <TextInput
              label="Buscar por últimos dígitos"
              value={searchQuery}
              onChangeText={setSearchQuery}
              mode="outlined"
              style={styles.searchInput}
              placeholder="Ej: 91"
              textColor="#FFFFFF"
              placeholderTextColor="#808080"
              outlineColor="#3A3A3A"
              activeOutlineColor="#FF9800"
              theme={{
                colors: {
                  primary: '#FF9800',
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
              <ActivityIndicator size="large" color="#FF9800" />
            </View>
          ) : (selectedModelo && convertidores.filter(c => c.modelo_adaptador === selectedModelo).length === 0) ? (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Paragraph style={styles.emptyText}>
                  No hay convertidores registrados para el modelo {selectedModelo}.
                </Paragraph>
              </Card.Content>
            </Card>
          ) : selectedModelo ? (
            filteredConvertidores
              .sort((a, b) => parseInt(a.numero_adaptador) - parseInt(b.numero_adaptador))
              .map((convertidor) => (
              <TouchableOpacity
                key={convertidor.id}
                activeOpacity={selectionMode ? 0.7 : 1}
                onPress={() => selectionMode && toggleSelection(convertidor)}
                disabled={!selectionMode}
              >
                <Card style={[
                  styles.itemCard,
                  selectionMode && isSelected(convertidor) && styles.itemCardSelected
                ]}>
                  <Card.Content>
                  <View style={styles.itemHeader}>
                    <Title style={styles.itemTitle}>Convertidor #{convertidor.numero_adaptador}</Title>
                    <Chip
                      icon={getConectorEstado(convertidor) === 'NG' ? 'alert-circle' : 'check-circle'}
                      style={[
                        styles.statusChip,
                        getConectorEstado(convertidor) === 'NG' ? styles.statusChipNg : styles.statusChipOk
                      ]}
                    >
                      {getConectorEstado(convertidor) === 'NG' ? 'NG' : convertidor.estado}
                    </Chip>
                  </View>
                  <Paragraph style={styles.itemText}>QR: {convertidor.codigo_qr}</Paragraph>
                  <View style={styles.conectorRow}>
                    <Chip
                      icon={getConectorEstado(convertidor) === 'NG' ? 'alert-circle' : 'check-circle'}
                      style={[
                        styles.conectorChip,
                        getConectorEstado(convertidor) === 'NG' ? styles.conectorChipNg : styles.conectorChipOk
                      ]}
                    >
                      {getConectorEstado(convertidor) || 'SIN ESTADO'}
                    </Chip>
                    {getConectorEstado(convertidor) === 'NG' ? (
                      <Button
                        mode="contained"
                        style={styles.okButton}
                        buttonColor="#2E7D32"
                        loading={Boolean(updatingIds[getConector(convertidor)?.id])}
                        onPress={() => handleMarkOk(convertidor)}
                      >
                        Marcar OK
                      </Button>
                    ) : (
                      <Button
                        mode="contained"
                        style={styles.ngButton}
                        buttonColor="#E53935"
                        icon="alert-circle"
                        uppercase={false}
                        contentStyle={styles.ngButtonContent}
                        labelStyle={styles.ngButtonLabel}
                        loading={Boolean(updatingIds[getConector(convertidor)?.id])}
                        onPress={() => handleOpenNg(convertidor)}
                      >
                        NG
                      </Button>
                    )}
                  </View>
                  {getConectorEstado(convertidor) === 'NG' && getConector(convertidor)?.comentario_ng ? (
                    <Paragraph style={styles.commentText}>
                      Comentario: {getConector(convertidor).comentario_ng}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(convertidor) === 'NG' && getNgInfo(convertidor)?.tecnico ? (
                    <Paragraph style={styles.ngInfoText}>
                      Reportado por: {getNgInfo(convertidor).tecnico.nombre} ({getNgInfo(convertidor).tecnico.numero_empleado})
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(convertidor) === 'NG' && getNgInfo(convertidor)?.fecha ? (
                    <Paragraph style={styles.ngInfoText}>
                      Fecha NG: {formatDate(getNgInfo(convertidor).fecha)} {formatTime12Hour(getNgInfo(convertidor).fecha)}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(convertidor) === 'OK' && getOkInfo(convertidor)?.tecnico ? (
                    <Paragraph style={styles.okInfoText}>
                      Validado por: {getOkInfo(convertidor).tecnico.nombre} ({getOkInfo(convertidor).tecnico.numero_empleado})
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(convertidor) === 'OK' && getOkInfo(convertidor)?.fecha ? (
                    <Paragraph style={styles.okInfoText}>
                      Fecha OK: {formatDate(getOkInfo(convertidor).fecha)} {formatTime12Hour(getOkInfo(convertidor).fecha)}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(convertidor) === 'OK' && getConector(convertidor)?.linea_ultima_validacion ? (
                    <Paragraph style={styles.okInfoText}>
                      Última línea: {getConector(convertidor).linea_ultima_validacion}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(convertidor) === 'OK' && getConector(convertidor)?.turno_ultima_validacion ? (
                    <Paragraph style={styles.okInfoText}>
                      Último turno: {getConector(convertidor).turno_ultima_validacion}
                    </Paragraph>
                  ) : null}
                </Card.Content>
              </Card>
            </TouchableOpacity>
              ))
          ) : (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Paragraph style={styles.emptyText}>
                  Selecciona un modelo para ver la lista de convertidores.
                </Paragraph>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={showNgModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNgModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNgModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Title style={styles.modalTitle}>Marcar NG</Title>
                <TextInput
                  label="Comentarios"
                  value={ngComment}
                  onChangeText={setNgComment}
                  style={styles.modalInput}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  placeholder="Describe la falla"
                  textColor="#FFFFFF"
                  placeholderTextColor="#B0B0B0"
                  theme={{
                    colors: {
                      primary: '#FF9800',
                      background: '#1F1F1F',
                      surface: '#2C2C2C',
                      text: '#FFFFFF',
                      placeholder: '#B0B0B0',
                    },
                  }}
                />
                <View style={styles.modalButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => setShowNgModal(false)}
                    style={styles.modalCancelButton}
                    textColor="#F44336"
                  >
                    Cancelar
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleConfirmNg}
                    style={styles.modalSaveButton}
                  >
                    Guardar
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    padding: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#1E1E1E',
  },
  ngFilterContainer: {
    alignItems: 'center',
    marginBottom: 16,
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
    minWidth: 120,
  },
  qtyBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
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
    backgroundColor: '#FF9800',
  },
  statusChipOk: {
    backgroundColor: '#2E7D32',
  },
  statusChipNg: {
    backgroundColor: '#C62828',
  },
  itemText: {
    color: '#E0E0E0',
    fontSize: 14,
    marginBottom: 4,
  },
  conectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  conectorChip: {
    borderRadius: 8,
  },
  conectorChipOk: {
    backgroundColor: '#2E7D32',
  },
  conectorChipNg: {
    backgroundColor: '#C62828',
  },
  ngButton: {
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    alignSelf: 'flex-start',
  },
  ngButtonContent: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  ngButtonLabel: {
    fontWeight: '700',
    letterSpacing: 0.2,
    fontSize: 12,
  },
  okButton: {
    borderRadius: 8,
  },
  commentText: {
    color: '#FFCC80',
    fontSize: 13,
    marginTop: 8,
  },
  ngInfoText: {
    color: '#FFCC80',
    fontSize: 12,
    marginTop: 4,
  },
  okInfoText: {
    color: '#B2DFDB',
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    overflow: 'hidden',
    padding: 20,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#1F1F1F',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderColor: '#F44336',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#FF9800',
  },
  selectionModeButton: {
    minWidth: 120,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  bulkText: {
    color: '#E0E0E0',
    fontSize: 14,
  },
  itemCardSelected: {
    borderWidth: 2,
    borderColor: '#FF9800',
  },
});

