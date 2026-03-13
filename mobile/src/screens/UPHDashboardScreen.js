import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Text, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, IconButton } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { useAuth } from '../contexts/AuthContext';
import { uphService } from '../services/UPHService';

const COLOR_MAP = {
  verde:   { bg: '#1B5E20', border: '#4CAF50', text: '#A5D6A7', dot: '#4CAF50' },
  naranja: { bg: '#E65100', border: '#FF9800', text: '#FFCC80', dot: '#FF9800' },
  rojo:    { bg: '#B71C1C', border: '#F44336', text: '#EF9A9A', dot: '#F44336' },
  gris:    { bg: '#212121', border: '#757575', text: '#9E9E9E', dot: '#757575' },
};

const REFRESH_INTERVAL = 30000; // 30 segundos

export default function UPHDashboardScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user, logout } = useAuth();
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargarResumen = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await uphService.getResumen();
    if (result.success) {
      setLineas(result.data.lineas || []);
      setUltimaActualizacion(new Date());
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargarResumen();
    const interval = setInterval(() => cargarResumen(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [cargarResumen]);

  const formatHora = (date) => {
    if (!date) return '--';
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const kpiPct = (real, meta) => {
    if (!meta || meta <= 0) return null;
    return Math.round((real / meta) * 100);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('¿Cerrar sesión?')) logout();
    } else {
      logout();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando líneas...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>Dashboard UPH</Text>
            <Text style={styles.subtitulo}>
              {ultimaActualizacion
                ? `Actualizado: ${formatHora(ultimaActualizacion)}`
                : 'Cargando...'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.btnReporte}
              onPress={() => navigation.navigate('ReporteSemanalUPH')}
            >
              <Text style={styles.btnReporteText}>📊 Reporte</Text>
            </TouchableOpacity>
            <IconButton icon="logout" iconColor="#9E9E9E" size={22} onPress={handleLogout} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => cargarResumen(true)}
              tintColor="#2196F3"
            />
          }
        >
          {lineas.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Sin líneas configuradas</Text>
            </View>
          ) : (
            lineas.map((linea) => {
              const colores = COLOR_MAP[linea.color] || COLOR_MAP.gris;
              const kpi = kpiPct(linea.uph_real, linea.uph_meta);
              return (
                <TouchableOpacity
                  key={linea.linea}
                  style={[styles.card, { borderColor: colores.border, backgroundColor: colores.bg + '33' }]}
                  onPress={() => navigation.navigate('ReporteSemanalUPH')}
                  activeOpacity={0.8}
                >
                  {/* Indicador de color lateral */}
                  <View style={[styles.colorBar, { backgroundColor: colores.dot }]} />

                  <View style={styles.cardContent}>
                    {/* Fila superior */}
                    <View style={styles.cardRow}>
                      <Text style={styles.lineaNombre}>{linea.linea}</Text>
                      <View style={[styles.badge, { backgroundColor: colores.dot + '33', borderColor: colores.dot }]}>
                        <View style={[styles.dot, { backgroundColor: colores.dot }]} />
                        <Text style={[styles.badgeText, { color: colores.text }]}>
                          {linea.color?.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Modelo */}
                    <Text style={styles.modeloText}>
                      {linea.modelo || 'Sin modelo asignado'}
                    </Text>

                    {/* UPH */}
                    <View style={styles.uphRow}>
                      <View style={styles.uphBlock}>
                        <Text style={styles.uphLabel}>UPH Real</Text>
                        <Text style={[styles.uphValue, { color: colores.text }]}>
                          {linea.uph_real}
                        </Text>
                      </View>
                      <View style={styles.uphSep} />
                      <View style={styles.uphBlock}>
                        <Text style={styles.uphLabel}>Meta</Text>
                        <Text style={styles.uphValue}>{linea.uph_meta}</Text>
                      </View>
                      <View style={styles.uphSep} />
                      <View style={styles.uphBlock}>
                        <Text style={styles.uphLabel}>KPI</Text>
                        <Text style={[styles.uphValue, { color: colores.dot }]}>
                          {kpi !== null ? `${kpi}%` : '—'}
                        </Text>
                      </View>
                      <View style={styles.uphSep} />
                      <View style={styles.uphBlock}>
                        <Text style={styles.uphLabel}>Estaciones</Text>
                        <Text style={styles.uphValue}>{linea.total_estaciones}</Text>
                      </View>
                    </View>

                    {/* Barra de progreso KPI */}
                    {kpi !== null && (
                      <View style={styles.barraContainer}>
                        <View style={styles.barraFondo}>
                          <View
                            style={[
                              styles.barraRelleno,
                              {
                                width: `${Math.min(kpi, 100)}%`,
                                backgroundColor: colores.dot,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Pie de página */}
          <Text style={styles.footer}>
            Se actualiza automáticamente cada 30 segundos
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  loadingText: { color: '#9E9E9E', marginTop: 12, fontSize: 14 },
  emptyText: { color: '#9E9E9E', fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D2D',
  },
  titulo: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  subtitulo: { color: '#9E9E9E', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  btnReporte: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 4,
  },
  btnReporteText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  scroll: { padding: 12 },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  colorBar: { width: 6 },
  cardContent: { flex: 1, padding: 14 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lineaNombre: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  modeloText: { color: '#9E9E9E', fontSize: 13, marginBottom: 12 },
  uphRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  uphBlock: { flex: 1, alignItems: 'center' },
  uphLabel: { color: '#757575', fontSize: 11, marginBottom: 2 },
  uphValue: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  uphSep: { width: 1, height: 36, backgroundColor: '#2D2D2D', marginHorizontal: 4 },
  barraContainer: { marginTop: 2 },
  barraFondo: { height: 6, backgroundColor: '#2D2D2D', borderRadius: 3, overflow: 'hidden' },
  barraRelleno: { height: 6, borderRadius: 3 },
  footer: { color: '#424242', fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 16 },
});
