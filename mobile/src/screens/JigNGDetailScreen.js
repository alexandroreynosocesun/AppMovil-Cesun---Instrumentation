import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  Divider,
  TextInput,
} from 'react-native-paper';
import { jigNGService } from '../services/JigNGService';
import { authService } from '../services/AuthService';
import logger from '../utils/logger';

export default function JigNGDetailScreen({ route, navigation }) {
  const { jigId } = route.params;
  const [jig, setJig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [repairComment, setRepairComment] = useState('');
  const [repairingUser, setRepairingUser] = useState('');
  const [selectedAction, setSelectedAction] = useState(null); // 'falso_defecto' o 'reparado'
  const [currentUser, setCurrentUser] = useState(null);
  const [commentSaved, setCommentSaved] = useState(false); // Para saber si el comentario ya fue guardado

  useEffect(() => {
    loadJigDetails();
    loadCurrentUser();
  }, [jigId]);

  const loadJigDetails = async () => {
    try {
      setLoading(true);
      const result = await jigNGService.getJigNGById(jigId);
      
      if (result.success) {
        setJig(result.data);
      } else {
        Alert.alert('Error', result.message || 'Error al cargar detalles del jig NG');
        navigation.goBack();
      }
    } catch (error) {
      logger.error('❌ Error al cargar jig NG:', error);
      Alert.alert('Error', 'Error inesperado al cargar detalles');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const result = await authService.getProfile();
      if (result.success) {
        setCurrentUser(result.data);
        setRepairingUser(result.data.nombre || result.data.username || 'Usuario actual');
      }
    } catch (error) {
      logger.error('❌ Error al cargar usuario actual:', error);
      setRepairingUser('Usuario actual');
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!jig) return;

    try {
      setUpdating(true);
      const updateData = { 
        estado: newStatus,
        ...(repairingUser && { usuario_reparando: repairingUser })
      };
      
      const result = await jigNGService.updateJigNG(jigId, updateData);
      
      if (result.success) {
        setJig(prev => ({ ...prev, estado: newStatus, usuario_reparando: repairingUser }));
        
        // Si se marca como reparado o falso defecto, regresar (la lista se recargará automáticamente)
        if (newStatus === 'reparado' || newStatus === 'falso_defecto') {
          const mensaje = newStatus === 'reparado' 
            ? 'Jig NG marcado como reparado. La tarjeta ha sido eliminada y el jig está disponible para validación.'
            : 'Jig NG marcado como falso defecto. La tarjeta ha sido eliminada y el jig está disponible para validación.';
          Alert.alert(
            'Éxito', 
            mensaje,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          Alert.alert('Éxito', 'Estado actualizado correctamente');
        }
      } else {
        Alert.alert('Error', result.message || 'Error al actualizar estado');
      }
    } catch (error) {
      logger.error('❌ Error al actualizar estado:', error);
      Alert.alert('Error', 'Error inesperado al actualizar estado');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddRepairComment = async () => {
    // El comentario es opcional, no validamos si está vacío
    
    try {
      setUpdating(true);
      const result = await jigNGService.updateJigNG(jigId, { 
        comentario_reparacion: repairComment.trim() || null,
        usuario_reparando: repairingUser || currentUser?.nombre || currentUser?.username || 'Usuario actual'
      });
      
      if (result.success) {
        setJig(prev => ({ 
          ...prev, 
          comentario_reparacion: repairComment.trim() || null,
          usuario_reparando: repairingUser || 'Usuario actual'
        }));
        
        // Marcar que el comentario fue guardado
        setCommentSaved(true);
        
        Alert.alert('Éxito', 'Comentario guardado correctamente');
      } else {
        Alert.alert('Error', result.message || 'Error al guardar comentario');
      }
    } catch (error) {
      logger.error('❌ Error al guardar comentario:', error);
      Alert.alert('Error', 'Error inesperado al guardar comentario');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedAction) return;
    
    // Si se selecciona "reparado", actualizar estado
    if (selectedAction === 'reparado') {
      await handleStatusUpdate('reparado');
    } else if (selectedAction === 'falso_defecto') {
      await handleStatusUpdate('falso_defecto');
    }
  };

  const handleCancel = () => {
    setSelectedAction(null);
    setRepairComment('');
    setRepairingUser('');
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Jig NG',
      '¿Estás seguro de que quieres eliminar este jig NG?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await jigNGService.deleteJigNG(jigId);
              if (result.success) {
                Alert.alert(
                  'Éxito',
                  'Jig NG eliminado correctamente',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar jig NG');
              }
            } catch (error) {
              logger.error('❌ Error al eliminar jig NG:', error);
              Alert.alert('Error', 'Error inesperado al eliminar jig NG');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (estado) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente':
        return '#FF9800';
      case 'en reparación':
        return '#2196F3';
      case 'reparado':
        return '#4CAF50';
      case 'retirado':
        return '#F44336';
      case 'falso_defecto':
        return '#9C27B0';
      default:
        return '#9E9E9E';
    }
  };

  const capitalizeStatus = (estado) => {
    if (!estado) return 'Sin Estado';
    if (estado === 'falso_defecto') return 'Falso Defecto';
    return estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando detalles...</Text>
      </View>
    );
  }

  if (!jig) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No se pudo cargar el jig NG</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Volver
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 200 : 50}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >


      {/* Información del Jig */}
      <Card style={styles.infoCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>📋 Información del Jig</Title>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Número:</Text>
            <Text style={styles.infoValue}>{jig.jig?.numero_jig || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Código QR:</Text>
            <Text style={styles.infoValue}>{jig.jig?.codigo_qr || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Modelo:</Text>
            <Text style={styles.infoValue}>{jig.jig?.modelo_actual || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>{jig.jig?.tipo || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado del Jig:</Text>
            <Text style={[styles.infoValue, { color: jig.jig?.estado === 'activo' ? '#4CAF50' : '#F44336' }]}>
              {jig.jig?.estado || 'N/A'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Información del Reporte */}
      <Card style={styles.infoCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>👤 Información del Reporte</Title>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reportado por:</Text>
            <Text style={styles.infoValue}>{jig.tecnico_ng?.nombre || jig.usuario_reporte || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Número de Empleado:</Text>
            <Text style={styles.infoValue}>{jig.tecnico_ng?.numero_empleado || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de Reporte:</Text>
            <Text style={styles.infoValue}>{formatDate(jig.fecha_ng)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Técnico que repara:</Text>
            <Text style={styles.infoValue}>{currentUser?.nombre || currentUser?.username || jig.tecnico_reparacion?.nombre || jig.usuario_reparando || 'Sin asignar'}</Text>
          </View>
          
          {jig.fecha_reparacion && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha de Reparación:</Text>
              <Text style={styles.infoValue}>{formatDate(jig.fecha_reparacion)}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

      {/* Descripción del Problema */}
      <Card style={styles.infoCard}>
          <Card.Content>
          <Title style={styles.cardTitle}>🔧 Descripción del Problema</Title>
          <Paragraph style={styles.problemDescription}>
            {jig.motivo || 'Sin descripción disponible'}
            </Paragraph>
          
          {/* Mostrar foto si existe */}
          {jig.foto && (
            <View style={styles.photoContainer}>
              <Image 
                source={{ uri: jig.foto }} 
                style={styles.photoPreview}
                resizeMode="cover"
              />
            </View>
          )}
          </Card.Content>
        </Card>

      {/* Comentarios de Reparación */}
      <Card style={styles.infoCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>💬 Comentarios de Reparación</Title>
          
          <TextInput
            label="¿Qué se reparó?"
            value={repairComment}
            onChangeText={setRepairComment}
            style={[styles.commentInput, { color: '#FFFFFF' }]}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Describe qué se reparó en este jig..."
            textColor="#FFFFFF"
            placeholderTextColor="#B0B0B0"
            returnKeyType="done"
            blurOnSubmit={true}
            scrollEnabled={false}
            theme={{
              colors: {
                primary: '#2196F3',
                background: '#1E1E1E',
                surface: '#2C2C2C',
                text: '#FFFFFF',
                placeholder: '#B0B0B0',
              }
            }}
          />
          
          <View style={styles.commentActions}>
          <Button
              mode="contained"
              onPress={handleAddRepairComment}
              style={styles.saveCommentButton}
              disabled={updating || !repairComment.trim()}
            >
              {updating ? 'Guardando...' : 'Guardar Comentario'}
          </Button>
          </View>
          
          {jig.comentario_reparacion && (
            <View style={styles.existingComment}>
              <Text style={styles.existingCommentLabel}>Comentario actual:</Text>
              <Paragraph style={styles.existingCommentText}>
                {jig.comentario_reparacion}
              </Paragraph>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Botones de Acción - Solo mostrar si el comentario fue guardado y no está reparado */}
      {commentSaved && jig?.estado !== 'reparado' && (
        <>
          <View style={styles.bottomButtons}>
            <Button
              mode={selectedAction === 'falso_defecto' ? 'contained' : 'outlined'}
              onPress={() => setSelectedAction('falso_defecto')}
              style={[
                styles.actionButton,
                selectedAction === 'falso_defecto' && styles.selectedButton
              ]}
              labelStyle={[
                styles.actionButtonLabel,
                selectedAction === 'falso_defecto' && styles.selectedButtonLabel
              ]}
            >
              🚫 Falso Defecto
            </Button>
            
            <Button
              mode={selectedAction === 'reparado' ? 'contained' : 'outlined'}
              onPress={() => setSelectedAction('reparado')}
              style={[
                styles.actionButton,
                selectedAction === 'reparado' && styles.selectedButton
              ]}
              labelStyle={[
                styles.actionButtonLabel,
                selectedAction === 'reparado' && styles.selectedButtonLabel
              ]}
            >
              ✅ Reparado
            </Button>
          </View>

          <View style={styles.bottomButtons}>
            <Button
              mode="contained"
              onPress={handleSaveChanges}
              style={[
                styles.saveButton,
                selectedAction ? styles.saveButtonEnabled : styles.saveButtonDisabled
              ]}
              labelStyle={styles.saveButtonLabel}
              disabled={!selectedAction || updating}
            >
              {updating ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonLabel}
              disabled={updating}
            >
              Cancelar
            </Button>
          </View>
        </>
      )}

      {updating && (
        <View style={styles.updatingContainer}>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={styles.updatingText}>Actualizando estado...</Text>
        </View>
      )}


      {/* Modal para Agregar Comentario */}
      <Modal
        visible={showCommentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (selectedAction !== 'reparado') {
            setShowCommentModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>
              {selectedAction === 'reparado' ? 'Comentario de Reparación (Obligatorio)' : 'Agregar Comentario de Reparación'}
            </Title>
            
            <TextInput
              label="Técnico que Repara"
              value={repairingUser}
              onChangeText={setRepairingUser}
              style={styles.modalInput}
              mode="outlined"
              placeholder="Nombre del técnico"
            />
            
            <TextInput
              label="Comentario de Reparación"
              value={repairComment}
              onChangeText={setRepairComment}
              style={styles.modalInput}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="Describe qué se reparó..."
            />
            
            <View style={styles.modalButtons}>
              <Button
                mode="contained"
                onPress={handleAddRepairComment}
                style={styles.saveButton}
                disabled={updating}
              >
                {updating ? 'Guardando...' : 'Guardar'}
              </Button>
              
              {selectedAction !== 'reparado' && (
                <Button
                  mode="outlined"
                  onPress={() => {
                    setShowCommentModal(false);
                    setRepairComment('');
                    setRepairingUser('');
                  }}
                  style={styles.cancelButton}
                >
                  Cancelar
                </Button>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 150,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 32,
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  headerCard: {
    backgroundColor: '#1E1E1E',
    margin: 16,
    marginBottom: 8,
    elevation: 4,
    borderRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jigNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusChip: {
    borderRadius: 16,
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginVertical: 4,
    elevation: 2,
    borderRadius: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    color: '#E0E0E0',
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  problemDescription: {
    color: '#E0E0E0',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  photoContainer: {
    marginTop: 16,
  },
  photoPreview: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    backgroundColor: '#2C2C2C',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addCommentButton: {
    borderColor: '#2196F3',
  },
  addCommentButtonLabel: {
    color: '#2196F3',
    fontSize: 14,
  },
  commentDescription: {
    color: '#E0E0E0',
    fontSize: 16,
    lineHeight: 24,
  },
  falsoDefectoContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  falsoDefectoButton: {
    borderColor: '#9C27B0',
  },
  falsoDefectoButtonLabel: {
    color: '#9C27B0',
    fontSize: 14,
  },
  actionsCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginVertical: 4,
    elevation: 2,
    borderRadius: 12,
  },
  actionsDescription: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 16,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    minWidth: 120,
    borderColor: '#666666',
  },
  activeStatusButton: {
    backgroundColor: '#2196F3',
  },
  statusButtonLabel: {
    color: '#E0E0E0',
    fontSize: 12,
  },
  activeStatusButtonLabel: {
    color: '#FFFFFF',
  },
  dangerCard: {
    backgroundColor: '#1E1E1E',
    margin: 16,
    marginTop: 8,
    elevation: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  dangerTitle: {
    color: '#F44336',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  deleteButton: {
    borderColor: '#F44336',
  },
  deleteButtonLabel: {
    color: '#F44336',
    fontSize: 16,
  },
  updatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  updatingText: {
    color: '#B0B0B0',
    marginLeft: 8,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentModal: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    minWidth: 320,
    maxWidth: 400,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 16,
    backgroundColor: '#2C2C2C',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderColor: '#666666',
  },
  modalCancelButtonLabel: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#2196F3',
  },
  modalSaveButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    margin: 16,
    minWidth: 300,
    maxWidth: 400,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 16,
    backgroundColor: '#2C2C2C',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  falsoDefectoButton: {
    borderColor: '#9C27B0',
  },
  falsoDefectoButtonLabel: {
    color: '#9C27B0',
  },
  reparadoButton: {
    borderColor: '#4CAF50',
  },
  reparadoButtonLabel: {
    color: '#4CAF50',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  cancelButton: {
    borderColor: '#666666',
    marginRight: 8,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  selectedButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonLabel: {
    fontSize: 14,
  },
  selectedButtonLabel: {
    color: '#FFFFFF',
  },
  saveButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  saveButtonEnabled: {
    backgroundColor: '#4CAF50',
  },
  saveButtonDisabled: {
    backgroundColor: '#666666',
  },
  saveButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  cancelButtonLabel: {
    color: '#666666',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addCommentButton: {
    borderColor: '#2196F3',
  },
  addCommentButtonLabel: {
    color: '#2196F3',
    fontSize: 12,
  },
  commentInput: {
    marginBottom: 16,
    backgroundColor: '#2C2C2C',
    color: '#FFFFFF',
    fontSize: 16,
  },
  commentActions: {
    marginBottom: 16,
  },
  saveCommentButton: {
    backgroundColor: '#2196F3',
  },
  existingComment: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  existingCommentLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  existingCommentText: {
    color: '#E0E0E0',
    fontSize: 14,
    lineHeight: 20,
  },
});
