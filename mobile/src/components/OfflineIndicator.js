import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { offlineService } from '../services/OfflineService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

const OfflineIndicator = ({ onSyncPress }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Verificar estado inicial
    checkNetworkStatus();
    loadPendingCount();

    // Listener para cambios de red
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
      if (state.isConnected && state.isInternetReachable) {
        // Si se recupera la conexión, intentar sincronizar
        handleAutoSync();
      }
    });

    // Verificar periódicamente el conteo pendiente
    const interval = setInterval(loadPendingCount, 5000);

    // Animar entrada si hay datos pendientes
    if (pendingCount > 0 && !isOnline) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: -100,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      }).start();
    }

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [pendingCount, isOnline]);

  const checkNetworkStatus = async () => {
    const status = await offlineService.getNetworkStatus();
    setIsOnline(status.isConnected && status.isInternetReachable);
  };

  const loadPendingCount = async () => {
    try {
      const count = await offlineService.getPendingSyncCount();
      setPendingCount(count.total);
    } catch (error) {
      logger.error('Error cargando conteo pendiente:', error);
    }
  };

  const handleAutoSync = async () => {
    if (syncInProgress) return;
    
    setSyncInProgress(true);
    try {
      const result = await offlineService.syncPendingData();
      if (result.success) {
        await loadPendingCount();
      }
    } catch (error) {
      logger.error('Error en sincronización automática:', error);
    } finally {
      setSyncInProgress(false);
    }
  };

  const handleManualSync = async () => {
    if (syncInProgress || !isOnline) return;
    
    setSyncInProgress(true);
    try {
      const result = await offlineService.forceSync();
      if (result.success) {
        await loadPendingCount();
        if (onSyncPress) {
          onSyncPress(result);
        }
      }
    } catch (error) {
      logger.error('Error en sincronización manual:', error);
    } finally {
      setSyncInProgress(false);
    }
  };

  if (isOnline && pendingCount === 0) {
    return null; // No mostrar si está online y no hay pendientes
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: isOnline ? '#4CAF50' : '#FF9800'
        }
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>
          {!isOnline
            ? `📡 Sin conexión - ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`
            : `🔄 ${pendingCount} elemento${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de sincronizar`}
        </Text>
        {isOnline && pendingCount > 0 && (
          <TouchableOpacity
            onPress={handleManualSync}
            disabled={syncInProgress}
            style={styles.syncButton}
          >
            <Text style={styles.syncButtonText}>
              {syncInProgress ? 'Sincronizando...' : 'Sincronizar ahora'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  syncButton: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineIndicator;

