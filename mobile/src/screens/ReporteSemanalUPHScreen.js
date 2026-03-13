import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { uphService } from '../services/UPHService';

const MEDALLAS = ['🥇', '🥈', '🥉'];

function colorKPI(kpi) {
  if (kpi >= 90) return '#4CAF50';
  if (kpi >= 70) return '#FF9800';
  return '#F44336';
}

function BarraKPI({ kpi }) {
  const color = colorKPI(kpi);
  return (
    <View style={styles.barraFondo}>
      <View style={[styles.barraRelleno, { width: `${Math.min(kpi, 100)}%`, backgroundColor: color }]} />
      <Text style={[styles.barraLabel, { color }]}>{kpi}%</Text>
    </View>
  );
}

export default function ReporteSemanalUPHScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await uphService.getReporteSemanalCompleto();
    if (result.success) setData(result.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Generando reporte...</Text>
      </View>
    );
  }

  const operadores = data?.operadores || [];
  const top3 = operadores.slice(0, 3);
  const resto = operadores.slice(3);

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />
          }
        >
          {/* Periodo */}
          {data?.periodo && (
            <Text style={styles.periodo}>
              Período: {data.periodo.desde} → {data.periodo.hasta}
            </Text>
          )}

          {/* Podio top 3 */}
          {top3.length > 0 && (
            <View style={styles.podioContainer}>
              <Text style={styles.seccionTitulo}>🏆 Top Operadores</Text>
              <View style={styles.podio}>
                {/* Posición 2 */}
                {top3[1] && (
                  <TouchableOpacity
                    style={[styles.podioCard, styles.podioSegundo]}
                    onPress={() => navigation.navigate('OperadorHistorial', { operador: top3[1] })}
                  >
                    <Text style={styles.medalla}>{MEDALLAS[1]}</Text>
                    <Text style={styles.podioNombre} numberOfLines={2}>{top3[1].nombre}</Text>
                    <Text style={styles.podioUPH}>{top3[1].uph_promedio} UPH</Text>
                    <Text style={[styles.podioKPI, { color: colorKPI(top3[1].kpi_pct) }]}>
                      {top3[1].kpi_pct}%
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Posición 1 */}
                {top3[0] && (
                  <TouchableOpacity
                    style={[styles.podioCard, styles.podioPrimero]}
                    onPress={() => navigation.navigate('OperadorHistorial', { operador: top3[0] })}
                  >
                    <Text style={styles.medalla}>{MEDALLAS[0]}</Text>
                    <Text style={styles.podioNombre} numberOfLines={2}>{top3[0].nombre}</Text>
                    <Text style={styles.podioUPH}>{top3[0].uph_promedio} UPH</Text>
                    <Text style={[styles.podioKPI, { color: colorKPI(top3[0].kpi_pct) }]}>
                      {top3[0].kpi_pct}%
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Posición 3 */}
                {top3[2] && (
                  <TouchableOpacity
                    style={[styles.podioCard, styles.podioTercero]}
                    onPress={() => navigation.navigate('OperadorHistorial', { operador: top3[2] })}
                  >
                    <Text style={styles.medalla}>{MEDALLAS[2]}</Text>
                    <Text style={styles.podioNombre} numberOfLines={2}>{top3[2].nombre}</Text>
                    <Text style={styles.podioUPH}>{top3[2].uph_promedio} UPH</Text>
                    <Text style={[styles.podioKPI, { color: colorKPI(top3[2].kpi_pct) }]}>
                      {top3[2].kpi_pct}%
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Lista completa */}
          <Text style={styles.seccionTitulo}>📋 Todos los operadores</Text>
          {operadores.length === 0 ? (
            <Text style={styles.emptyText}>Sin datos esta semana</Text>
          ) : (
            operadores.map((op) => (
              <TouchableOpacity
                key={op.num_empleado}
                style={styles.fila}
                onPress={() => navigation.navigate('OperadorHistorial', { operador: op })}
                activeOpacity={0.7}
              >
                <View style={styles.filaRanking}>
                  <Text style={styles.rankingNum}>
                    {op.ranking <= 3 ? MEDALLAS[op.ranking - 1] : `#${op.ranking}`}
                  </Text>
                </View>
                <View style={styles.filaInfo}>
                  <Text style={styles.filaNombre}>{op.nombre}</Text>
                  <Text style={styles.filaNum}>#{op.num_empleado} · {op.dias_activos} días activos</Text>
                  <BarraKPI kpi={op.kpi_pct} />
                </View>
                <View style={styles.filaUPH}>
                  <Text style={styles.filaUPHVal}>{op.uph_promedio}</Text>
                  <Text style={styles.filaUPHLabel}>UPH</Text>
                  <Text style={styles.filaEventos}>{op.total_eventos} pzs</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.footer}>
            Total: {data?.total_operadores || 0} operadores · Últimos 7 días
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
  scroll: { padding: 16 },
  periodo: { color: '#757575', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  seccionTitulo: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12, marginTop: 4 },

  // Podio
  podioContainer: { marginBottom: 24 },
  podio: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  podioCard: {
    flex: 1, alignItems: 'center', borderRadius: 12, padding: 12,
    borderWidth: 1,
  },
  podioPrimero: {
    backgroundColor: '#1A1700', borderColor: '#FFD700',
    paddingVertical: 20, marginBottom: 0,
  },
  podioSegundo: {
    backgroundColor: '#1A1A1A', borderColor: '#9E9E9E',
    paddingVertical: 14, marginBottom: 8,
  },
  podioTercero: {
    backgroundColor: '#1A1200', borderColor: '#CD7F32',
    paddingVertical: 10, marginBottom: 16,
  },
  medalla: { fontSize: 28, marginBottom: 4 },
  podioNombre: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  podioUPH: { color: '#BDBDBD', fontSize: 13, fontWeight: 'bold' },
  podioKPI: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },

  // Lista
  fila: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    marginBottom: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  filaRanking: { width: 36, alignItems: 'center' },
  rankingNum: { color: '#9E9E9E', fontSize: 15, fontWeight: 'bold' },
  filaInfo: { flex: 1, marginHorizontal: 10 },
  filaNombre: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  filaNum: { color: '#757575', fontSize: 11, marginBottom: 6 },
  barraFondo: {
    height: 16, backgroundColor: '#2D2D2D', borderRadius: 8,
    overflow: 'hidden', position: 'relative', justifyContent: 'center',
  },
  barraRelleno: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
  barraLabel: { fontSize: 10, fontWeight: 'bold', textAlign: 'right', paddingRight: 6, zIndex: 1 },
  filaUPH: { alignItems: 'center', minWidth: 56 },
  filaUPHVal: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  filaUPHLabel: { color: '#757575', fontSize: 10 },
  filaEventos: { color: '#616161', fontSize: 10, marginTop: 2 },
  emptyText: { color: '#757575', textAlign: 'center', marginTop: 24 },
  footer: { color: '#424242', fontSize: 11, textAlign: 'center', marginTop: 16, marginBottom: 8 },
});