import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { uphService } from '../services/UPHService';

export default function UPHDashboardLiderScreen() {
  const [lineas, setLineas] = useState([]);
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [scoreboard, setScoreboard] = useState([]);
  const [loadingLineas, setLoadingLineas] = useState(true);
  const [loadingScore, setLoadingScore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fecha, setFecha] = useState('');

  const cargarLineas = useCallback(async () => {
    const r = await uphService.getLineas();
    if (r.success && r.data.length > 0) {
      setLineas(r.data);
      setLineaSeleccionada(r.data[0]);
    }
    setLoadingLineas(false);
  }, []);

  const cargarScoreboard = useCallback(async (linea, isRefresh = false) => {
    if (!linea) return;
    if (isRefresh) setRefreshing(true);
    else setLoadingScore(true);

    const r = await uphService.getScoreboardHoy(linea.nombre);
    if (r.success) {
      setScoreboard(r.data.scoreboard || []);
      setFecha(r.data.fecha || '');
    }
    setLoadingScore(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargarLineas(); }, [cargarLineas]);

  useEffect(() => {
    if (lineaSeleccionada) cargarScoreboard(lineaSeleccionada);
  }, [lineaSeleccionada, cargarScoreboard]);

  const top3 = [...scoreboard].sort((a, b) => b.total_hoy - a.total_hoy).slice(0, 3);
  const resto = [...scoreboard].sort((a, b) => b.total_hoy - a.total_hoy).slice(3);

  if (loadingLineas) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A237E', '#0F0F0F']} style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }} />
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard UPH</Text>
          {fecha ? <Text style={styles.fecha}>{fecha}</Text> : null}
        </View>

        {/* Selector de línea */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lineaRow}>
          {lineas.map(l => (
            <TouchableOpacity
              key={l.id}
              style={[styles.lineaChip, lineaSeleccionada?.id === l.id && styles.lineaChipActivo]}
              onPress={() => setLineaSeleccionada(l)}
              activeOpacity={0.7}
            >
              <Text style={[styles.lineaChipText, lineaSeleccionada?.id === l.id && styles.lineaChipTextActivo]}>
                {l.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loadingScore ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#2196F3" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => cargarScoreboard(lineaSeleccionada, true)}
                tintColor="#2196F3"
              />
            }
          >
            {scoreboard.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>Sin datos para hoy</Text>
                <Text style={styles.emptyHint}>Los datos aparecerán cuando se registren eventos de producción</Text>
              </View>
            ) : (
              <>
                {/* Top 3 */}
                <Text style={styles.sectionLabel}>TOP 3 · {lineaSeleccionada?.nombre}</Text>
                <View style={styles.podio}>
                  {top3.map((op, i) => (
                    <PodioCard key={op.num_empleado} op={op} pos={i + 1} />
                  ))}
                </View>

                {/* Resto */}
                {resto.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 20 }]}>TODOS LOS OPERADORES</Text>
                    {[...top3, ...resto].map((op, i) => (
                      <OperadorRow key={op.num_empleado} op={op} pos={i + 1} />
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function PodioCard({ op, pos }) {
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const sizes = [80, 68, 68];
  const color = colors[pos - 1] || '#555';
  const size = sizes[pos - 1] || 60;

  return (
    <View style={[styles.podioCard, pos === 1 && styles.podioCardFirst]}>
      <Text style={[styles.podioMedal, { color }]}>{pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'}</Text>
      <Text style={[styles.podioNombre, { fontSize: pos === 1 ? 14 : 12 }]} numberOfLines={2}>
        {op.nombre}
      </Text>
      <Text style={[styles.podioPiezas, { fontSize: pos === 1 ? 28 : 22, color }]}>
        {op.total_hoy}
      </Text>
      <Text style={styles.podioPiezasLabel}>piezas</Text>
      <KPIBar kpi={op.kpi_pct} size={size} />
      <Text style={styles.podioKpi}>{op.kpi_pct}%</Text>
    </View>
  );
}

function OperadorRow({ op, pos }) {
  const isTop3 = pos <= 3;
  return (
    <View style={[styles.opRow, isTop3 && styles.opRowTop]}>
      <Text style={styles.opPos}>#{pos}</Text>
      <View style={styles.opInfo}>
        <Text style={styles.opNombre}>{op.nombre}</Text>
        <Text style={styles.opSub}>#{op.num_empleado}  ·  Est. {op.estacion}</Text>
      </View>
      <View style={styles.opStats}>
        <Text style={styles.opPiezas}>{op.total_hoy} pzs</Text>
        <Text style={styles.opKpi}>{op.kpi_pct}%</Text>
      </View>
    </View>
  );
}

function KPIBar({ kpi, size }) {
  const pct = Math.min(kpi, 100);
  const color = kpi >= 100 ? '#4CAF50' : kpi >= 80 ? '#FF9800' : '#F44336';
  return (
    <View style={[styles.kpiBarBg, { width: size }]}>
      <View style={[styles.kpiBarFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, marginBottom: 8 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  fecha: { color: '#666', fontSize: 12 },

  lineaRow: { paddingHorizontal: 12, marginBottom: 12, maxHeight: 44 },
  lineaChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', marginRight: 8 },
  lineaChipActivo: { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  lineaChipText: { color: '#9E9E9E', fontSize: 13 },
  lineaChipTextActivo: { color: '#FFF', fontWeight: 'bold' },

  scroll: { paddingHorizontal: 14, paddingBottom: 100 },
  sectionLabel: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 },

  // Podio
  podio: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  podioCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14,
    borderWidth: 1, borderColor: '#2D2D2D',
    alignItems: 'center', padding: 12,
  },
  podioCardFirst: { borderColor: '#FFD70066', backgroundColor: '#1A1700' },
  podioMedal: { fontSize: 24, marginBottom: 4 },
  podioNombre: { color: '#DDD', fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  podioPiezas: { fontWeight: 'bold' },
  podioPiezasLabel: { color: '#666', fontSize: 10, marginBottom: 6 },
  podioKpi: { color: '#888', fontSize: 11, marginTop: 4 },

  // KPI bar
  kpiBarBg: { height: 4, backgroundColor: '#333', borderRadius: 2, overflow: 'hidden' },
  kpiBarFill: { height: 4, borderRadius: 2 },

  // Lista operadores
  opRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#2D2D2D' },
  opRowTop: { borderColor: '#2196F333' },
  opPos: { color: '#555', fontSize: 13, fontWeight: 'bold', width: 28 },
  opInfo: { flex: 1 },
  opNombre: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  opSub: { color: '#666', fontSize: 11, marginTop: 2 },
  opStats: { alignItems: 'flex-end' },
  opPiezas: { color: '#DDD', fontSize: 14, fontWeight: 'bold' },
  opKpi: { color: '#888', fontSize: 11, marginTop: 2 },

  // Empty
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#9E9E9E', fontSize: 16, marginBottom: 8, textAlign: 'center' },
  emptyHint: { color: '#616161', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
