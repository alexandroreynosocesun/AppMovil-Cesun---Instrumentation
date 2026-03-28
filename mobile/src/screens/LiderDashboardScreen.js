import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { uphService } from '../services/UPHService';
import { showAlert } from '../utils/alertUtils';

const LINEAS = ['HI-1', 'HI-2', 'HI-3', 'HI-4', 'HI-5', 'HI-6'];
const TURNOS = ['A', 'B', 'C'];

const COLOR_SEMAFORO = {
  verde:   { bg: '#1B5E2033', border: '#4CAF50', text: '#4CAF50', dot: '#4CAF50' },
  naranja: { bg: '#E6510022', border: '#FF9800', text: '#FF9800', dot: '#FF9800' },
  rojo:    { bg: '#B71C1C22', border: '#F44336', text: '#F44336', dot: '#F44336' },
  gris:    { bg: '#1A1A1A',   border: '#333',    text: '#757575', dot: '#757575' },
};

function Initials({ nombre, size = 34 }) {
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

export default function LiderDashboardScreen() {
  const { user, logout, updateProfile } = useAuth();

  const [lineaLocal, setLineaLocal]       = useState(user?.linea_uph || null);
  const [turnoLocal, setTurnoLocal]       = useState(user?.turno_actual || 'A');
  const [cambiarLinea, setCambiarLinea]   = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [savedAnim] = useState(new Animated.Value(0));

  const [resumenLinea, setResumenLinea]   = useState(null);
  const [turnoActivo, setTurnoActivo]     = useState(null);
  const [operadoresHoy, setOperadoresHoy] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadingOps, setLoadingOps]       = useState(false);
  const [refreshing, setRefreshing]       = useState(false);

  const saveTimeout = useRef(null);

  // ── Guardar perfil con debounce ────────────────────────────
  const guardarPerfil = useCallback(async (linea, turno) => {
    setGuardandoPerfil(true);
    const result = await updateProfile({ linea_uph: linea, turno_actual: turno });
    setGuardandoPerfil(false);
    if (result.success) {
      Animated.sequence([
        Animated.timing(savedAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(savedAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [updateProfile, savedAnim]);

  const handleLineaChange = (linea) => {
    setLineaLocal(linea);
    setCambiarLinea(false);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => guardarPerfil(linea, turnoLocal), 600);
  };

  const handleTurnoChange = (turno) => {
    setTurnoLocal(turno);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => guardarPerfil(lineaLocal, turno), 600);
  };

  // ── Cargar operadores del día ──────────────────────────────
  const cargarOperadores = useCallback(async (linea) => {
    if (!linea) return;
    setLoadingOps(true);
    const r = await uphService.getScoreboardHoy(linea);
    if (r.success) {
      // Deduplicar por num_empleado, sumar piezas de todas sus estaciones
      const map = {};
      for (const item of (r.data?.scoreboard || [])) {
        if (!item.num_empleado) continue;
        if (!map[item.num_empleado]) {
          map[item.num_empleado] = { ...item };
        } else {
          map[item.num_empleado].total_hoy += item.total_hoy;
        }
      }
      setOperadoresHoy(Object.values(map).sort((a, b) => b.total_hoy - a.total_hoy));
    }
    setLoadingOps(false);
  }, []);

  // ── Cargar resumen de línea ────────────────────────────────
  const cargar = useCallback(async () => {
    const [rResumen, rTurno] = await Promise.all([
      uphService.getResumen(),
      uphService.getTurnoActual(),
    ]);
    if (rResumen.success && lineaLocal) {
      const lineas = rResumen.data?.lineas || [];
      setResumenLinea(lineas.find(l => l.linea === lineaLocal) || null);
    }
    if (rTurno.success) setTurnoActivo(rTurno.data);
    setLoading(false);
    setRefreshing(false);
    cargarOperadores(lineaLocal);
  }, [lineaLocal, cargarOperadores]);

  useEffect(() => { cargar(); }, [cargar]);

  // Recargar cada vez que el tab vuelve a estar visible
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = () => { setRefreshing(true); cargar(); };

  const handleLogout = () => {
    showAlert('Cerrar sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const nombre   = user?.nombre || 'Líder';
  const semaforo = resumenLinea ? (COLOR_SEMAFORO[resumenLinea.color] || COLOR_SEMAFORO.gris) : null;
  const pct      = resumenLinea?.uph_meta > 0
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
          {/* ── Header ───────────────────────────────────── */}
          <View style={s.header}>
            <View>
              <Text style={s.greeting}>Hola, {nombre.split(' ')[0]}</Text>
              <Text style={s.role}>Líder de línea</Text>
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Text style={s.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>

          {/* ── Mi línea ─────────────────────────────────── */}
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
                    <TouchableOpacity
                      key={l}
                      style={[s.chip, lineaLocal === l && s.chipActivo]}
                      onPress={() => handleLineaChange(l)}
                    >
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

          {/* ── Mi turno ─────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.secLabel}>MI TURNO</Text>
            <View style={s.chipRow}>
              {TURNOS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.chip, s.chipTurno, turnoLocal === t && s.chipTurnoActivo]}
                  onPress={() => handleTurnoChange(t)}
                >
                  <Text style={[s.chipText, turnoLocal === t && s.chipTextActivo]}>Turno {t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Resumen de la línea hoy ───────────────────── */}
          {lineaLocal && (
            <>
              <Text style={[s.secLabel, { marginTop: 4 }]}>
                MI LÍNEA HOY — {lineaLocal}
              </Text>

              {loading ? (
                <ActivityIndicator color="#2196F3" style={{ marginVertical: 20 }} />
              ) : resumenLinea ? (
                <View style={[s.lineaCard, semaforo && { borderColor: semaforo.border, backgroundColor: semaforo.bg }]}>
                  <View style={s.lineaCardTop}>
                    <View style={[s.dot, semaforo && { backgroundColor: semaforo.dot }]} />
                    <Text style={s.modeloNombre}>
                      {resumenLinea.modelo || 'Sin modelo asignado'}
                    </Text>
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

          {/* ── Tus operadores hoy ───────────────────────── */}
          {lineaLocal && (
            <View style={{ marginTop: 4 }}>
              <Text style={s.secLabel}>TUS OPERADORES HOY</Text>

              {loadingOps ? (
                <ActivityIndicator color="#2196F3" style={{ marginVertical: 12 }} />
              ) : operadoresHoy.length === 0 ? (
                <View style={s.emptyOpsCard}>
                  <Text style={s.emptyOpsText}>Sin operadores asignados hoy</Text>
                </View>
              ) : (
                <View style={s.opsGrid}>
                  {operadoresHoy.map((op, i) => (
                    <View key={op.num_empleado || i} style={s.opCard}>
                      <Initials nombre={op.nombre} size={36} />
                      <Text style={s.opNombre} numberOfLines={1}>
                        {(op.nombre || '—').split(' ')[0]}
                      </Text>
                      <Text style={s.opCount}>{op.total_hoy}</Text>
                      <Text style={s.opCountLabel}>pzs hoy</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Turno activo del servidor ─────────────────── */}
          {turnoActivo && (
            <View style={s.turnoCard}>
              <Text style={s.secLabel}>TURNO DETECTADO</Text>
              <View style={s.turnoRow}>
                <View style={s.turnoBadge}>
                  <Text style={s.turnoBadgeLetra}>{turnoActivo.nombre || '—'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.turnoHorario}>
                    {turnoActivo.hora_inicio && turnoActivo.hora_fin
                      ? `${turnoActivo.hora_inicio} – ${turnoActivo.hora_fin}`
                      : 'Horario no configurado'
                    }
                  </Text>
                  {turnoActivo.nombre !== turnoLocal && (
                    <TouchableOpacity onPress={() => handleTurnoChange(turnoActivo.nombre)}>
                      <Text style={s.turnoSync}>
                        Sincronizar con Turno {turnoActivo.nombre} →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  gradient:  { position: 'absolute', left: 0, right: 0, top: 0, height: 180 },
  safe:      { flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  greeting:   { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  role:       { color: '#90CAF9', fontSize: 13, marginTop: 2 },
  logoutBtn:  {
    backgroundColor: '#B71C1C33', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: '#B71C1C',
  },
  logoutText: { color: '#EF9A9A', fontSize: 13, fontWeight: 'bold' },

  section:  { marginBottom: 16 },
  secRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  secLabel: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  savedText:{ color: '#4CAF50', fontSize: 12 },

  // Línea fija
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

  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:            {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2D2D2D',
  },
  chipActivo:      { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  chipTurno:       { paddingHorizontal: 20 },
  chipTurnoActivo: { backgroundColor: '#4A148C', borderColor: '#7B1FA2' },
  chipText:        { color: '#757575', fontSize: 14, fontWeight: 'bold' },
  chipTextActivo:  { color: '#FFFFFF' },

  // Card línea hoy
  lineaCard:     { borderRadius: 14, padding: 16, borderWidth: 1.5, marginBottom: 16 },
  lineaCardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot:           { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  modeloNombre:  { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', flex: 1 },
  metricasRow:   { flexDirection: 'row', alignItems: 'center' },
  metrica:       { flex: 1, alignItems: 'center' },
  metricaLabel:  { color: '#757575', fontSize: 10, marginBottom: 4, textAlign: 'center' },
  metricaValor:  { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  metricaUnidad: { color: '#616161', fontSize: 10, marginTop: 2, textAlign: 'center' },
  metricaSep:    { width: 1, height: 40, backgroundColor: '#2D2D2D', marginHorizontal: 4 },

  emptyCard: {
    backgroundColor: '#141414', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2D2D2D', marginBottom: 16,
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: '#9E9E9E', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  emptyHint: { color: '#616161', fontSize: 12 },

  // Operadores hoy
  emptyOpsCard: {
    backgroundColor: '#141414', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2D2D2D', marginBottom: 16,
  },
  emptyOpsText: { color: '#616161', fontSize: 13 },

  opsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  opCard:  {
    backgroundColor: '#141414', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#2D2D2D',
    minWidth: 76, flex: 1,
  },
  avatar:       { backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  avatarText:   { color: '#FFFFFF', fontWeight: 'bold' },
  opNombre:     { color: '#BDBDBD', fontSize: 12, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  opCount:      { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  opCountLabel: { color: '#616161', fontSize: 10 },

  // Turno card
  turnoCard:        { backgroundColor: '#141414', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2D2D2D' },
  turnoRow:         { flexDirection: 'row', alignItems: 'center' },
  turnoBadge:       {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#1A237E33', borderWidth: 1.5, borderColor: '#3949AB',
    justifyContent: 'center', alignItems: 'center',
  },
  turnoBadgeLetra:  { color: '#90CAF9', fontSize: 22, fontWeight: 'bold' },
  turnoHorario:     { color: '#BDBDBD', fontSize: 16, fontWeight: '600' },
  turnoSync:        { color: '#2196F3', fontSize: 12, marginTop: 4 },
});
