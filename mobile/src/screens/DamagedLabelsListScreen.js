import React, { useState, useEffect } from 'react';
import { showAlert } from '../utils/alertUtils';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  Chip,
  IconButton,
  Button,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import damagedLabelService, { getImageUrl } from '../services/DamagedLabelService';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

export default function DamagedLabelsListScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [damagedLabels, setDamagedLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const loadDamagedLabels = async () => {
    try {
      setLoading(true);
      logger.info('🔄 [DamagedLabelsListScreen] Cargando reportes de etiquetas NG...');
      const result = await damagedLabelService.getDamagedLabels();

      logger.info('📡 [DamagedLabelsListScreen] Respuesta completa:', JSON.stringify(result, null, 2));

      if (result && result.success) {
        // Manejar respuesta paginada o array directo
        let labelsArray = [];
        
        // Verificar que result.data existe
        if (!result.data) {
          logger.warn('⚠️ [DamagedLabelsListScreen] result.data es undefined o null');
          setDamagedLabels([]);
          return;
        }
        
        if (Array.isArray(result.data)) {
          // Array directo (compatibilidad hacia atrás)
          labelsArray = result.data;
          logger.info('✅ [DamagedLabelsListScreen] Data es un array directo:', labelsArray.length);
        } else if (result.data && typeof result.data === 'object' && result.data.items && Array.isArray(result.data.items)) {
          // Estructura paginada: usar items
          labelsArray = result.data.items;
          logger.info('✅ [DamagedLabelsListScreen] Data es un objeto paginado, extrayendo items:', labelsArray.length, 'de', result.data.total);
        } else {
          logger.warn('⚠️ [DamagedLabelsListScreen] Formato de datos inesperado. Tipo:', typeof result.data, 'Valor:', result.data);
          labelsArray = [];
        }
        
        // Filtrar etiquetas resueltas para que no aparezcan en la lista
        // Asegurarse de que labelsArray es un array antes de filtrar
        const filteredLabels = Array.isArray(labelsArray) 
          ? labelsArray.filter(label => label && label.estado !== 'resuelto')
          : [];
        logger.info(`✅ [DamagedLabelsListScreen] Etiquetas NG (sin resueltas): ${filteredLabels.length}`);
        setDamagedLabels(filteredLabels);
      } else {
        logger.error('❌ [DamagedLabelsListScreen] Error en respuesta. result:', result);
        if (result && result.error === 'UNAUTHORIZED') {
          showAlert(
            'Sesión Expirada',
            'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
            [{ text: 'OK', onPress: logout }]
          );
        } else {
          showAlert('Error', (result && result.error) || 'No se pudieron cargar los reportes');
        }
        setDamagedLabels([]);
      }
    } catch (error) {
      logger.error('❌ [DamagedLabelsListScreen] Error cargando reportes:', error);
      logger.error('❌ [DamagedLabelsListScreen] Error stack:', error.stack);
      logger.error('❌ [DamagedLabelsListScreen] Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      showAlert('Error', 'Error de conexión');
      setDamagedLabels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.tipo_usuario === 'gestion' || user?.tipo_usuario === 'Gestion') {
      loadDamagedLabels();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDamagedLabels();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const result = await damagedLabelService.updateDamagedLabel(id, {
        estado: newStatus,
      });

      if (result.success) {
        if (newStatus === 'resuelto') {
          // Si se marca como resuelto, eliminar inmediatamente de la lista
          setDamagedLabels(prevLabels => prevLabels.filter(label => label.id !== id));
          showAlert('Éxito', 'Etiqueta restaurada. La foto ha sido eliminada y la tarjeta removida.');
        } else {
          // Para otros estados, recargar la lista
          await loadDamagedLabels();
          showAlert('Éxito', 'Estado actualizado correctamente');
        }
      } else {
        showAlert('Error', result.error || 'No se pudo actualizar el estado');
      }
    } catch (error) {
      logger.error('Error actualizando estado:', error);
      showAlert('Error', 'Error al actualizar el estado');
    }
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'pendiente':
        return '#FFC107';
      case 'procesado':
        return '#2196F3';
      case 'resuelto':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (user?.tipo_usuario !== 'gestion' && user?.tipo_usuario !== 'Gestion') {
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <Card.Content>
            <Paragraph style={styles.errorText}>
              Esta pantalla solo está disponible para usuarios de Gestión.
            </Paragraph>
          </Card.Content>
        </Card>
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
            <Title style={styles.title}>Etiquetas NG Reportadas</Title>
            <Paragraph style={styles.subtitle}>
              Reportes de jigs con etiquetas dañadas
            </Paragraph>
          </Card.Content>
        </Card>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Paragraph style={styles.loadingText}>Cargando reportes...</Paragraph>
          </View>
        )}

        {!loading && damagedLabels.length === 0 && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>
                No hay reportes de etiquetas NG por el momento.
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        {!loading && damagedLabels.length > 0 && (
          <>
            {damagedLabels.map((label) => (
              <Card key={label.id} style={styles.labelCard}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Title style={styles.labelTitle}>Modelo: {label.modelo}</Title>
                      <Chip
                        style={[styles.statusChip, { backgroundColor: getStatusColor(label.estado) }]}
                        textStyle={styles.statusChipText}
                      >
                        {label.estado.charAt(0).toUpperCase() + label.estado.slice(1)}
                      </Chip>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Paragraph style={styles.infoLabel}>Tipo:</Paragraph>
                    <Paragraph style={styles.infoValue}>
                      {label.tipo_jig === 'manual' ? 'Manual' :
                       label.tipo_jig === 'semiautomatico' ? 'Semiautomático' :
                       label.tipo_jig === 'new_semiautomatico' ? 'New Semiautomático' :
                       label.tipo_jig}
                    </Paragraph>
                  </View>

                  <View style={styles.infoRow}>
                    <Paragraph style={styles.infoLabel}>Número de Jig Original:</Paragraph>
                    <Paragraph style={styles.infoValue}>{label.numero_jig || 'N/A'}</Paragraph>
                  </View>

                  <View style={styles.infoRow}>
                    <Paragraph style={styles.infoLabel}>Reportado por:</Paragraph>
                    <Paragraph style={styles.infoValue}>
                      {label.reportado_por?.nombre || 'N/A'}
                    </Paragraph>
                  </View>

                  <View style={styles.infoRow}>
                    <Paragraph style={styles.infoLabel}>Fecha:</Paragraph>
                    <Paragraph style={styles.infoValue}>{formatDate(label.created_at)}</Paragraph>
                  </View>

                  {label.foto && (
                    <TouchableOpacity
                      style={styles.photoThumbnail}
                      onPress={() => {
                        setSelectedLabel(label);
                        setShowImageModal(true);
                      }}
                    >
                      <Image 
                        source={{ 
                          uri: getImageUrl(label.foto)
                        }} 
                        style={styles.thumbnailImage} 
                      />
                      <Paragraph style={styles.photoLabel}>Toca para ver foto completa</Paragraph>
                    </TouchableOpacity>
                  )}

                  <View style={styles.actionsRow}>
                    <Button
                      mode="contained"
                      onPress={() => handleUpdateStatus(label.id, 'resuelto')}
                      style={styles.actionButton}
                      buttonColor="#4CAF50"
                      textColor="#FFFFFF"
                    >
                      Etiqueta Restaurada
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Modal para ver foto completa */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalOverlay}
            activeOpacity={1}
            onPress={() => setShowImageModal(false)}
          />
          {selectedLabel?.foto && (
            <View style={styles.imageModalContent}>
              <IconButton
                icon="close"
                size={24}
                iconColor="#FFFFFF"
                style={styles.closeButton}
                onPress={() => setShowImageModal(false)}
              />
              <Image 
                source={{ 
                  uri: getImageUrl(selectedLabel.foto)
                }} 
                style={styles.fullImage} 
              />
            </View>
          )}
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
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#4CAF50',
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
  labelCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  labelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusChipText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
    width: 120,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  photoThumbnail: {
    marginTop: 12,
    marginBottom: 12,
  },
  thumbnailImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#2C2C2C',
  },
  photoLabel: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  imageModalContent: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  errorCard: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
  },
});

