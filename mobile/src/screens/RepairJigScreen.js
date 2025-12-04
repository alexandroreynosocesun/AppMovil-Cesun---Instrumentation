import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  TextInput,
  Divider,
  ActivityIndicator
} from 'react-native-paper';
import { jigNGService } from '../services/JigNGService';
import { jigService } from '../services/JigService';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

export default function RepairJigScreen({ navigation, route }) {
  const { jigNG, fromValidation, validationJig } = route.params;
  const { user } = useAuth();
  
  const [jigInfo, setJigInfo] = useState(null);
  const [loadingJig, setLoadingJig] = useState(true);
  const [observaciones, setObservaciones] = useState(jigNG.observaciones_reparacion || '');
  const [loading, setLoading] = useState(false);
  const [observacionesGuardadas, setObservacionesGuardadas] = useState(!!jigNG.observaciones_reparacion);

  // Cargar información del jig por ID
  useEffect(() => {
    loadJigInfo();
  }, []);

  const loadJigInfo = async () => {
    try {
      setLoadingJig(true);
      const result = await jigService.getJigById(jigNG.jig_id);
      if (result.success) {
        setJigInfo(result.data);
      } else {
        Alert.alert('Error', 'No se pudo cargar la información del jig');
        logger.error('Error cargando jig:', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Error cargando información del jig');
      logger.error('Error cargando jig:', error);
    } finally {
      setLoadingJig(false);
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente': return '#FF9800';
      case 'en_reparacion': return '#2196F3';
      case 'reparado': return '#4CAF50';
      case 'descartado': return '#F44336';
      default: return '#757575';
    }
  };

  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'critica': return '#F44336';
      case 'alta': return '#FF9800';
      case 'media': return '#2196F3';
      case 'baja': return '#4CAF50';
      default: return '#757575';
    }
  };

  // Función formatDate ahora importada desde dateUtils

  const handleUpdateEstado = (nuevoEstado) => {
    Alert.alert(
      'Confirmar Cambio',
      `¿Estás seguro de cambiar el estado a "${nuevoEstado.replace('_', ' ').toUpperCase()}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: () => updateJigNG({ estado: nuevoEstado })
        }
      ]
    );
  };

  const updateJigNG = async (updateData) => {
    try {
      setLoading(true);
      const result = await jigNGService.updateJigNG(jigNG.id, updateData);
      if (result.success) {
        if (updateData.estado === 'reparado') {
          if (fromValidation) {
            // Si viene del flujo de validación, regresar a validación
            Alert.alert(
              'Jig Reparado',
              'El jig ha sido reparado exitosamente. Ahora puedes continuar con la validación.',
              [
                {
                  text: 'Continuar Validación',
                  onPress: () => navigation.navigate('Validation', { jig: validationJig })
                }
              ]
            );
          } else {
            // Si viene del flujo de Jigs NG, regresar a Jigs NG
            Alert.alert(
              'Jig Reparado',
              'El jig ha sido marcado como reparado exitosamente.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('JigNG')
                }
              ]
            );
          }
        } else {
          // Si solo se actualizaron observaciones, no navegar
          setObservacionesGuardadas(true);
          Alert.alert('Éxito', 'Observaciones guardadas correctamente. Ahora puedes marcar el jig como reparado.');
        }
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Error actualizando jig NG');
    } finally {
      setLoading(false);
    }
  };

  const getActionButtons = () => {
    const buttons = [];

    // Solo mostrar botones si está pendiente
    if (jigNG.estado === 'pendiente') {
      buttons.push(
        <Button
          key="falso_defecto"
          mode="contained"
          onPress={() => handleFalsoDefecto()}
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
        >
          Falso Defecto
        </Button>
      );
      
      buttons.push(
        <Button
          key="reparado"
          mode={observacionesGuardadas ? "contained" : "outlined"}
          onPress={() => handleUpdateEstado('reparado')}
          disabled={!observacionesGuardadas}
          style={[
            styles.actionButton, 
            observacionesGuardadas 
              ? { backgroundColor: '#4CAF50' } 
              : { borderColor: '#9E9E9E' }
          ]}
          textColor={observacionesGuardadas ? '#FFFFFF' : '#9E9E9E'}
        >
          {observacionesGuardadas ? '✓ Marcar como Reparado' : 'Marcar como Reparado'}
        </Button>
      );
    }

    return buttons;
  };

  const handleFalsoDefecto = async () => {
    try {
      setLoading(true);
      const result = await jigNGService.updateJigNG(jigNG.id, { 
        estado: 'reparado',
        observaciones_reparacion: 'Falso defecto - No había falla en el jig'
      });
      
      if (result.success) {
        Alert.alert(
          'Falso Defecto Confirmado',
          'El jig ha sido marcado como falso defecto.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('JigNG')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Error marcando como falso defecto');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading mientras se cargan los datos del jig
  if (loadingJig) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Paragraph style={styles.loadingText}>Cargando información del jig...</Paragraph>
      </View>
    );
  }

  // Mostrar error si no se pudo cargar el jig
  if (!jigInfo) {
    return (
      <View style={styles.loadingContainer}>
        <Paragraph style={styles.errorText}>No se pudo cargar la información del jig</Paragraph>
        <Button mode="contained" onPress={loadJigInfo} style={styles.retryButton}>
          Reintentar
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Información del Jig */}
      <Card style={[styles.card, styles.jigInfoCard]}>
        <Card.Content>
          <Title style={styles.sectionTitle}>🔧 Jig a Reparar</Title>
          <View style={styles.jigInfoGrid}>
            <View style={styles.jigInfoRow}>
              <View style={styles.jigInfoItem}>
                <Paragraph style={styles.jigInfoLabel}>Número de Jig</Paragraph>
                <Paragraph style={styles.jigInfoValue}>{jigInfo?.numero_jig || 'N/A'}</Paragraph>
              </View>
              <View style={styles.jigInfoItem}>
                <Paragraph style={styles.jigInfoLabel}>Código QR</Paragraph>
                <Paragraph style={styles.jigInfoValue}>{jigInfo?.codigo_qr || 'N/A'}</Paragraph>
              </View>
            </View>
            <View style={styles.jigInfoRow}>
              <View style={styles.jigInfoItem}>
                <Paragraph style={styles.jigInfoLabel}>Tipo</Paragraph>
                <Paragraph style={styles.jigInfoValue}>{jigInfo?.tipo || 'N/A'}</Paragraph>
              </View>
              <View style={styles.jigInfoItem}>
                <Paragraph style={styles.jigInfoLabel}>Modelo Actual</Paragraph>
                <Paragraph style={styles.jigInfoValue}>{jigInfo?.modelo_actual || 'N/A'}</Paragraph>
              </View>
            </View>
            <View style={styles.jigInfoRow}>
              <View style={styles.jigInfoItem}>
                <Paragraph style={styles.jigInfoLabel}>Estado del Jig</Paragraph>
                <Chip 
                  style={[styles.jigEstadoChip, { backgroundColor: jigInfo?.estado === 'reparacion' ? '#FF9800' : '#4CAF50' }]}
                  textStyle={styles.chipText}
                >
                  {jigInfo?.estado?.toUpperCase() || 'N/A'}
                </Chip>
              </View>
              <View style={styles.jigInfoItem}>
                <Paragraph style={styles.jigInfoLabel}>Fecha de Creación</Paragraph>
                <Paragraph style={styles.jigInfoValue}>
                  {jigInfo?.created_at ? `${formatDate(jigInfo.created_at)} ${formatTime12Hour(jigInfo.created_at)}` : 'N/A'}
                </Paragraph>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Estado y Prioridad del NG */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>⚠️ Estado del Reporte NG</Title>
          <View style={styles.ngStatusContainer}>
            <View style={styles.ngStatusItem}>
              <Paragraph style={styles.ngStatusLabel}>Estado del NG</Paragraph>
              <Chip 
                style={[styles.estadoChip, { backgroundColor: getEstadoColor(jigNG.estado) }]}
                textStyle={styles.chipText}
              >
                {jigNG.estado.replace('_', ' ').toUpperCase()}
              </Chip>
            </View>
            <View style={styles.ngStatusItem}>
              <Paragraph style={styles.ngStatusLabel}>Prioridad</Paragraph>
              <Chip 
                style={[styles.prioridadChip, { backgroundColor: getPrioridadColor(jigNG.prioridad) }]}
                textStyle={styles.chipText}
              >
                {jigNG.prioridad.toUpperCase()}
              </Chip>
            </View>
            <View style={styles.ngStatusItem}>
              <Paragraph style={styles.ngStatusLabel}>Categoría</Paragraph>
              <Chip 
                style={[styles.categoriaChip, { backgroundColor: '#E0E0E0' }]}
                textStyle={styles.chipTextDark}
              >
                {jigNG.categoria?.toUpperCase() || 'FALLA TÉCNICA'}
              </Chip>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Información del Problema */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>🚨 Detalles del Problema</Title>
          
          <View style={styles.problemaSection}>
            <Paragraph style={styles.problemaLabel}>Descripción del Problema</Paragraph>
            <View style={styles.problemaBox}>
              <Paragraph style={styles.problemaText}>{jigNG.motivo}</Paragraph>
            </View>
          </View>
          
          <View style={styles.problemaInfo}>
            <View style={styles.problemaInfoItem}>
              <Paragraph style={styles.problemaInfoLabel}>📅 Fecha del Reporte</Paragraph>
              <Paragraph style={styles.problemaInfoValue}>{formatDate(jigNG.fecha_ng)} {formatTime12Hour(jigNG.fecha_ng)}</Paragraph>
            </View>
            
            <View style={styles.problemaInfoItem}>
              <Paragraph style={styles.problemaInfoLabel}>👤 Técnico que Reportó</Paragraph>
              <Paragraph style={styles.problemaInfoValue}>
                {jigNG.tecnico_ng?.nombre || 'N/A'} 
                {jigNG.tecnico_ng?.numero_empleado && ` (${jigNG.tecnico_ng.numero_empleado})`}
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Información de Reparación */}
      {(jigNG.estado === 'reparado' || jigNG.estado === 'descartado') && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Información de Reparación</Title>
            {jigNG.fecha_reparacion && (
              <View style={styles.infoRow}>
                <Paragraph style={styles.label}>Fecha de Reparación:</Paragraph>
                <Paragraph style={styles.infoValue}>{formatDate(jigNG.fecha_reparacion)} {formatTime12Hour(jigNG.fecha_reparacion)}</Paragraph>
              </View>
            )}
            
            {jigNG.tecnico_reparacion && (
              <View style={styles.infoRow}>
                <Paragraph style={styles.label}>Técnico que reparó:</Paragraph>
                <Paragraph style={styles.infoValue}>{jigNG.tecnico_reparacion.nombre}</Paragraph>
              </View>
            )}
            
            {jigNG.observaciones_reparacion && (
              <View>
                <Paragraph style={styles.label}>Observaciones de Reparación:</Paragraph>
                <View style={styles.observacionesContainer}>
                  <Paragraph style={styles.observacionesText}>
                    {jigNG.observaciones_reparacion}
                  </Paragraph>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Información del Técnico Actual (solo para pendientes) */}
      {jigNG.estado === 'pendiente' && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Técnico Que Repara</Title>
            <View style={styles.infoRow}>
              <Paragraph style={styles.label}>Nombre:</Paragraph>
              <Paragraph style={styles.infoValue}>{user?.nombre || 'N/A'}</Paragraph>
            </View>
            <View style={styles.infoRow}>
              <Paragraph style={styles.label}>Número de Empleado:</Paragraph>
              <Paragraph style={styles.infoValue}>{user?.numero_empleado || 'N/A'}</Paragraph>
            </View>
            <View style={styles.infoRow}>
              <Paragraph style={styles.label}>Turno:</Paragraph>
              <Paragraph style={styles.infoValue}>{user?.turno_actual || 'N/A'}</Paragraph>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Observaciones de Reparación */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Observaciones de Reparación</Title>
          <TextInput
            label="¿Qué se reparó?"
            value={observaciones}
            onChangeText={(text) => {
              setObservaciones(text);
              setObservacionesGuardadas(false);
            }}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Describe qué se reparó en el jig..."
          />
          <Button
            mode={observacionesGuardadas ? "contained" : "outlined"}
            onPress={() => updateJigNG({ observaciones_reparacion: observaciones })}
            style={[
              styles.saveButton,
              observacionesGuardadas ? { backgroundColor: '#4CAF50' } : {}
            ]}
            textColor={observacionesGuardadas ? '#FFFFFF' : '#2196F3'}
          >
            {observacionesGuardadas ? '✓ Observaciones Guardadas' : 'Guardar Observaciones'}
          </Button>
        </Card.Content>
      </Card>

      {/* Botones de Acción */}
      {getActionButtons().length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Acciones</Title>
            {!observacionesGuardadas && (
              <Paragraph style={styles.infoText}>
                ⚠️ Debes guardar las observaciones antes de marcar como reparado
              </Paragraph>
            )}
            {getActionButtons()}
          </Card.Content>
        </Card>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Material Design Dark Surface
  },
  card: {
    margin: 20,
    elevation: 8,
    backgroundColor: '#1E1E1E', // Material Design Dark Surface Variant
    borderWidth: 1,
    borderColor: '#2A2A2A', // Subtle border
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF', // Pure white for better contrast
    letterSpacing: 0.3,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  estadoChip: {
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
  },
  prioridadChip: {
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
  },
  categoriaChip: {
    backgroundColor: '#2A2A2A', // Subtle dark gray
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A3A3A', // Slightly lighter border
  },
  chipText: {
    color: '#FFFFFF', // Pure white for better readability
    fontSize: 11,
    fontWeight: '600',
  },
  motivo: {
    marginTop: 8,
  },
  motivoText: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#2A2A2A', // Consistent with chip background
    borderRadius: 12,
    fontStyle: 'italic',
    borderWidth: 1,
    borderColor: '#3A3A3A', // Consistent border color
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF', // Pure white for better readability
  },
  fecha: {
    marginTop: 12,
  },
  observacionesContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#2A2A2A', // Consistent background
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A', // Consistent border
  },
  observacionesText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#FFFFFF', // Pure white for better readability
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#FFFFFF', // Pure white for better visibility
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF', // Pure white for titles
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 12,
    borderRadius: 12,
  },
  saveButton: {
    marginTop: 12,
    borderRadius: 12,
  },
  actionButton: {
    marginBottom: 12,
    borderRadius: 12,
  },
  infoText: {
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Nuevos estilos para información mejorada del jig
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF', // Pure white for better contrast
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  jigInfoCard: {
    backgroundColor: '#2A2A2A', // Consistent with other elements
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3', // Keep blue accent
    borderWidth: 1,
    borderColor: '#3A3A3A', // Consistent border
    borderRadius: 12, // Slightly more rounded
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  jigInfoGrid: {
    marginTop: 8,
  },
  jigInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  jigInfoItem: {
    flex: 1,
    marginRight: 8,
  },
  jigInfoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B0B0B0', // Keep subtle gray for labels
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jigInfoValue: {
    fontSize: 14,
    color: '#FFFFFF', // Pure white for values
    fontWeight: '600',
  },
  jigEstadoChip: {
    alignSelf: 'flex-start',
  },
  // Estilos para estado del NG
  ngStatusContainer: {
    marginTop: 8,
  },
  ngStatusItem: {
    marginBottom: 12,
  },
  ngStatusLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B0B0B0',
    marginBottom: 4,
  },
  chipTextDark: {
    color: '#E8E8E8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Estilos para información del problema
  problemaSection: {
    marginBottom: 16,
  },
  problemaLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E8E8E8',
    marginBottom: 8,
  },
  problemaBox: {
    backgroundColor: '#2A2A2A', // Consistent background
    padding: 16, // More padding for better spacing
    borderRadius: 12, // More rounded
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800', // Keep orange accent
    borderWidth: 1,
    borderColor: '#3A3A3A', // Consistent border
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  problemaText: {
    fontSize: 14,
    color: '#FFFFFF', // Pure white for better readability
    fontStyle: 'italic',
    lineHeight: 22, // Better line height
  },
  problemaInfo: {
    marginTop: 8,
  },
  problemaInfoItem: {
    marginBottom: 8,
  },
  problemaInfoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B0B0B0',
    marginBottom: 2,
  },
  problemaInfoValue: {
    fontSize: 14,
    color: '#E8E8E8',
  },
  // Estilos para loading y error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#B0B0B0',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2196F3',
  },
});
