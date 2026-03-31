import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Text, RefreshControl, Dimensions, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Circle, Line, Text as SvgText, Rect } from 'react-native-svg';
import { mesService } from '../services/MESService';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = Math.min(SCREEN_W - 32, 500);
const CHART_H = 130;
const PAD = { left: 28, right: 12, top: 14, bottom: 22 };

// ── Gráfica de línea Pass% ────────────────────────────────
function PassChart({ historial, estacion }) {
  const key = estacion === 'A' ? 'pass_pct_a' : 'pass_pct_b';
  const datos = historial.map(r => ({
    val: r[key] ?? 0,
    ts: r.ts ? new Date(r.ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
  }));
  if (datos.length < 2) return (
    <View style={ch.empty}><Text style={ch.emptyText}>Sin suficientes datos para gráfica</Text></View>
  );

  const w = CHART_W - PAD.left - PAD.right;
  const h = CHART_H - PAD.top - PAD.bottom;
  const toX = i => PAD.left + (i / (datos.length - 1)) * w;
  const toY = v => PAD.top + h - (Math.min(v, 100) / 100) * h;
  const puntos = datos.map((d, i) => `${toX(i)},${toY(d.val)}`).join(' ');
  const y80 = toY(80);
  const step = Math.ceil(datos.length / 5);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {/* Zona OK (>80%) */}
      <Rect x={PAD.left} y={PAD.top} width={w} height={y80 - PAD.top}
        fill="#4CAF5008" />
      {/* Línea 80% */}
      <Line x1={PAD.left} y1={y80} x2={PAD.left + w} y2={y80}
        stroke="#4CAF5055" strokeWidth={1} strokeDasharray="4,3" />
      <SvgText x={PAD.left + w + 2} y={y80 + 4} fontSize="8" fill="#4CAF50">80%</SvgText>
      {/* Línea Pass% */}
      <Polyline points={puntos} fill="none"
        stroke={estacion === 'A' ? '#2196F3' : '#9C27B0'} strokeWidth={2} strokeLinejoin="round" />
      {/* Puntos */}
      {datos.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.val)} r={3}
          fill={d.val >= 80 ? '#4CAF50' : '#F44336'} />
      ))}
      {/* Etiquetas X */}
      {datos.map((d, i) => (
        i % step === 0 ? (
          <SvgText key={i} x={toX(i)} y={CHART_H - 4}
            fontSize="7" fill="#616161" textAnchor="middle">{d.ts}</SvgText>
        ) : null
      ))}
      {/* Eje Y */}
      <SvgText x={2} y={PAD.top + 6} fontSize="7" fill="#616161">100%</SvgText>
      <SvgText x={2} y={CHART_H - PAD.bottom + 6} fontSize="7" fill="#616161">0%</SvgText>
    </Svg>
  );
}

// ── Tarjeta de estación ───────────────────────────────────
function EstacionCard({ label, ok, ng, passPct, color }) {
  const total = (ok ?? 0) + (ng ?? 0);
  const pct = passPct ?? (total > 0 ? Math.round((ok / total) * 100) : null);
  const semColor = pct == null ? '#616161' : pct >= 80 ? '#4CAF50' : pct >= 60 ? '#FF9800' : '#F44336';

  return (
    <View style={[st.estCard, { borderColor: semColor + '88' }]}>
      <LinearGradient
        colors={[color + '22', '#0F0F0F']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <View style={st.estHeader}>
        <View style={[st.estLabel, { backgroundColor: color + '33', borderColor: color }]}>
          <Text style={[st.estLabelText, { color }]}>EST. {label}</Text>
        </View>
        <View style={[st.semaforo, { backgroundColor: semColor + '22', borderColor: semColor }]}>
          <Text style={[st.semaforoText, { color: semColor }]}>
            {pct != null ? `${pct.toFixed(1)}%` : '—'}
          </Text>
        </View>
      </View>

      <View style={st.metricsRow}>
        <View style={st.metBloque}>
          <Text style={st.metLabel}>OK</Text>
          <Text style={[st.metValor, { color: '#4CAF50' }]}>{ok ?? '—'}</Text>
        </View>
        <View style={st.metSep} />
        <View style={st.metBloque}>
          <Text style={st.metLabel}>NG</Text>
          <Text style={[st.metValor, { color: '#F44336' }]}>{ng ?? '—'}</Text>
        </View>
        <View style={st.metSep} />
        <View style={st.metBloque}>
          <Text style={st.metLabel}>Pass%</Text>
          <Text style={[st.metValor, { color: semColor }]}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</Text>
        </View>
      </View>

      {/* Barra pass rate */}
      {pct != null && (
        <View style={st.barWrap}>
          <View style={st.barBg}>
            <View style={[st.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: semColor }]} />
          </View>
          <Text style={[st.barLabel, { color: semColor }]}>{pct.toFixed(1)}% pass</Text>
        </View>
      )}
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────
export default function MESDashboardScreen() {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [actual, setActual] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estaciones, setEstaciones] = useState([]);
  const [estacionSeleccionada, setEstacionSeleccionada] = useState(null);
  const intervalRef = useRef(null);

  const cargarEstaciones = useCallback(async () => {
    const r = await mesService.getEstaciones();
    if (r.success && r.data.length > 0) {
      setEstaciones(r.data);
      if (!estacionSeleccionada) setEstacionSeleccionada(r.data[0]);
    }
  }, [estacionSeleccionada]);

  const cargar = useCallback(async (isRef = false, estId = null) => {
    if (isRef) setRefreshing(true);
    const id = estId || estacionSeleccionada;
    if (!id) { setLoading(false); setRefreshing(false); return; }
    const r = await mesService.getDashboard(id);
    if (r.success) {
      setActual(r.data.actual);
      setHistorial(r.data.historial || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [estacionSeleccionada]);

  useFocusEffect(useCallback(() => {
    cargarEstaciones();
    cargar();
    intervalRef.current = setInterval(() => cargar(), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [cargar, cargarEstaciones]));

  const ts = actual?.ts
    ? new Date(actual.ts).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
    : null;

  return (
    <View style={[s.container, isWeb && webStyles.container]}>
      <LinearGradient colors={['#1A0533', '#0F0F0F']} style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }} />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#9C27B0" />}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>FCT Dashboard</Text>
            <View style={s.liveBadge}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>LIVE · 1 min</Text>
            </View>
          </View>

          {/* Selector de estación */}
          {estaciones.length > 1 && (
            <View style={s.estSelector}>
              {estaciones.map(est => (
                <TouchableOpacity
                  key={est}
                  style={[s.estBtn, estacionSeleccionada === est && s.estBtnActivo]}
                  onPress={() => {
                    setEstacionSeleccionada(est);
                    setLoading(true);
                    cargar(false, est);
                  }}
                >
                  <Text style={[s.estBtnText, estacionSeleccionada === est && s.estBtnTextActivo]}>
                    {est}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {estacionSeleccionada && (
            <Text style={s.estActualLabel}>{estacionSeleccionada}</Text>
          )}

          {loading ? (
            <ActivityIndicator color="#9C27B0" style={{ marginTop: 60 }} />
          ) : !actual ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>📡</Text>
              <Text style={s.emptyText}>Sin datos de la estación FCT</Text>
              <Text style={s.emptyHint}>Verifica que el agente FCT esté corriendo</Text>
            </View>
          ) : (
            <>
              {/* Modelo y timestamp */}
              <View style={s.modeloRow}>
                <Text style={s.modeloNombre} numberOfLines={1}>{actual.modelo || 'Modelo no detectado'}</Text>
                {ts && <Text style={s.modeloTs}>{ts}</Text>}
              </View>

              {/* Estaciones A y B */}
              <EstacionCard
                label="A" color="#2196F3"
                ok={actual.ok_a} ng={actual.ng_a} passPct={actual.pass_pct_a}
              />
              <EstacionCard
                label="B" color="#9C27B0"
                ok={actual.ok_b} ng={actual.ng_b} passPct={actual.pass_pct_b}
              />

              {/* Total combinado */}
              <View style={s.totalCard}>
                <Text style={s.totalLabel}>TOTAL COMBINADO</Text>
                <View style={s.totalRow}>
                  <View style={s.totalBloque}>
                    <Text style={s.totalSubLabel}>OK</Text>
                    <Text style={[s.totalValor, { color: '#4CAF50' }]}>
                      {(actual.ok_a ?? 0) + (actual.ok_b ?? 0)}
                    </Text>
                  </View>
                  <View style={s.totalSep} />
                  <View style={s.totalBloque}>
                    <Text style={s.totalSubLabel}>NG</Text>
                    <Text style={[s.totalValor, { color: '#F44336' }]}>
                      {(actual.ng_a ?? 0) + (actual.ng_b ?? 0)}
                    </Text>
                  </View>
                  <View style={s.totalSep} />
                  <View style={s.totalBloque}>
                    {(() => {
                      const totalOK = (actual.ok_a ?? 0) + (actual.ok_b ?? 0);
                      const totalNG = (actual.ng_a ?? 0) + (actual.ng_b ?? 0);
                      const tot = totalOK + totalNG;
                      const pct = tot > 0 ? ((totalOK / tot) * 100).toFixed(1) : null;
                      const col = pct == null ? '#616161' : pct >= 80 ? '#4CAF50' : pct >= 60 ? '#FF9800' : '#F44336';
                      return (
                        <>
                          <Text style={s.totalSubLabel}>Pass%</Text>
                          <Text style={[s.totalValor, { color: col }]}>{pct != null ? `${pct}%` : '—'}</Text>
                        </>
                      );
                    })()}
                  </View>
                </View>
              </View>

              {/* Gráficas historial */}
              {historial.length >= 2 && (
                <>
                  <Text style={s.chartTitle}>TENDENCIA PASS% — EST. A (últ. 2h)</Text>
                  <View style={s.chartCard}>
                    <PassChart historial={historial} estacion="A" />
                  </View>

                  <Text style={s.chartTitle}>TENDENCIA PASS% — EST. B (últ. 2h)</Text>
                  <View style={s.chartCard}>
                    <PassChart historial={historial} estacion="B" />
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  safe:      { flex: 1 },
  scroll:    { padding: 16, paddingBottom: 40 },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:     { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6,
               backgroundColor: '#4CAF5022', borderRadius: 8,
               paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#4CAF5066' },
  liveDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  liveText:  { color: '#4CAF50', fontSize: 11, fontWeight: 'bold' },

  estSelector:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  estBtn:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  estBtnActivo:     { backgroundColor: '#9C27B022', borderColor: '#9C27B0' },
  estBtnText:       { color: '#757575', fontSize: 13, fontWeight: '600' },
  estBtnTextActivo: { color: '#CE93D8' },
  estActualLabel:   { color: '#616161', fontSize: 11, marginBottom: 10 },

  modeloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modeloNombre: { color: '#E0E0E0', fontSize: 14, fontWeight: '600', flex: 1 },
  modeloTs:  { color: '#616161', fontSize: 11, marginLeft: 8 },

  emptyCard: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#9E9E9E', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: '#616161', fontSize: 13, textAlign: 'center' },

  totalCard: {
    backgroundColor: '#141414', borderRadius: 14,
    borderWidth: 1, borderColor: '#2D2D2D',
    padding: 16, marginTop: 4, marginBottom: 16,
  },
  totalLabel: { color: '#757575', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 },
  totalRow:   { flexDirection: 'row', alignItems: 'center' },
  totalBloque:{ flex: 1, alignItems: 'center' },
  totalSubLabel: { color: '#757575', fontSize: 11, marginBottom: 4 },
  totalValor: { color: '#FFF', fontSize: 26, fontWeight: 'bold' },
  totalSep:   { width: 1, height: 50, backgroundColor: '#2D2D2D', marginHorizontal: 8 },

  chartTitle: { color: '#757575', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6, marginTop: 8 },
  chartCard:  { backgroundColor: '#0D1B2A', borderRadius: 12, borderWidth: 1, borderColor: '#1A2E40', padding: 8, marginBottom: 8 },
});

const st = StyleSheet.create({
  estCard: {
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, marginBottom: 10, overflow: 'hidden',
  },
  estHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  estLabel:      { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  estLabelText:  { fontSize: 12, fontWeight: 'bold' },
  semaforo:      { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  semaforoText:  { fontSize: 16, fontWeight: 'bold' },
  metricsRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  metBloque:     { flex: 1, alignItems: 'center' },
  metLabel:      { color: '#757575', fontSize: 11, marginBottom: 4 },
  metValor:      { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  metSep:        { width: 1, height: 40, backgroundColor: '#2D2D2D', marginHorizontal: 8 },
  barWrap:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBg:         { flex: 1, height: 6, backgroundColor: '#2D2D2D', borderRadius: 3 },
  barFill:       { height: 6, borderRadius: 3 },
  barLabel:      { fontSize: 12, fontWeight: 'bold', minWidth: 50, textAlign: 'right' },
});

const ch = StyleSheet.create({
  empty:     { alignItems: 'center', padding: 20 },
  emptyText: { color: '#616161', fontSize: 12 },
});
