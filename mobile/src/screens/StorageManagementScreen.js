import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  Surface,
  Divider,
  Text,
  IconButton,
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import auditoriaService from '../services/AuditoriaService';
import { LinearGradient } from 'expo-linear-gradient';
import logger from '../utils/logger';

export default function StorageManagementScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageStatus, setStorageStatus] = useState(null);
  const [diskUsage, setDiskUsage] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [compressing, setCompressing] = useState(false);

  // Verificar que el usuario es adminAlex
  const isAdminAlex = user?.usuario === 'adminAlex';

  useEffect(() => {
    if (isAdminAlex) {
      loadStorageData();
    } else {
      Alert.alert('Acceso Denegado', 'Solo el administrador puede acceder a esta pantalla');
      navigation.goBack();
    }
  }, [isAdminAlex]);

  const loadStorageData = async () => {
    try {
      setLoading(true);
      
      // Cargar estado del almacenamiento
      const statusResult = await auditoriaService.getStorageStatus();
      if (statusResult.success) {
        setStorageStatus(statusResult.data);
      }
      
      // Cargar uso del disco
      const diskResult = await auditoriaService.getDiskUsage();
      if (diskResult.success) {
        setDiskUsage(diskResult.data);
      }
    } catch (error) {
      logger.error('Error cargando datos de almacenamiento:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de almacenamiento');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCleanup = async (days = 365) => {
    Alert.alert(
      'Limpiar PDFs Antiguos',
      `¿Deseas eliminar PDFs más antiguos de ${days} días?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            try {
              setCleaning(true);
              const result = await auditoriaService.cleanupPDFs(days);
              if (result.success) {
                Alert.alert(
                  'Limpieza Completada',
                  result.data.message || 'PDFs eliminados exitosamente'
                );
                loadStorageData(); // Recargar datos
              } else {
                Alert.alert('Error', result.message || 'Error al limpiar PDFs');
              }
            } catch (error) {
              logger.error('Error limpiando PDFs:', error);
              Alert.alert('Error', 'Error al limpiar PDFs');
            } finally {
              setCleaning(false);
            }
          }
        }
      ]
    );
  };

  const handleCompress = async (days = 180) => {
    Alert.alert(
      'Comprimir PDFs Antiguos',
      `¿Deseas comprimir PDFs más antiguos de ${days} días?\n\nLos PDFs se comprimirán en archivos ZIP para ahorrar espacio.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprimir',
          onPress: async () => {
            try {
              setCompressing(true);
              const result = await auditoriaService.compressPDFs(days);
              if (result.success) {
                Alert.alert(
                  'Compresión Completada',
                  result.data.message || 'PDFs comprimidos exitosamente'
                );
                loadStorageData(); // Recargar datos
              } else {
                Alert.alert('Error', result.message || 'Error al comprimir PDFs');
              }
            } catch (error) {
              logger.error('Error comprimiendo PDFs:', error);
              Alert.alert('Error', 'Error al comprimir PDFs');
            } finally {
              setCompressing(false);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical': return '#F44336';
      case 'warning': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'critical': return 'alert-circle';
      case 'warning': return 'alert';
      default: return 'check-circle';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Cargando información de almacenamiento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadStorageData}
            colors={['#9C27B0']}
            tintColor="#9C27B0"
          />
        }
      >
        {/* Estado del Disco */}
        {diskUsage && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <IconButton icon="harddisk" size={24} iconColor="#2196F3" />
                <Title style={styles.cardTitle}>Uso del Disco</Title>
              </View>
              <Divider style={styles.divider} />
              
              <View style={styles.diskInfoContainer}>
                <View style={styles.diskInfoRow}>
                  <Text style={styles.diskInfoLabel}>Total:</Text>
                  <Text style={styles.diskInfoValue}>{diskUsage.disk_usage.total_gb} GB</Text>
                </View>
                <View style={styles.diskInfoRow}>
                  <Text style={styles.diskInfoLabel}>Usado:</Text>
                  <Text style={styles.diskInfoValue}>{diskUsage.disk_usage.used_gb} GB</Text>
                </View>
                <View style={styles.diskInfoRow}>
                  <Text style={styles.diskInfoLabel}>Disponible:</Text>
                  <Text style={styles.diskInfoValue}>{diskUsage.disk_usage.free_gb} GB</Text>
                </View>
                <View style={styles.diskInfoRow}>
                  <Text style={styles.diskInfoLabel}>Porcentaje usado:</Text>
                  <Text style={[styles.diskInfoValue, { color: getStatusColor(diskUsage.status) }]}>
                    {diskUsage.disk_usage.percent_used}%
                  </Text>
                </View>
              </View>

              {diskUsage.status !== 'ok' && (
                <Surface style={[styles.alertSurface, { backgroundColor: getStatusColor(diskUsage.status) + '20' }]}>
                  <View style={styles.alertContent}>
                    <IconButton 
                      icon={getStatusIcon(diskUsage.status)} 
                      size={20} 
                      iconColor={getStatusColor(diskUsage.status)} 
                    />
                    <Text style={[styles.alertText, { color: getStatusColor(diskUsage.status) }]}>
                      {diskUsage.message}
                    </Text>
                  </View>
                </Surface>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Estado del Almacenamiento */}
        {storageStatus && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <IconButton icon="database" size={24} iconColor="#9C27B0" />
                <Title style={styles.cardTitle}>Almacenamiento de PDFs</Title>
              </View>
              <Divider style={styles.divider} />
              
              <View style={styles.storageInfoContainer}>
                <View style={styles.storageInfoRow}>
                  <Text style={styles.storageInfoLabel}>PDFs activos:</Text>
                  <Text style={styles.storageInfoValue}>{storageStatus.pdf_count}</Text>
                </View>
                <View style={styles.storageInfoRow}>
                  <Text style={styles.storageInfoLabel}>Tamaño total PDFs:</Text>
                  <Text style={styles.storageInfoValue}>{storageStatus.pdf_total_size_mb} MB</Text>
                </View>
                <View style={styles.storageInfoRow}>
                  <Text style={styles.storageInfoLabel}>Archivos comprimidos:</Text>
                  <Text style={styles.storageInfoValue}>{storageStatus.archive_count}</Text>
                </View>
                <View style={styles.storageInfoRow}>
                  <Text style={styles.storageInfoLabel}>Tamaño comprimidos:</Text>
                  <Text style={styles.storageInfoValue}>{storageStatus.archive_total_size_mb} MB</Text>
                </View>
              </View>

              <Chip 
                icon={getStatusIcon(storageStatus.status)}
                style={[styles.statusChip, { backgroundColor: getStatusColor(storageStatus.status) + '20' }]}
                textStyle={{ color: getStatusColor(storageStatus.status) }}
              >
                Estado: {storageStatus.status === 'ok' ? 'Normal' : storageStatus.status === 'warning' ? 'Advertencia' : 'Crítico'}
              </Chip>
            </Card.Content>
          </Card>
        )}

        {/* Acciones de Limpieza */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <IconButton icon="broom" size={24} iconColor="#FF9800" />
              <Title style={styles.cardTitle}>Limpieza de PDFs</Title>
            </View>
            <Divider style={styles.divider} />
            
            <Paragraph style={styles.description}>
              Elimina PDFs antiguos para liberar espacio en el disco. Los PDFs eliminados no se pueden recuperar.
            </Paragraph>

            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                onPress={() => handleCleanup(180)}
                style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                icon="delete-sweep"
                loading={cleaning}
                disabled={cleaning || compressing}
              >
                Limpiar PDFs >6 meses
              </Button>

              <Button
                mode="contained"
                onPress={() => handleCleanup(365)}
                style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                icon="delete-forever"
                loading={cleaning}
                disabled={cleaning || compressing}
              >
                Limpiar PDFs >1 año
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Acciones de Compresión */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <IconButton icon="archive" size={24} iconColor="#2196F3" />
              <Title style={styles.cardTitle}>Compresión de PDFs</Title>
            </View>
            <Divider style={styles.divider} />
            
            <Paragraph style={styles.description}>
              Comprime PDFs antiguos en archivos ZIP para ahorrar espacio. Los PDFs comprimidos siguen siendo accesibles.
            </Paragraph>

            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                onPress={() => handleCompress(180)}
                style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                icon="zip-box"
                loading={compressing}
                disabled={cleaning || compressing}
              >
                Comprimir PDFs >6 meses
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Información del Sistema */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <IconButton icon="information" size={24} iconColor="#4CAF50" />
              <Title style={styles.cardTitle}>Información</Title>
            </View>
            <Divider style={styles.divider} />
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                • La limpieza automática se ejecuta diariamente a las 2:00 AM
              </Text>
              <Text style={styles.infoText}>
                • Los PDFs se comprimen automáticamente después de 6 meses
              </Text>
              <Text style={styles.infoText}>
                • Los PDFs se eliminan automáticamente después de 1 año
              </Text>
              <Text style={styles.infoText}>
                • Si el disco está por llenarse, se limpia más agresivamente
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: '#1E1E1E',
    margin: 16,
    marginBottom: 8,
    elevation: 4,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#333333',
  },
  diskInfoContainer: {
    gap: 12,
  },
  diskInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diskInfoLabel: {
    color: '#B0B0B0',
    fontSize: 16,
    fontWeight: '500',
  },
  diskInfoValue: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertSurface: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  storageInfoContainer: {
    gap: 12,
  },
  storageInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageInfoLabel: {
    color: '#B0B0B0',
    fontSize: 16,
    fontWeight: '500',
  },
  storageInfoValue: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusChip: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  description: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 16,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    marginTop: 8,
  },
  infoContainer: {
    gap: 8,
  },
  infoText: {
    color: '#B0B0B0',
    fontSize: 14,
    lineHeight: 20,
  },
});

