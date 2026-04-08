import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { uphService } from '../services/UPHService';
import { showAlert } from '../utils/alertUtils';
import { API_BASE_URL } from '../utils/apiClient';

const LINEAS = ['HI-1', 'HI-2', 'HI-3', 'HI-4', 'HI-5', 'HI-6'];
const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = Math.min(SCREEN_W - 32, 500);
const CHART_H = 120;
const PAD = { left: 32, right: 12, top: 12, bottom: 24 };

// ── Detectar turno automáticamente ────────────────────────
function detectarTurno() {
  const now = new Date();
  const day = now.getDay(); // 0=Dom, 1=Lun...5=Vie, 6=Sab
  const mins = now.getHours() * 60 + now.getMinutes();
  const mañana = 6 * 60 + 30;   // 6:30am
  const tarde  = 18 * 60 + 30;  // 6:30pm

  const esDia = mins >= mañana && mins < tarde;

  // Lunes-Jueves
  if (day >= 1 && day <= 4) return esDia ? 'A' : 'B';
  // Viernes: antes 6:30am sigue siendo turno B de la noche anterior
  if (day === 5) return mins < mañana ? 'B' : 'C';
  // Fin de semana
  return 'C';
}

const TURNO_COLOR = { A: '#1565C0', B: '#4A148C', C: '#1B5E20' };
const TURNO_TEXT  = { A: '#90CAF9', B: '#CE93D8', C: '#A5D6A7' };

// ── Avatar iniciales ──────────────────────────────────────
function Initials({ nombre, size = 36 }) {
  const parts = (nombre || '?').trim().split(' ');
  const ini = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (nombre || '?').slice(0, 2).toUpperCase();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{ini}</Text>
    </View>
  );
}

// ── Avatar con foto o iniciales ───────────────────────────
function AvatarOp({ op, size = 36 }) {
  const [err, setErr] = useState(false);
  if (op?.foto_url && !err) {
    const uri = op.foto_url.startsWith('http') ? op.foto_url : `${API_BASE_URL}${op.foto_url}`;
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: '#1565C0' }}
        onError={() => setErr(true)}
      />
    );
  }
  return <Initials nombre={op?.nombre} size={size} />;
}

// ── Gráfica de línea SVG ──────────────────────────────────
function LineChart({ datos, meta }) {
  if (!datos || datos.length < 2) return null;
  const w = CHART_W - PAD.left - PAD.right;
  const h = CHART_H - PAD.top - PAD.bottom;
  const maxVal = Math.max(meta || 0, ...datos.map(d => d.valor)) * 1.15 || 1;

  const toX = (i) => PAD.left + (i / (datos.length - 1)) * w;
  const toY = (v) => PAD.top + h - (v / maxVal) * h;

  const puntos = datos.map((d, i) => `${toX(i)},${toY(d.valor)}`).join(' ');
  const metaY  = toY(meta);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {/* Línea meta */}
      {meta > 0 && (
        <>
          <Line x1={PAD.left} y1={metaY} x2={CHART_W - PAD.right} y2={metaY}
            stroke="#4CAF5066" strokeWidth={1} strokeDasharray="4,3" />
          <SvgText x={CHART_W - PAD.right + 2} y={metaY + 4}
            fontSize="8" fill="#4CAF50">meta</SvgText>
        </>
      )}
      {/* Línea producción */}
      <Polyline points={puntos} fill="none" stroke="#2196F3" strokeWidth={2} strokeLinejoin="round" />
      {/* Puntos */}
      {datos.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.valor)} r={3}
          fill={d.valor >= (meta || 0) ? '#4CAF50' : '#F44336'} />
      ))}
      {/* Etiquetas eje X */}
      {datos.map((d, i) => (
        i % Math.ceil(datos.length / 5) === 0 ? (
          <SvgText key={i} x={toX(i)} y={CHART_H - 4}
            fontSize="8" fill="#616161" textAnchor="middle">{d.label}</SvgText>
        ) : null
      ))}
      {/* Eje Y — valor máximo */}
      <SvgText x={2} y={PAD.top + 6} fontSize="8" fill="#616161">
        {Math.round(maxVal)}
      </SvgText>
    </Svg>
  );
}

// ── Pantalla principal ────────────────────────────────────
export default function LiderDashboardScreen() {
  const { user, logout, updateProfile } = useAuth();

  const turnoAuto = detectarTurno();

  const [lineaLocal, setLineaLocal]     = useState(user?.linea_uph || null);
  const [cambiarLinea, setCambiarLinea] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [savedAnim] = useState(new Animated.Value(0));

  const [resumenLinea, setResumenLinea] = useState(null);
  const [operadoresHoy, setOperadoresHoy] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadingOps, setLoadingOps] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const saveTimeout = useRef(null);

  const guardarPerfil = useCallback(async (linea) => {
    setGuardandoPerfil(true);
    await updateProfile({ linea_uph: linea, turno_actual: turnoAuto });
    setGuardandoPerfil(false);
    Animated.sequence([
      Animated.timing(savedAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(savedAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [updateProfile, savedAnim, turnoAuto]);

  const handleLineaChange = (linea) => {
    setLineaLocal(linea);
    setCambiarLinea(false);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => guardarPerfil(linea), 600);
  };

  const cargarOperadores = useCallback(async (linea) => {
    if (!linea) return;
    setLoadingOps(true);
    const r = await uphService.getScoreboardHoy(linea);
    if (r.success) {
      const map = {};
      for (const item of (r.data?.scoreboard || [])) {
        if (!item.num_empleado) continue;
        if (!map[item.num_empleado]) map[item.num_empleado] = { ...item };
        else map[item.num_empleado].total_hoy += item.total_hoy;
      }
      setOperadoresHoy(Object.values(map).sort((a, b) => b.total_hoy - a.total_hoy));
    }
    setLoadingOps(false);
  }, []);

  const cargar = useCallback(async () => {
    const rResumen = await uphService.getResumen();
    if (rResumen.success && lineaLocal) {
      const lineas = rResumen.data?.lineas || [];
      setResumenLinea(lineas.find(l => l.linea === lineaLocal) || null);
    }
    setLoading(false);
    setRefreshing(false);
    cargarOperadores(lineaLocal);
  }, [lineaLocal, cargarOperadores]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = () => { setRefreshing(true); cargar(); };

  const handleLogout = () => {
    showAlert('Cerrar sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const nombre = user?.nombre || 'Líder';
  const totalTurno = operadoresHoy.reduce((s, o) => s + (o.total_hoy || 0), 0);

  // Gráfica: un punto por operador ordenado por producción
  const chartDatos = operadoresHoy.map((op, i) => ({
    label: (op.nombre || '').split(' ')[0]?.slice(0, 4),
    valor: op.total_hoy || 0,
  }));
  const metaChart = resumenLinea?.uph_meta ? resumenLinea.uph_meta * 11 : 0;

  const COLOR_SEMAFORO = {
    verde:   { bg: '#1B5E2033', border: '#4CAF50', text: '#4CAF50', dot: '#4CAF50' },
    naranja: { bg: '#E6510022', border: '#FF9800', text: '#FF9800', dot: '#FF9800' },
    rojo:    { bg: '#B71C1C22', border: '#F44336', text: '#F44336', dot: '#F44336' },
    gris:    { bg: '#1A1A1A',   border: '#333',    text: '#757575', dot: '#757575' },
  };
  const semaforo = resumenLinea ? (COLOR_SEMAFORO[resumenLinea.color] || COLOR_SEMAFORO.gris) : null;
  const pct = resumenLinea?.uph_meta > 0
    ? Math.round((resumenLinea.uph_real / resumenLinea.uph_meta) * 100)
    : null;

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0D1B2A', '#0F0F0F']} style={s.gradient} />
      <SafeAreaView style={s.safe}>
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2196F3" />}
        >

          {/* ── Header ─────────────────────────────────────── */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>Hola, {nombre.split(' ')[0]}</Text>
              <View style={s.headerSub}>
                <Text style={s.role}>Líder de línea</Text>
                {/* Turno detectado — solo informativo */}
                <View style={[s.turnoBadge, { backgroundColor: TURNO_COLOR[turnoAuto] + '33', borderColor: TURNO_COLOR[turnoAuto] }]}>
                  <Text style={[s.turnoBadgeText, { color: TURNO_TEXT[turnoAuto] }]}>
                    T-{turnoAuto}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Text style={s.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>

          {/* ── Mi línea ───────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.secRow}>
              <Text style={s.secLabel}>MI LÍNEA</Text>
              <Animated.Text style={[s.savedText, { opacity: savedAnim }]}>
                {guardandoPerfil ? '...' : '✓ Guardado'}
              </Animated.Text>
            </View>

            {!cambiarLinea ? (
              <View style={s.lineaFijaRow}>
                <View style={[s.lineaBadge, lineaLocal && s.lineaBadgeActivo]}>
                  <Text style={[s.lineaBadgeText, lineaLocal && s.lineaBadgeTextActivo]}>
                    {lineaLocal || 'Sin línea'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCambiarLinea(true)} style={s.cambiarBtn}>
                  <Text style={s.cambiarText}>Cambiar →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={s.chipRow}>
                  {LINEAS.map(l => (
                    <TouchableOpacity key={l}
                      style={[s.chip, lineaLocal === l && s.chipActivo]}
                      onPress={() => handleLineaChange(l)}>
                      <Text style={[s.chipText, lineaLocal === l && s.chipTextActivo]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setCambiarLinea(false)} style={{ marginTop: 6 }}>
                  <Text style={s.cancelarText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Resumen de la línea hoy ─────────────────────── */}
          {lineaLocal && (
            <>
              <Text style={s.secLabel}>MI LÍNEA HOY — {lineaLocal}</Text>
              {loading ? (
                <ActivityIndicator color="#2196F3" style={{ marginVertical: 20 }} />
              ) : resumenLinea ? (
                <View style={[s.lineaCard, semaforo && { borderColor: semaforo.border, backgroundColor: semaforo.bg }]}>
                  <View style={s.lineaCardTop}>
                    <View style={[s.dot, semaforo && { backgroundColor: semaforo.dot }]} />
                    <Text style={s.modeloNombre}>{resumenLinea.modelo || 'Sin modelo asignado'}</Text>
                  </View>
                  <View style={s.metricasRow}>
                    <View style={s.metrica}>
                      <Text style={s.metricaLabel}>UPH actual</Text>
                      <Text style={[s.metricaValor, semaforo && { color: semaforo.text }]}>
                        {resumenLinea.uph_real}
                      </Text>
                      <Text style={s.metricaUnidad}>pzs/hr</Text>
                    </View>
                    <View style={s.metricaSep} />
                    <View style={s.metrica}>
                      <Text style={s.metricaLabel}>Meta</Text>
                      <Text style={s.metricaValor}>{resumenLinea.uph_meta}</Text>
                      <Text style={s.metricaUnidad}>pzs/hr</Text>
                    </View>
                    <View style={s.metricaSep} />
                    <View style={s.metrica}>
                      <Text style={s.metricaLabel}>Eficiencia</Text>
                      <Text style={[s.metricaValor, semaforo && { color: semaforo.text }]}>
                        {pct != null ? `${pct}%` : '—'}
                      </Text>
                      <Text style={s.metricaUnidad}>del objetivo</Text>
                    </View>
                    <View style={s.metricaSep} />
                    <View style={s.metrica}>
                      <Text style={s.metricaLabel}>Estaciones</Text>
                      <Text style={s.metricaValor}>{resumenLinea.total_estaciones}</Text>
                      <Text style={s.metricaUnidad}>asignadas</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={s.emptyCard}>
                  <Text style={s.emptyIcon}>📋</Text>
                  <Text style={s.emptyText}>Sin asignación registrada hoy</Text>
                  <Text style={s.emptyHint}>Ve a Asignación para configurar el turno</Text>
                </View>
              )}
            </>
          )}

          {/* ── Operadores hoy ─────────────────────────────── */}
          {lineaLocal && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.secLabel}>TUS OPERADORES HOY</Text>

              {loadingOps ? (
                <ActivityIndicator color="#2196F3" style={{ marginVertical: 12 }} />
              ) : operadoresHoy.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={s.emptyOpsText}>Sin operadores asignados hoy</Text>
                </View>
              ) : (
                <>
                  {operadoresHoy.map((op, i) => {
                    const maxPzs = operadoresHoy[0]?.total_hoy || 1;
                    const pctOp = Math.round(((op.total_hoy || 0) / Math.max(maxPzs, 1)) * 100);
                    return (
                      <View key={op.num_empleado || i} style={s.opRow}>
                        <View style={s.opRank}>
                          <Text style={s.opRankText}>{i + 1}</Text>
                        </View>
                        <AvatarOp op={op} size={38} />
                        <View style={s.opInfo}>
                          <Text style={s.opNombre} numberOfLines={1}>{op.nombre || '—'}</Text>
                          <Text style={s.opSub}>#{op.num_empleado} · {op.total_estaciones || 0} est.</Text>
                          <View style={s.barBg}>
                            <View style={[s.barFill, { width: `${pctOp}%` }]} />
                          </View>
                        </View>
                        <View style={s.opPzs}>
                          <Text style={s.opPzsValor}>{op.total_hoy || 0}</Text>
                          <Text style={s.opPzsLabel}>pzs</Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Total del turno */}
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Total turno T-{turnoAuto}</Text>
                    <Text style={s.totalValor}>{totalTurno.toLocaleString()} pzs</Text>
                  </View>

                  {/* Gráfica */}
                  {chartDatos.length >= 2 && (
                    <View style={s.chartCard}>
                      <Text style={s.chartTitulo}>Producción por operador</Text>
                      <LineChart datos={chartDatos} meta={metaChart} />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  gradient:  { position: 'absolute', left: 0, right: 0, top: 0, height: 160 },
  safe:      { flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  headerSub:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  greeting:     { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  role:         { color: '#90CAF9', fontSize: 13 },
  logoutBtn:    {
    backgroundColor: '#B71C1C33', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: '#B71C1C',
  },
  logoutText:   { color: '#EF9A9A', fontSize: 13, fontWeight: 'bold' },

  turnoBadge:   {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  turnoBadgeText: { fontSize: 12, fontWeight: 'bold' },

  section:  { marginBottom: 16 },
  secRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  secLabel: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  savedText:{ color: '#4CAF50', fontSize: 12 },

  lineaFijaRow:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineaBadge:           {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2D2D2D',
  },
  lineaBadgeActivo:     { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  lineaBadgeText:       { color: '#757575', fontSize: 16, fontWeight: 'bold' },
  lineaBadgeTextActivo: { color: '#FFFFFF' },
  cambiarBtn:           { paddingVertical: 6 },
  cambiarText:          { color: '#2196F3', fontSize: 13 },
  cancelarText:         { color: '#616161', fontSize: 12 },

  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2D2D2D',
  },
  chipActivo:  { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  chipText:    { color: '#757575', fontSize: 14, fontWeight: 'bold' },
  chipTextActivo: { color: '#FFFFFF' },

  lineaCard:    { borderRadius: 14, padding: 16, borderWidth: 1.5, marginBottom: 16 },
  lineaCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot:          { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  modeloNombre: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', flex: 1 },
  metricasRow:  { flexDirection: 'row', alignItems: 'center' },
  metrica:      { flex: 1, alignItems: 'center' },
  metricaLabel: { color: '#757575', fontSize: 10, marginBottom: 4, textAlign: 'center' },
  metricaValor: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  metricaUnidad:{ color: '#616161', fontSize: 10, marginTop: 2, textAlign: 'center' },
  metricaSep:   { width: 1, height: 40, backgroundColor: '#2D2D2D', marginHorizontal: 4 },

  emptyCard:  {
    backgroundColor: '#141414', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2D2D2D', marginBottom: 16,
  },
  emptyIcon:   { fontSize: 36, marginBottom: 8 },
  emptyText:   { color: '#9E9E9E', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  emptyHint:   { color: '#616161', fontSize: 12 },
  emptyOpsText:{ color: '#616161', fontSize: 13 },

  // Fila de operador
  opRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414', borderRadius: 12,
    borderWidth: 1, borderColor: '#2D2D2D',
    marginBottom: 8, padding: 10, gap: 10,
  },
  opRank:      {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  opRankText:  { color: '#616161', fontSize: 11, fontWeight: 'bold' },
  avatar:      { backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: '#FFFFFF', fontWeight: 'bold' },
  opInfo:      { flex: 1 },
  opNombre:    { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  opSub:       { color: '#616161', fontSize: 11, marginBottom: 4 },
  barBg:       { height: 4, backgroundColor: '#2D2D2D', borderRadius: 2 },
  barFill:     { height: 4, backgroundColor: '#2196F3', borderRadius: 2 },
  opPzs:       { alignItems: 'flex-end', minWidth: 48 },
  opPzsValor:  { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  opPzsLabel:  { color: '#616161', fontSize: 10 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1565C022', borderRadius: 10,
    borderWidth: 1, borderColor: '#1565C0',
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 4, marginBottom: 12,
  },
  totalLabel: { color: '#90CAF9', fontSize: 13, fontWeight: 'bold' },
  totalValor: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },

  chartCard: {
    backgroundColor: '#0D1B2A', borderRadius: 14,
    borderWidth: 1, borderColor: '#1A2E40',
    padding: 12, marginBottom: 8,
  },
  chartTitulo: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
});
