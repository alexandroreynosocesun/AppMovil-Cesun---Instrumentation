import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image
} from 'react-native';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';
import { useFocusEffect } from '@react-navigation/native';
import AdminService from '../services/AdminService';

const AdminSolicitudesScreen = ({ navigation }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [actionType, setActionType] = useState(''); // 'aprobar' o 'rechazar'
  const [processing, setProcessing] = useState(false);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadSolicitudes();
  }, []);

  // Recargar cuando la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      loadSolicitudes();
    }, [])
  );

  const loadSolicitudes = async () => {
    try {
      setLoading(true);
      const result = await AdminService.getSolicitudesPendientes();
      
      if (result.success) {
        setSolicitudes(result.data);
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('Error al cargar solicitudes:', error);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSolicitudes();
    setRefreshing(false);
  };

  const handleAprobar = (solicitud) => {
    setSelectedSolicitud(solicitud);
    setActionType('aprobar');
    setComentarios('');
    setModalVisible(true);
  };

  const handleRechazar = (solicitud) => {
    setSelectedSolicitud(solicitud);
    setActionType('rechazar');
    setComentarios('');
    setModalVisible(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedSolicitud) return;

    if (actionType === 'rechazar' && !comentarios.trim()) {
      Alert.alert('Error', 'Los comentarios son obligatorios para rechazar una solicitud');
      return;
    }

    try {
      setProcessing(true);
      let result;

      if (actionType === 'aprobar') {
        result = await AdminService.aprobarSolicitud(selectedSolicitud.id, comentarios);
      } else {
        result = await AdminService.rechazarSolicitud(selectedSolicitud.id, comentarios);
      }

      if (result.success) {
        Alert.alert(
          'Éxito',
          actionType === 'aprobar' 
            ? 'Solicitud aprobada correctamente' 
            : 'Solicitud rechazada correctamente',
          [
            {
              text: 'OK',
              onPress: () => {
                setModalVisible(false);
                setSelectedSolicitud(null);
                setComentarios('');
                setActionType('');
                loadSolicitudes();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Error procesando la solicitud');
      }
    } catch (error) {
      console.error('Error al procesar solicitud:', error);
      Alert.alert(
        'Error', 
        'Error de conexión. Verifica que el backend esté funcionando.',
        [
          {
            text: 'OK',
            onPress: () => {
              setModalVisible(false);
              setSelectedSolicitud(null);
              setComentarios('');
              setActionType('');
            }
          }
        ]
      );
    } finally {
      setProcessing(false);
    }
  };

  // Función formatDate ahora importada desde dateUtils

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente':
        return '#FFA500';
      case 'aprobada':
        return '#4CAF50';
      case 'rechazada':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const renderSolicitud = ({ item }) => (
    <View style={styles.solicitudCard}>
      <View style={styles.solicitudHeader}>
        <Text style={styles.usuarioText}>{item.usuario}</Text>
        <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(item.estado) }]}>
          <Text style={styles.estadoText}>{item.estado.toUpperCase()}</Text>
        </View>
      </View>
      
      <Text style={styles.nombreText}>{item.nombre}</Text>
      <Text style={styles.empleadoText}>Empleado: {item.numero_empleado}</Text>
      <Text style={styles.fechaText}>
        {formatDate(item.fecha_solicitud)} {formatTime12Hour(item.fecha_solicitud)}
      </Text>

      {item.firma_digital && (
        <View style={styles.firmaContainer}>
          <Text style={styles.firmaLabel}>Firma digital:</Text>
          <Image 
            source={{ uri: `data:image/png;base64,${item.firma_digital}` }}
            style={styles.firmaImage}
            resizeMode="contain"
          />
        </View>
      )}

      {item.estado === 'pendiente' && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.aprobarButton]}
            onPress={() => handleAprobar(item)}
          >
            <Text style={styles.actionButtonText}>✓ Aprobar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.rechazarButton]}
            onPress={() => handleRechazar(item)}
          >
            <Text style={styles.actionButtonText}>✗ Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.comentarios_admin && (
        <View style={styles.comentariosContainer}>
          <Text style={styles.comentariosLabel}>Comentarios del admin:</Text>
          <Text style={styles.comentariosText}>{item.comentarios_admin}</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando solicitudes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Solicitudes de Registro</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadSolicitudes}
        >
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {solicitudes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay solicitudes pendientes</Text>
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          renderItem={renderSolicitud}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2196F3']}
            />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Modal para aprobar/rechazar */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setModalVisible(false);
            setSelectedSolicitud(null);
            setComentarios('');
            setActionType('');
          }}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {actionType === 'aprobar' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
            </Text>
            
            <Text style={styles.modalSubtitle}>
              {selectedSolicitud?.usuario} - {selectedSolicitud?.nombre}
            </Text>

            <TextInput
              style={styles.comentariosInput}
              placeholder={
                actionType === 'aprobar' 
                  ? 'Comentarios (opcional)' 
                  : 'Motivo del rechazo (obligatorio)'
              }
              value={comentarios}
              onChangeText={setComentarios}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedSolicitud(null);
                  setComentarios('');
                  setActionType('');
                }}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  actionType === 'aprobar' ? styles.confirmButton : styles.rejectButton
                ]}
                onPress={handleConfirmAction}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionType === 'aprobar' ? 'Aprobar' : 'Rechazar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8E8E8',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#B0B0B0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  solicitudCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  solicitudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  usuarioText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8E8E8',
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  estadoText: {
    color: '#E8E8E8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nombreText: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  empleadoText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  fechaText: {
    fontSize: 12,
    color: '#E8E8E8',
    marginBottom: 8,
  },
  firmaContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  firmaLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  firmaImage: {
    width: 100,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  aprobarButton: {
    backgroundColor: '#4CAF50',
  },
  rechazarButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#E8E8E8',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  comentariosContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  comentariosLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B0B0B0',
    marginBottom: 4,
  },
  comentariosText: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8E8E8',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 16,
  },
  comentariosInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    marginBottom: 20,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  cancelButtonText: {
    color: '#E8E8E8',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#E8E8E8',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default AdminSolicitudesScreen;
