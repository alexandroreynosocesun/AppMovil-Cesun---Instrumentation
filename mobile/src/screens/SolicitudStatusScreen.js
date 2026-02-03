import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { authService } from '../services/AuthService';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDate, formatTime12Hour } from '../utils/dateUtils';
import logger from '../utils/logger';

const SolicitudStatusScreen = () => {
  const { t } = useLanguage();
  const route = useRoute();
  const navigation = useNavigation();
  const { usuario } = route.params;
  
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSolicitudStatus();
  }, []);

  const loadSolicitudStatus = async () => {
    try {
      setLoading(true);
      const result = await authService.getSolicitudStatus(usuario);
      
      if (result.success) {
        setSolicitud(result.data);
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      logger.error('Error al cargar estado de solicitud:', error);
      Alert.alert(t('error'), t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSolicitudStatus();
    setRefreshing(false);
  };

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

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'pendiente':
        return '⏳';
      case 'aprobada':
        return '✅';
      case 'rechazada':
        return '❌';
      default:
        return '❓';
    }
  };

  // Función formatDate ahora importada desde dateUtils

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>{t('loadingRequestStatus')}</Text>
      </View>
    );
  }

  if (!solicitud) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('couldNotLoadRequest')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSolicitudStatus}>
          <Text style={styles.retryButtonText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#2196F3']}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('requestStatus')}</Text>
        <Text style={styles.subtitle}>{t('user')} {solicitud.usuario}</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusIcon}>{getEstadoIcon(solicitud.estado)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getEstadoColor(solicitud.estado) }]}>
            <Text style={styles.statusText}>{solicitud.estado.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.statusDescription}>
          {solicitud.estado === 'pendiente' && t('pendingDesc')}
          {solicitud.estado === 'aprobada' && t('approvedDesc')}
          {solicitud.estado === 'rechazada' && t('rejectedDesc')}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>{t('requestInformation')}</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('fullName')}</Text>
          <Text style={styles.infoValue}>{solicitud.nombre}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('employeeNumber')}</Text>
          <Text style={styles.infoValue}>{solicitud.numero_empleado}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('requestDate')}</Text>
          <Text style={styles.infoValue}>{formatDate(solicitud.fecha_solicitud)} {formatTime12Hour(solicitud.fecha_solicitud)}</Text>
        </View>
        
        {solicitud.fecha_respuesta && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('responseDate')}</Text>
            <Text style={styles.infoValue}>{formatDate(solicitud.fecha_respuesta)} {formatTime12Hour(solicitud.fecha_respuesta)}</Text>
          </View>
        )}
      </View>

      {solicitud.comentarios_admin && (
        <View style={styles.commentsCard}>
          <Text style={styles.cardTitle}>{t('adminComments')}</Text>
          <Text style={styles.commentsText}>{solicitud.comentarios_admin}</Text>
        </View>
      )}

      {solicitud.estado === 'aprobada' && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>{t('accountReady')}</Text>
          <Text style={styles.actionDescription}>
            {t('accountReadyDesc')}
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>{t('goToLogin')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {solicitud.estado === 'rechazada' && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>{t('requestRejected')}</Text>
          <Text style={styles.actionDescription}>
            {t('requestRejectedDesc')}
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => {
              // Aquí podrías agregar funcionalidad para contactar al admin
              Alert.alert(t('contactAdmin'), t('contactAdminMessage'));
            }}
          >
            <Text style={styles.contactButtonText}>{t('contactAdmin')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {solicitud.estado === 'pendiente' && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>{t('requestUnderReview')}</Text>
          <Text style={styles.actionDescription}>
            {t('requestUnderReviewDesc')}
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadSolicitudStatus}
          >
            <Text style={styles.refreshButtonText}>Actualizar Estado</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 32,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusDescription: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  commentsCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  commentsText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actionCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
  },
  contactButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SolicitudStatusScreen;
