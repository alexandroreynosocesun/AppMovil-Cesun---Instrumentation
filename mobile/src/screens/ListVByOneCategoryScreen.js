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

const CATEGORY_CONFIG = {
  vbyone: {
    title: 'VByOne',
    subtitle: 'Lista de VByOne registrados',
    modeloToken: 'VBYONE',
    accentColor: '#FF9800',
  },
  mini_lvds: {
    title: 'Mini LVDS',
    subtitle: 'Lista de Mini LVDS registrados',
    modeloToken: 'MINI_LVDS',
    accentColor: '#4CAF50',
  },
  lvds_2k: {
    title: '2K LVDS',
    subtitle: 'Lista de 2K LVDS registrados',
    modeloToken: 'LVDS_2K',
    accentColor: '#2196F3',
  },
};

export default function ListVByOneCategoryScreen({ route, navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const categoryKey = route?.params?.category || 'vbyone';
  const config = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.vbyone;
  const isFocused = useIsFocused();
  const isSelectionEnabled = ['mini_lvds', 'vbyone', 'lvds_2k'].includes(categoryKey);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState({});
  const [showNgModal, setShowNgModal] = useState(false);
  const [ngComment, setNgComment] = useState('');
  const [pendingItem, setPendingItem] = useState(null);
  const [onlyNg, setOnlyNg] = useState(false);
  const [onlyDual, setOnlyDual] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [togglingDualIds, setTogglingDualIds] = useState({});

  useEffect(() => {
    if (isFocused) {
      loadItems();
      setSelectedIds({}); // Limpiar selecciones al volver
    }
  }, [isFocused, categoryKey]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setSelectedIds({});
      const result = await adaptadorService.getAdaptadores(null, config.modeloToken, {
        includeConectores: true,
        includeTecnicos: true
      });
      if (result.success) {
        const token = String(config.modeloToken || '').toUpperCase();
        const filtered = (result.data || []).filter(item =>
          String(item.modelo_adaptador || '').toUpperCase().includes(token)
        );
        setItems(filtered);
      } else {
        logger.error('Error cargando items:', result.error);
        setItems([]);
      }
    } catch (error) {
      logger.error('Error cargando items:', error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadItems();
  };

  const getConectorEstado = (item) =>
    item?.conectores?.[0]?.estado || null;

  const getConector = (item) => item?.conectores?.[0] || null;
  const hasNgConector = (item) => getConectorEstado(item) === 'NG';
  const normalizeSearch = (value) => String(value || '').trim();
  const searchValue = normalizeSearch(searchQuery);
  const getNumeroSuffix = (value) => {
    const text = String(value || '');
    const parts = text.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  const getNgInfo = (item) => {
    const conector = getConector(item);
    if (!conector) return null;
    return {
      tecnico: conector.tecnico_ng,
      fecha: conector.fecha_estado_ng
    };
  };

  const getOkInfo = (item) => {
    const conector = getConector(item);
    if (!conector) return null;
    return {
      tecnico: conector.tecnico_ultima_validacion,
      fecha: conector.fecha_ultima_validacion
    };
  };

  const getConectorId = (item) => getConector(item)?.id;
  const isSelected = (item) => Boolean(selectedIds[getConectorId(item)]);

  const toggleSelection = (item) => {
    const conectorId = getConectorId(item);
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
    const selectedItems = items.filter(item => selectedIds[getConectorId(item)]);
    const payload = selectedItems.map(item => ({
      conectorId: getConectorId(item),
      numero_adaptador: item.numero_adaptador,
      codigo_qr: item.codigo_qr
    }));
    navigation.navigate('UpdateVByOneUsage', {
      category: categoryKey,
      items: payload
    });
  };

  const handleOpenNg = (item) => {
    const conector = getConector(item);
    if (!conector?.id) {
      Alert.alert('Sin conector', 'No se encontró el conector del componente.');
      return;
    }
    setPendingItem(item);
    setNgComment('');
    setShowNgModal(true);
  };

  const handleConfirmNg = async () => {
    const conector = getConector(pendingItem);
    if (!conector?.id) {
      setShowNgModal(false);
      setPendingItem(null);
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
      setItems(prev => prev.map(item => {
        if (item.id !== pendingItem.id) return item;
        const conectores = Array.isArray(item.conectores) && item.conectores.length > 0
          ? item.conectores.map((c, index) => index === 0 ? { ...c, ...result.data } : c)
          : [{ ...conector, ...result.data }];
        return { ...item, conectores };
      }));
      setShowNgModal(false);
      setPendingItem(null);
    } else {
      Alert.alert('Error', 'No se pudo marcar como NG.');
    }
    setUpdatingIds(prev => {
      const next = { ...prev };
      delete next[conector.id];
      return next;
    });
  };

  const handleMarkOk = (item) => {
    const conector = getConector(item);
    if (!conector?.id) {
      Alert.alert('Sin conector', 'No se encontró el conector del componente.');
      return;
    }

    Alert.alert(
      'Confirmar OK',
      '¿Marcar este componente como OK?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar OK',
          onPress: async () => {
            setUpdatingIds(prev => ({ ...prev, [conector.id]: true }));
            const result = await adaptadorService.updateConectorEstado(conector.id, 'OK');
            if (result.success) {
              setItems(prev => prev.map(entry => {
                if (entry.id !== item.id) return entry;
                const conectores = Array.isArray(entry.conectores) && entry.conectores.length > 0
                  ? entry.conectores.map((c, index) => index === 0 ? { ...c, ...result.data } : c)
                  : [{ ...conector, ...result.data }];
                return { ...entry, conectores };
              }));
            } else {
              Alert.alert('Error', 'No se pudo marcar como OK.');
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

  const filteredItems = items
    .filter(item => !onlyNg || hasNgConector(item))
    .filter(item => !onlyDual || item.es_dual_conector)
    .filter(item => {
      if (!searchValue) return true;
      const numero = String(item.numero_adaptador || '');
      const suffix = getNumeroSuffix(numero);
      return suffix === searchValue || numero.includes(searchValue);
    });

  const handleToggleDual = async (item) => {
    if (togglingDualIds[item.id]) return;

    setTogglingDualIds(prev => ({ ...prev, [item.id]: true }));
    try {
      const result = await adaptadorService.toggleDualConector(item.id);
      if (result.success) {
        setItems(prev => prev.map(entry =>
          entry.id === item.id ? { ...entry, es_dual_conector: result.data.es_dual_conector } : entry
        ));
      } else {
        Alert.alert('Error', 'No se pudo actualizar el estado 51+41');
      }
    } catch (error) {
      logger.error('Error toggling dual:', error);
      Alert.alert('Error', 'No se pudo actualizar');
    } finally {
      setTogglingDualIds(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.accentColor]} />
          }
        >
          <View style={styles.header}>
            <Title style={styles.mainTitle}>{config.title}</Title>
            <Paragraph style={styles.subtitle}>
              {config.subtitle}
            </Paragraph>
          </View>

          {/* Filtros y Modo Selección */}
          <View style={styles.ngFilterContainer}>
            <View style={styles.filtersRow}>
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
                  <Paragraph style={styles.qtyText}>{items.filter(hasNgConector).length}</Paragraph>
                </View>
              </View>
              {/* Filtro 51+41 - Solo para VByOne */}
              {categoryKey === 'vbyone' && (
                <View style={styles.filterButtonWrapper}>
                  <Button
                    mode={onlyDual ? 'contained' : 'outlined'}
                    onPress={() => setOnlyDual(!onlyDual)}
                    style={styles.dualFilterButton}
                    buttonColor={onlyDual ? '#9C27B0' : undefined}
                    icon="connection"
                  >
                    51+41
                  </Button>
                  <View style={[styles.qtyBadge, styles.dualQtyBadge]}>
                    <Paragraph style={styles.qtyText}>{items.filter(item => item.es_dual_conector).length}</Paragraph>
                  </View>
                </View>
              )}
            </View>
            {isSelectionEnabled && (
              <Button
                mode={selectionMode ? 'contained' : 'outlined'}
                onPress={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) {
                    setSelectedIds({});
                  }
                }}
                style={styles.selectionModeButton}
                buttonColor={selectionMode ? config.accentColor : undefined}
                icon={selectionMode ? 'check-circle' : 'checkbox-multiple-blank-outline'}
              >
                {selectionMode ? 'Cancelar' : 'Seleccionar'}
              </Button>
            )}
          </View>

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
              activeOutlineColor={config.accentColor}
              theme={{
                colors: {
                  primary: config.accentColor,
                  background: '#1E1E1E',
                  surface: '#1E1E1E',
                  text: '#FFFFFF',
                  placeholder: '#808080',
                }
              }}
            />
          </View>

          {isSelectionEnabled && selectionMode && (
            <View style={styles.bulkActions}>
              <Paragraph style={styles.bulkText}>
                Seleccionados: {selectedCount}
              </Paragraph>
              <Button
                mode="contained"
                onPress={handleOpenBulkUpdate}
                disabled={!selectedCount}
                buttonColor={selectedCount ? config.accentColor : '#3A3A3A'}
              >
                Actualizar uso
              </Button>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={config.accentColor} />
            </View>
          ) : filteredItems.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Paragraph style={styles.emptyText}>
                  No hay registros para mostrar.
                </Paragraph>
              </Card.Content>
            </Card>
          ) : (
            filteredItems
              .sort((a, b) => parseInt(a.numero_adaptador) - parseInt(b.numero_adaptador))
              .map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={selectionMode ? 0.7 : 1}
                onPress={() => selectionMode && toggleSelection(item)}
                disabled={!selectionMode}
              >
                <Card style={[
                  styles.itemCard,
                  selectionMode && isSelected(item) && styles.itemCardSelected
                ]}>
                  <Card.Content>
                  <View style={styles.itemHeader}>
                    <View style={styles.titleWithBadge}>
                      <Title style={styles.itemTitle}>#{item.numero_adaptador}</Title>
                      {categoryKey === 'vbyone' && item.es_dual_conector && (
                        <Chip style={styles.dualBadge} textStyle={styles.dualBadgeText}>
                          51+41
                        </Chip>
                      )}
                    </View>
                    <Chip
                      icon={getConectorEstado(item) === 'NG' ? 'alert-circle' : 'check-circle'}
                      style={[
                        styles.statusChip,
                        getConectorEstado(item) === 'NG' ? styles.statusChipNg : styles.statusChipOk
                      ]}
                    >
                      {getConectorEstado(item) === 'NG' ? 'NG' : item.estado}
                    </Chip>
                  </View>
                  <Paragraph style={styles.itemText}>QR: {item.codigo_qr}</Paragraph>
                  <View style={styles.conectorRow}>
                    <Chip
                      icon={getConectorEstado(item) === 'NG' ? 'alert-circle' : 'check-circle'}
                      style={[
                        styles.conectorChip,
                        getConectorEstado(item) === 'NG' ? styles.conectorChipNg : styles.conectorChipOk
                      ]}
                    >
                      {getConectorEstado(item) || 'SIN ESTADO'}
                    </Chip>
                    <View style={styles.actionButtons}>
                      {getConectorEstado(item) === 'NG' ? (
                        <Button
                          mode="contained"
                          style={styles.okButton}
                          buttonColor="#2E7D32"
                          loading={Boolean(updatingIds[getConector(item)?.id])}
                          onPress={() => handleMarkOk(item)}
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
                          loading={Boolean(updatingIds[getConector(item)?.id])}
                          onPress={() => handleOpenNg(item)}
                        >
                          NG
                        </Button>
                      )}
                      {/* Botón 51+41 - Solo para VByOne */}
                      {categoryKey === 'vbyone' && (
                        <Button
                          mode={item.es_dual_conector ? 'contained' : 'outlined'}
                          style={styles.dualButton}
                          buttonColor={item.es_dual_conector ? '#9C27B0' : undefined}
                          textColor={item.es_dual_conector ? '#FFFFFF' : '#9C27B0'}
                          icon="connection"
                          uppercase={false}
                          contentStyle={styles.dualButtonContent}
                          labelStyle={styles.dualButtonLabel}
                          loading={Boolean(togglingDualIds[item.id])}
                          onPress={() => handleToggleDual(item)}
                        >
                          51+41
                        </Button>
                      )}
                    </View>
                  </View>
                  {getConectorEstado(item) === 'NG' && getConector(item)?.comentario_ng ? (
                    <Paragraph style={styles.commentText}>
                      Comentario: {getConector(item).comentario_ng}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(item) === 'NG' && getNgInfo(item)?.tecnico ? (
                    <Paragraph style={styles.ngInfoText}>
                      Reportado por: {getNgInfo(item).tecnico.nombre} ({getNgInfo(item).tecnico.numero_empleado})
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(item) === 'NG' && getNgInfo(item)?.fecha ? (
                    <Paragraph style={styles.ngInfoText}>
                      Fecha NG: {formatDate(getNgInfo(item).fecha)} {formatTime12Hour(getNgInfo(item).fecha)}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(item) === 'OK' && getOkInfo(item)?.tecnico ? (
                    <Paragraph style={styles.okInfoText}>
                      Validado por: {getOkInfo(item).tecnico.nombre} ({getOkInfo(item).tecnico.numero_empleado})
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(item) === 'OK' && getOkInfo(item)?.fecha ? (
                    <Paragraph style={styles.okInfoText}>
                      Fecha OK: {formatDate(getOkInfo(item).fecha)} {formatTime12Hour(getOkInfo(item).fecha)}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(item) === 'OK' && getConector(item)?.linea_ultima_validacion ? (
                    <Paragraph style={styles.okInfoText}>
                      Última línea: {getConector(item).linea_ultima_validacion}
                    </Paragraph>
                  ) : null}
                  {getConectorEstado(item) === 'OK' && getConector(item)?.turno_ultima_validacion ? (
                    <Paragraph style={styles.okInfoText}>
                      Último turno: {getConector(item).turno_ultima_validacion}
                    </Paragraph>
                  ) : null}
                </Card.Content>
              </Card>
            </TouchableOpacity>
              ))
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
                      primary: config.accentColor,
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
                    buttonColor={config.accentColor}
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
  ngFilterContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterButtonWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  ngFilterButton: {
    minWidth: 120,
  },
  dualFilterButton: {
    minWidth: 120,
    borderColor: '#9C27B0',
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
  dualQtyBadge: {
    backgroundColor: '#9C27B0',
  },
  searchContainer: {
    marginBottom: 12,
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
  searchInput: {
    backgroundColor: '#1E1E1E',
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
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dualBadge: {
    backgroundColor: '#9C27B0',
    height: 24,
    borderRadius: 12,
  },
  dualBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  dualButton: {
    borderRadius: 8,
    borderColor: '#9C27B0',
  },
  dualButtonContent: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dualButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectButton: {
    borderRadius: 8,
  },
  selectButtonSelected: {
    borderColor: '#4CAF50',
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
  },
  selectionModeButton: {
    minWidth: 120,
  },
  itemCardSelected: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
});
