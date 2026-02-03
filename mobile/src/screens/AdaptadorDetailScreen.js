import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Modal, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Chip, ActivityIndicator, Divider, TextInput, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { adaptadorService } from '../services/AdaptadorService';
import logger from '../utils/logger';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';

export default function AdaptadorDetailScreen({ navigation, route }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [adaptador, setAdaptador] = useState(route?.params?.adaptador || null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState({});
  const [showNgModal, setShowNgModal] = useState(false);
  const [ngComment, setNgComment] = useState('');
  const [pendingConector, setPendingConector] = useState(null);

  useEffect(() => {
    if (!adaptador && route?.params?.codigo_qr) {
      loadAdaptador();
    }
  }, [route?.params?.codigo_qr]);

  const loadAdaptador = async () => {
    try {
      setLoading(true);
      const codigo_qr = route?.params?.codigo_qr;
      const result = await adaptadorService.getAdaptadorByQR(codigo_qr);
      if (result.success) {
        setAdaptador(result.data);
      } else {
        logger.error('Error cargando adaptador:', result.error);
        Alert.alert('Error', 'No se pudo cargar la información del adaptador');
        navigation.goBack();
      }
    } catch (error) {
      logger.error('Error cargando adaptador:', error);
      Alert.alert('Error', 'Error al cargar la información');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (adaptador?.codigo_qr) {
      setRefreshing(true);
      loadAdaptador();
    }
  };

  if (loading && !adaptador) {
    return (
      <View style={[styles.container, isWeb && webStyles.container]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </View>
    );
  }

  if (!adaptador) {
    return (
      <View style={[styles.container, isWeb && webStyles.container]}>
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Paragraph style={styles.emptyText}>
              No se pudo cargar la información del adaptador.
            </Paragraph>
          </Card.Content>
        </Card>
      </View>
    );
  }

  // Determinar si es adaptador o convertidor basado en el modelo
  const isAdaptador =
    adaptador.modelo_adaptador === 'ADA20100_01' ||
    adaptador.modelo_adaptador === 'ADA20100_02' ||
    adaptador.modelo_adaptador === 'CSTH-100/ZH-S20';
  const tipo = isAdaptador ? 'Adaptador' : 'Convertidor';
  const isExcludedConector = (nombre) =>
    Boolean(nombre) && (nombre.includes('CSTH-100') || nombre.includes('ZH-S20'));

  const getPairedConectorName = (nombre) => {
    switch (nombre) {
      case 'ZH-MINI-HD-1':
        return 'ZH-MINI-HD-3';
      case 'ZH-MINI-HD-3':
        return 'ZH-MINI-HD-1';
      case 'ZH-MINI-HD-2':
        return 'ZH-MINI-HD-4';
      case 'ZH-MINI-HD-4':
        return 'ZH-MINI-HD-2';
      default:
        return null;
    }
  };

  const handleUpdateConectorEstado = async (conector, estado, comentario = null) => {
    if (!conector?.id) return;

    const pairName = getPairedConectorName(conector.nombre_conector);
    const pairConector = pairName
      ? (adaptador.conectores || []).find(c => c.nombre_conector === pairName)
      : null;

    const targets = [conector, pairConector].filter(Boolean);
    const targetIds = targets.map(t => t.id);

    setUpdatingIds(prev => ({
      ...prev,
      ...Object.fromEntries(targetIds.map(id => [id, true]))
    }));

    try {
      const results = await Promise.all(
        targets.map(t => adaptadorService.updateConectorEstado(t.id, estado, comentario))
      );

      const failed = results.find(r => !r.success);
      if (failed) {
        Alert.alert('Error', failed.error || 'No se pudo actualizar el conector.');
        return false;
      }

      await loadAdaptador();
      return true;
    } catch (error) {
      logger.error('Error actualizando conector:', error);
      Alert.alert('Error', 'No se pudo actualizar el conector.');
      return false;
    } finally {
      setUpdatingIds(prev => {
        const next = { ...prev };
        targetIds.forEach(id => {
          delete next[id];
        });
        return next;
      });
    }
  };

  const handleToggleConectorEstado = (conector) => {
    const nextEstado = conector?.estado === 'OK' ? 'NG' : 'OK';
    if (nextEstado === 'NG') {
      setPendingConector(conector);
      setNgComment('');
      setShowNgModal(true);
      return;
    }

    Alert.alert(
      'Confirmar OK',
      '¿Confirmas que este conector queda en OK?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => handleUpdateConectorEstado(conector, nextEstado, null)
        }
      ]
    );
  };

  const handleConfirmNg = async () => {
    if (!pendingConector) {
      setShowNgModal(false);
      return;
    }

    const trimmedComment = ngComment.trim();
    if (!trimmedComment) {
      Alert.alert('Falta comentario', 'Escribe la falla antes de marcar NG.');
      return;
    }

    const ok = await handleUpdateConectorEstado(pendingConector, 'NG', trimmedComment);
    if (ok) {
      setShowNgModal(false);
      setPendingConector(null);
    }
  };

  // Agrupar conectores pareados (1 con 3, 2 con 4)
  const groupedConectores = () => {
    const allConectores = (adaptador.conectores || [])
      .filter(c => !isExcludedConector(c.nombre_conector));

    const grouped = [];
    const processed = new Set();

    allConectores.forEach(conector => {
      if (processed.has(conector.id)) return;

      const pairName = getPairedConectorName(conector.nombre_conector);
      const pairConector = pairName
        ? allConectores.find(c => c.nombre_conector === pairName && !processed.has(c.id))
        : null;

      if (pairConector) {
        // Agrupar conectores pareados
        grouped.push({
          isPaired: true,
          primary: conector,
          secondary: pairConector,
          // El estado es NG si alguno de los dos está NG
          combinedEstado: (conector.estado === 'NG' || pairConector.estado === 'NG') ? 'NG' : 'OK'
        });
        processed.add(conector.id);
        processed.add(pairConector.id);
      } else {
        // Conector individual
        grouped.push({
          isPaired: false,
          primary: conector,
          combinedEstado: conector.estado
        });
        processed.add(conector.id);
      }
    });

    // Ordenar: OK primero, NG al final
    return grouped.sort((a, b) => {
      if (a.combinedEstado === 'NG' && b.combinedEstado === 'OK') return 1;
      if (a.combinedEstado === 'OK' && b.combinedEstado === 'NG') return -1;
      return 0;
    });
  };

  const conectores = groupedConectores();

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
          {/* Información Principal */}
          <Card style={styles.mainCard}>
            <Card.Content>
              <View style={styles.headerSection}>
                <Title style={styles.mainTitle}>
                  {tipo} #{adaptador.numero_adaptador}
                </Title>
                <Chip 
                  icon={adaptador.estado === 'activo' ? 'check-circle' : 'alert-circle'}
                  style={[
                    styles.statusChip,
                    adaptador.estado === 'activo' ? styles.statusChipActive : styles.statusChipInactive
                  ]}
                >
                  {adaptador.estado}
                </Chip>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Paragraph style={styles.infoLabel}>Código QR:</Paragraph>
                  <Paragraph style={styles.infoValue}>{adaptador.codigo_qr}</Paragraph>
                </View>

                <View style={styles.infoRow}>
                  <Paragraph style={styles.infoLabel}>Modelo:</Paragraph>
                  <Paragraph style={styles.infoValue}>{adaptador.modelo_adaptador}</Paragraph>
                </View>

                {adaptador.created_at && (
                  <View style={styles.infoRow}>
                    <Paragraph style={styles.infoLabel}>Fecha de Registro:</Paragraph>
                    <Paragraph style={styles.infoValue}>
                      {formatDate(adaptador.created_at)} {formatTime12Hour(adaptador.created_at)}
                    </Paragraph>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Conectores */}
          <Card style={styles.conectoresCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>
                Conectores ({conectores.length})
              </Title>

              <Divider style={styles.divider} />

              {conectores.length === 0 ? (
                <Paragraph style={styles.emptyText}>
                  No hay conectores registrados para este {tipo.toLowerCase()}.
                </Paragraph>
              ) : (
                conectores.map((group, index) => (
                  <View key={group.primary.id || index}>
                    <View style={styles.conectorItem}>
                      <View style={styles.conectorHeader}>
                        <Paragraph style={styles.conectorName}>
                          {group.isPaired
                            ? `${group.primary.nombre_conector} / ${group.secondary.nombre_conector.replace('ZH-MINI-', '')}`
                            : group.primary.nombre_conector}
                        </Paragraph>
                        <Chip
                          icon={group.combinedEstado === 'OK' ? 'check-circle' : 'alert-circle'}
                          style={[
                            styles.conectorStatusChip,
                            group.combinedEstado === 'OK' ? styles.conectorStatusOK : styles.conectorStatusNG
                          ]}
                          onPress={() => handleToggleConectorEstado(group.primary)}
                          disabled={Boolean(updatingIds[group.primary.id]) || (group.isPaired && Boolean(updatingIds[group.secondary.id]))}
                        >
                          {group.combinedEstado}
                        </Chip>
                      </View>

                      {group.isPaired ? (
                        <>
                          {/* Si está NG, mostrar fecha NG y comentarios */}
                          {group.combinedEstado === 'NG' ? (
                            <>
                              {/* Mostrar fecha NG - compartida si es la misma, separada si son diferentes */}
                              {(() => {
                                const primaryNgDate = group.primary.estado === 'NG' ? group.primary.fecha_estado_ng : null;
                                const secondaryNgDate = group.secondary.estado === 'NG' ? group.secondary.fecha_estado_ng : null;

                                // Si ambos tienen fecha NG y son la misma, mostrar solo una vez
                                if (primaryNgDate && secondaryNgDate) {
                                  const primaryFormatted = `${formatDate(primaryNgDate)} ${formatTime12Hour(primaryNgDate)}`;
                                  const secondaryFormatted = `${formatDate(secondaryNgDate)} ${formatTime12Hour(secondaryNgDate)}`;

                                  if (primaryFormatted === secondaryFormatted) {
                                    return (
                                      <Paragraph style={styles.conectorInfo}>
                                        Fecha NG: {primaryFormatted}
                                      </Paragraph>
                                    );
                                  } else {
                                    return (
                                      <>
                                        <Paragraph style={styles.conectorInfo}>
                                          {group.primary.nombre_conector}: Fecha NG {primaryFormatted}
                                        </Paragraph>
                                        <Paragraph style={styles.conectorInfo}>
                                          {group.secondary.nombre_conector}: Fecha NG {secondaryFormatted}
                                        </Paragraph>
                                      </>
                                    );
                                  }
                                }

                                // Si solo uno tiene fecha NG
                                return (
                                  <>
                                    {primaryNgDate && (
                                      <Paragraph style={styles.conectorInfo}>
                                        {group.primary.nombre_conector}: Fecha NG {formatDate(primaryNgDate)} {formatTime12Hour(primaryNgDate)}
                                      </Paragraph>
                                    )}
                                    {secondaryNgDate && (
                                      <Paragraph style={styles.conectorInfo}>
                                        {group.secondary.nombre_conector}: Fecha NG {formatDate(secondaryNgDate)} {formatTime12Hour(secondaryNgDate)}
                                      </Paragraph>
                                    )}
                                  </>
                                );
                              })()}

                              {/* Mostrar comentarios NG */}
                              {(() => {
                                const primaryNg = group.primary.estado === 'NG' ? group.primary.comentario_ng : null;
                                const secondaryNg = group.secondary.estado === 'NG' ? group.secondary.comentario_ng : null;

                                if (primaryNg && secondaryNg && primaryNg === secondaryNg) {
                                  return (
                                    <Paragraph style={styles.conectorInfo}>
                                      {primaryNg}
                                    </Paragraph>
                                  );
                                }

                                return (
                                  <>
                                    {primaryNg && (
                                      <Paragraph style={styles.conectorInfo}>
                                        {group.primary.nombre_conector}: {primaryNg}
                                      </Paragraph>
                                    )}
                                    {secondaryNg && (
                                      <Paragraph style={styles.conectorInfo}>
                                        {group.secondary.nombre_conector}: {secondaryNg}
                                      </Paragraph>
                                    )}
                                  </>
                                );
                              })()}

                              {/* Mostrar técnico y turno que reportó NG */}
                              {(() => {
                                const primaryDate = group.primary.estado === 'NG' && group.primary.fecha_estado_ng ? new Date(group.primary.fecha_estado_ng) : null;
                                const secondaryDate = group.secondary.estado === 'NG' && group.secondary.fecha_estado_ng ? new Date(group.secondary.fecha_estado_ng) : null;
                                const mostRecent = (!primaryDate && secondaryDate) ? group.secondary :
                                                  (!secondaryDate && primaryDate) ? group.primary :
                                                  (primaryDate && secondaryDate && secondaryDate > primaryDate) ? group.secondary : group.primary;

                                const tecnico = mostRecent.tecnico_ng?.nombre || mostRecent.tecnico_ultima_validacion?.nombre;
                                const turno = mostRecent.turno_ultima_validacion;

                                if (tecnico || turno) {
                                  const parts = [];
                                  if (tecnico) parts.push(tecnico);
                                  if (turno) parts.push(`T${turno}`);

                                  return (
                                    <Paragraph style={styles.conectorInfo}>
                                      {parts.join(' - ')}
                                    </Paragraph>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          ) : (
                            <>
                              {/* Si está OK, mostrar fecha de validación */}
                              {(() => {
                                const primaryFecha = group.primary.fecha_ultima_validacion;
                                const secondaryFecha = group.secondary.fecha_ultima_validacion;

                                if (primaryFecha && secondaryFecha) {
                                  const primaryFormatted = `${formatDate(primaryFecha)} ${formatTime12Hour(primaryFecha)}`;
                                  const secondaryFormatted = `${formatDate(secondaryFecha)} ${formatTime12Hour(secondaryFecha)}`;

                                  if (primaryFormatted === secondaryFormatted) {
                                    return (
                                      <Paragraph style={styles.conectorInfo}>
                                        Fecha OK: {primaryFormatted}
                                      </Paragraph>
                                    );
                                  } else {
                                    return (
                                      <>
                                        <Paragraph style={styles.conectorInfo}>
                                          {group.primary.nombre_conector}: Fecha OK {primaryFormatted}
                                        </Paragraph>
                                        <Paragraph style={styles.conectorInfo}>
                                          {group.secondary.nombre_conector}: Fecha OK {secondaryFormatted}
                                        </Paragraph>
                                      </>
                                    );
                                  }
                                }

                                return (
                                  <>
                                    {primaryFecha && (
                                      <Paragraph style={styles.conectorInfo}>
                                        {group.primary.nombre_conector}: Fecha OK {formatDate(primaryFecha)} {formatTime12Hour(primaryFecha)}
                                      </Paragraph>
                                    )}
                                    {secondaryFecha && (
                                      <Paragraph style={styles.conectorInfo}>
                                        {group.secondary.nombre_conector}: Fecha OK {formatDate(secondaryFecha)} {formatTime12Hour(secondaryFecha)}
                                      </Paragraph>
                                    )}
                                  </>
                                );
                              })()}

                              {/* Mostrar línea si existe */}
                              {(() => {
                                const primaryDate = group.primary.fecha_ultima_validacion ? new Date(group.primary.fecha_ultima_validacion) : null;
                                const secondaryDate = group.secondary.fecha_ultima_validacion ? new Date(group.secondary.fecha_ultima_validacion) : null;
                                const mostRecent = (!primaryDate && secondaryDate) ? group.secondary :
                                                  (!secondaryDate && primaryDate) ? group.primary :
                                                  (primaryDate && secondaryDate && secondaryDate > primaryDate) ? group.secondary : group.primary;

                                const linea = mostRecent.linea_ultima_validacion;

                                if (linea) {
                                  return (
                                    <Paragraph style={styles.conectorInfo}>
                                      Línea: {linea}
                                    </Paragraph>
                                  );
                                }
                                return null;
                              })()}

                              {/* Mostrar técnico y turno que validó */}
                              {(() => {
                                const primaryDate = group.primary.fecha_ultima_validacion ? new Date(group.primary.fecha_ultima_validacion) : null;
                                const secondaryDate = group.secondary.fecha_ultima_validacion ? new Date(group.secondary.fecha_ultima_validacion) : null;
                                const mostRecent = (!primaryDate && secondaryDate) ? group.secondary :
                                                  (!secondaryDate && primaryDate) ? group.primary :
                                                  (primaryDate && secondaryDate && secondaryDate > primaryDate) ? group.secondary : group.primary;

                                const tecnico = mostRecent.tecnico_ultima_validacion?.nombre;
                                const turno = mostRecent.turno_ultima_validacion;

                                if (tecnico || turno) {
                                  const parts = [];
                                  if (tecnico) parts.push(tecnico);
                                  if (turno) parts.push(`T${turno}`);

                                  return (
                                    <Paragraph style={styles.conectorInfo}>
                                      {parts.join(' - ')}
                                    </Paragraph>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Conector individual */}
                          {group.primary.estado === 'NG' ? (
                            <>
                              {group.primary.fecha_estado_ng && (
                                <Paragraph style={styles.conectorInfo}>
                                  Fecha NG: {formatDate(group.primary.fecha_estado_ng)} {formatTime12Hour(group.primary.fecha_estado_ng)}
                                </Paragraph>
                              )}
                              {group.primary.comentario_ng && (
                                <Paragraph style={styles.conectorInfo}>
                                  {group.primary.comentario_ng}
                                </Paragraph>
                              )}
                              {(() => {
                                const tecnico = group.primary.tecnico_ng?.nombre || group.primary.tecnico_ultima_validacion?.nombre;
                                const turno = group.primary.turno_ultima_validacion;

                                if (tecnico || turno) {
                                  const parts = [];
                                  if (tecnico) parts.push(tecnico);
                                  if (turno) parts.push(`T${turno}`);

                                  return (
                                    <Paragraph style={styles.conectorInfo}>
                                      {parts.join(' - ')}
                                    </Paragraph>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          ) : (
                            <>
                              {group.primary.fecha_ultima_validacion && (
                                <>
                                  <Paragraph style={styles.conectorInfo}>
                                    Fecha OK: {formatDate(group.primary.fecha_ultima_validacion)} {formatTime12Hour(group.primary.fecha_ultima_validacion)}
                                  </Paragraph>
                                  {group.primary.linea_ultima_validacion && (
                                    <Paragraph style={styles.conectorInfo}>
                                      Línea: {group.primary.linea_ultima_validacion}
                                    </Paragraph>
                                  )}
                                  {(() => {
                                    const tecnico = group.primary.tecnico_ultima_validacion?.nombre;
                                    const turno = group.primary.turno_ultima_validacion;

                                    if (tecnico || turno) {
                                      const parts = [];
                                      if (tecnico) parts.push(tecnico);
                                      if (turno) parts.push(`T${turno}`);

                                      return (
                                        <Paragraph style={styles.conectorInfo}>
                                          {parts.join(' - ')}
                                        </Paragraph>
                                      );
                                    }
                                    return null;
                                  })()}
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </View>
                    {index < conectores.length - 1 && <Divider style={styles.conectorDivider} />}
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>

      {/* Opciones de conectores deshabilitadas para pruebas */}
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
                      primary: '#4CAF50',
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
    paddingTop: 40,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainCard: {
    backgroundColor: '#2A2A2A',
    marginBottom: 20,
    borderRadius: 12,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  statusChip: {
    marginLeft: 10,
  },
  statusChipActive: {
    backgroundColor: '#4CAF50',
  },
  statusChipInactive: {
    backgroundColor: '#F44336',
  },
  divider: {
    backgroundColor: '#444444',
    marginVertical: 16,
  },
  infoSection: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  conectoresCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
  },
  conectorItem: {
    paddingVertical: 12,
  },
  conectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conectorName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  conectorStatusChip: {
    marginLeft: 10,
  },
  conectorStatusOK: {
    backgroundColor: '#4CAF50',
  },
  conectorStatusNG: {
    backgroundColor: '#F44336',
  },
  conectorInfo: {
    color: '#E0E0E0',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 0,
  },
  conectorDivider: {
    backgroundColor: '#444444',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    width: '82%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 10,
    backgroundColor: '#2C2C2C',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  modalCancelButton: {
    flex: 1,
    borderColor: '#F44336',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  emptyCard: {
    backgroundColor: '#2A2A2A',
    margin: 20,
  },
});

