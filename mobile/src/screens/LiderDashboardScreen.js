import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { uphService } from '../services/UPHService';
import { showAlert } from '../utils/alertUtils';
import { API_BASE_URL } from '../utils/apiClient';
import { useLiderPerfil } from '../contexts/LiderPerfilContext';

const LINEAS = ['HI-1', 'HI-2', 'HI-3', 'HI-4', 'HI-5', 'HI-6'];

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


// ── Avatar líder (foto o iniciales) ──────────────────────
function AvatarLider({ perfil, size = 72 }) {
  const [err, setErr] = useState(false);
  if (!perfil) return null;
  const uri = perfil.foto_url
    ? (perfil.foto_url.startsWith('http') ? perfil.foto_url : `${API_BASE_URL}${perfil.foto_url}`)
    : null;
  const partes = (perfil.nombre || '').trim().split(' ');
  const ini = partes.length >= 2
    ? (partes[0][0] + partes[1][0]).toUpperCase()
    : (perfil.nombre || '?').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
                   overflow: 'hidden', borderWidth: 2, borderColor: '#2196F3' }}>
      {uri && !err ? (
        <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setErr(true)} />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#1565C033', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: size * 0.32 }}>{ini}</Text>
        </View>
      )}
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────
export default function LiderDashboardScreen({ navigation }) {
  const { user, logout, updateProfile } = useAuth();
  const { perfil: liderPerfil } = useLiderPerfil();
  const { perfil: liderPerfil } = useLiderPerfil();

  const turnoAuto = detectarTurno();

  const [lineaLocal, setLineaLocal]     = useState(user?.linea_uph || null);
  const [cambiarLinea, setCambiarLinea] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [savedAnim] = useState(new Animated.Value(0));

  const [resumenLinea, setResumenLinea] = useState(null);
  const [operadoresHoy, setOperadoresHoy] = useState([]);
  const [asignacionHoy, setAsignacionHoy] = useState({ operadores: [], modelo_nombre: null });
  const [planActivo, setPlanActivo] = useState(null);
  const [planDia, setPlanDia] = useState([]);
  const [proximosExpanded, setProximosExpanded] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
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
      const mapEsts = {};
      for (const item of (r.data?.scoreboard || [])) {
        if (!item.num_empleado) continue;
        if (!map[item.num_empleado]) map[item.num_empleado] = { ...item };
        else map[item.num_empleado].total_hoy += item.total_hoy;
        if (!mapEsts[item.num_empleado]) mapEsts[item.num_empleado] = new Set();
        if (item.estacion) mapEsts[item.num_empleado].add(item.estacion);
      }
      setOperadoresHoy(
        Object.values(map)
          .map(op => ({ ...op, total_estaciones: mapEsts[op.num_empleado]?.size || 0 }))
          .sort((a, b) => b.total_hoy - a.total_hoy)
      );
    }
    setLoadingOps(false);
  }, []);

  const cargar = useCallback(async () => {
    const [rResumen, rAsig, rPlan, rDia] = await Promise.all([
      uphService.getResumen(),
      lineaLocal ? uphService.getAsignacionHoy(lineaLocal) : Promise.resolve({ success: false }),
      lineaLocal ? uphService.getPlanLinea(lineaLocal)     : Promise.resolve({ success: false }),
      lineaLocal ? uphService.getPlanDia(lineaLocal)       : Promise.resolve({ success: false }),
    ]);
    if (rResumen.success && lineaLocal) {
      const lineas = rResumen.data?.lineas || [];
      setResumenLinea(lineas.find(l => l.linea === lineaLocal) || null);
    }
    if (rAsig.success) setAsignacionHoy(rAsig.data);
    if (rPlan.success) setPlanActivo(rPlan.data.plan || null);
    if (rDia.success)  setPlanDia(rDia.data.modelos || []);
    setLoading(false);
    setRefreshing(false);
    cargarOperadores(lineaLocal);
  }, [lineaLocal, cargarOperadores]);

  useFocusEffect(useCallback(() => {
    cargar();
    const intervalo = setInterval(cargar, 15000);
    return () => clearInterval(intervalo);
  }, [cargar]));

  const onRefresh = () => { setRefreshing(true); cargar(); };

  const handleAvanzarModelo = () => {
    const lineaId = resumenLinea?.linea_id;
    if (!lineaId) return;
    showAlert(
      'Avanzar al siguiente modelo',
      '¿Confirmas avanzar al siguiente modelo del plan? Esta acción es inmediata.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Avanzar',
          style: 'destructive',
          onPress: async () => {
            setAvanzando(true);
            const r = await uphService.avanzarModelo(lineaId);
            setAvanzando(false);
            if (r.success) {
              showAlert('Listo', `Modelo avanzado: ${r.data?.nuevo_modelo || ''}`, [
                { text: 'OK', onPress: cargar },
              ]);
            } else {
              showAlert('Error', r.error || 'No se pudo avanzar el modelo');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    showAlert('Cerrar sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const nombre = user?.nombre || 'Líder';
  const totalTurno = operadoresHoy.reduce((s, o) => s + (o.total_hoy || 0), 0);

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
                <View style={[s.turnoBadge, { backgroundColor: TURNO_COLOR[turnoAuto] + '33', borderColor: TURNO_COLOR[turnoAuto] }]}>
                  <Text style={[s.turnoBadgeText, { color: TURNO_TEXT[turnoAuto] }]}>
                    T-{turnoAuto}
                  </Text>
                </View>
              </View>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
                <Text style={s.logoutText}>Salir</Text>
              </TouchableOpacity>
              <AvatarLider perfil={liderPerfil} size={72} />
            </View>
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
              ) : (
                <>
                  {/* ── Card modelo activo del plan ── */}
                  {planActivo ? (() => {
                    const producido   = planActivo.piezas_actual || 0;
                    const meta        = planActivo.plan_total || 0;
                    const pctPlan     = meta > 0 ? Math.min(Math.round((producido / meta) * 100), 100) : 0;
                    const uphLinea    = resumenLinea?.uph_meta ?? null;
                    const colorPct    = pctPlan >= 100 ? '#4CAF50' : pctPlan >= 70 ? '#FF9800' : '#42A5F5';
                    return (
                      <View style={s.planCard}>
                        {/* Fila superior: badge + modelo interno */}
                        <View style={s.planCardTop}>
                          <View style={s.planBadge}>
                            <Text style={s.planBadgeText}>EN PRODUCCIÓN</Text>
                          </View>
                          {planActivo.modelo_interno ? (
                            <Text style={s.planModeloInterno} numberOfLines={1}>
                              {planActivo.modelo_interno}
                            </Text>
                          ) : null}
                        </View>

                        {/* Nombre del modelo */}
                        <Text style={s.planModeloNombre}>{planActivo.modelo_nombre}</Text>

                        {/* Métricas */}
                        <View style={s.planMetricasRow}>
                          <View style={s.planMetrica}>
                            <Text style={s.planMetricaVal}>{uphLinea ?? '—'}</Text>
                            <Text style={s.planMetricaLabel}>UPH modelo</Text>
                          </View>
                          <View style={s.planMetricaSep} />
                          <View style={s.planMetrica}>
                            <Text style={s.planMetricaVal}>{meta > 0 ? meta.toLocaleString() : '—'}</Text>
                            <Text style={s.planMetricaLabel}>Plan modelo</Text>
                          </View>
                          <View style={s.planMetricaSep} />
                          <View style={s.planMetrica}>
                            <Text style={[s.planMetricaVal, { color: colorPct }]}>{producido.toLocaleString()}</Text>
                            <Text style={s.planMetricaLabel}>Producidas</Text>
                          </View>
                          <View style={s.planMetricaSep} />
                          <View style={s.planMetrica}>
                            <Text style={[s.planMetricaVal, { color: colorPct }]}>{pctPlan}%</Text>
                            <Text style={s.planMetricaLabel}>Avance</Text>
                          </View>
                        </View>

                        {/* Barra de progreso */}
                        {meta > 0 && (
                          <View style={s.planBarBg}>
                            <View style={[s.planBarFill, { width: `${pctPlan}%`, backgroundColor: colorPct }]} />
                          </View>
                        )}

                        {/* Botón avanzar modelo — solo admin/superadmin */}
                        {(user?.tipo_usuario === 'admin' || user?.tipo_usuario === 'superadmin') &&
                          resumenLinea?.tiene_siguiente && (
                          <TouchableOpacity
                            style={[s.btnAvanzar, avanzando && { opacity: 0.5 }]}
                            onPress={handleAvanzarModelo}
                            disabled={avanzando}
                            activeOpacity={0.75}
                          >
                            <Text style={s.btnAvanzarText}>
                              {avanzando ? 'Avanzando…' : '⏭  Avanzar al siguiente modelo'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })() : (
                    <View style={[s.planCard, { borderColor: '#263238', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }]}>
                      <Text style={{ color: '#37474F', fontSize: 13 }}>Sin modelo asignado por el planner</Text>
                    </View>
                  )}

                  {/* ── Próximos cambios (desplegable) ── */}
                  {planDia.filter(m => !m.es_activo).length > 0 && (
                    <TouchableOpacity
                      style={s.proximosBtn}
                      onPress={() => setProximosExpanded(v => !v)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.proximosBtnText}>Próximos modelos del día</Text>
                        <View style={s.proximosBadge}>
                          <Text style={s.proximosBadgeText}>{planDia.filter(m => !m.es_activo).length}</Text>
                        </View>
                      </View>
                      <Text style={s.proximosArrow}>{proximosExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                  )}
                  {proximosExpanded && planDia.filter(m => !m.es_activo).map((m) => (
                    <View key={m.modelo_id} style={s.proximoRow}>
                      <View style={s.proximoOrden}>
                        <Text style={s.proximoOrdenText}>{m.orden + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.proximoNombre}>{m.modelo_nombre}</Text>
                        {m.modelo_interno ? (
                          <Text style={s.proximoInterno}>{m.modelo_interno}</Text>
                        ) : null}
                      </View>
                      {m.plan_piezas ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.proximoPiezas}>{m.plan_piezas.toLocaleString()}</Text>
                          <Text style={{ color: '#37474F', fontSize: 9 }}>pzs meta</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}

                  {/* ── Métricas UPH ── */}
                  {resumenLinea ? (
                    <View style={[s.lineaCard, semaforo && { borderColor: semaforo.border, backgroundColor: semaforo.bg }]}>
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
            </>
          )}

          {/* ── Operadores hoy ─────────────────────────────── */}
          {lineaLocal && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.secLabel}>TUS OPERADORES HOY</Text>

              {loadingOps ? (
                <ActivityIndicator color="#2196F3" style={{ marginVertical: 12 }} />
              ) : (() => {
                // Si scoreboard vacío pero hay asignados, usar asignados como base
                const opsAsignados = (asignacionHoy.operadores || []).map(op => ({
                  ...op,
                  total_hoy: 0,
                  total_estaciones: op.estaciones?.length || 0,
                }));
                const lista = operadoresHoy.length > 0 ? operadoresHoy : opsAsignados;
                if (lista.length === 0) return (
                  <View style={s.emptyCard}>
                    <Text style={s.emptyOpsText}>Sin operadores asignados hoy</Text>
                  </View>
                );
                return (
                <>
                  {lista.map((op, i) => {
                    const maxPzs = lista[0]?.total_hoy || 1;
                    const pctOp = Math.round(((op.total_hoy || 0) / Math.max(maxPzs, 1)) * 100);
                    return (
                      <TouchableOpacity
                        key={op.num_empleado || i}
                        style={s.opRow}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('OperadorHistorialDia', {
                          num_empleado: op.num_empleado,
                          nombre: op.nombre,
                          foto_url: op.foto_url,
                          linea: lineaLocal,
                        })}
                      >
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
                      </TouchableOpacity>
                    );
                  })}

                  {/* Total línea */}
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Total {lineaLocal || 'línea'}</Text>
                    <Text style={s.totalValor}>{totalTurno.toLocaleString()} pzs</Text>
                  </View>
                </>
                );
              })()}
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
  headerRight:  { alignItems: 'center', gap: 8 },
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

  // Plan del día
  planCard: {
    backgroundColor: '#071A0A', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#2E7D32',
    padding: 16, marginBottom: 8,
  },
  planCardTop:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planModeloNombre:  { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  planModeloInterno: { color: '#546E7A', fontSize: 11, flex: 1 },
  planBadge: {
    backgroundColor: '#1B5E20', borderRadius: 6, borderWidth: 1, borderColor: '#4CAF50',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  planBadgeText: { color: '#A5D6A7', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  planMetricasRow:  { flexDirection: 'row', marginBottom: 12 },
  planMetrica:      { flex: 1, alignItems: 'center' },
  planMetricaVal:   { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  planMetricaLabel: { color: '#546E7A', fontSize: 9, marginTop: 2, textAlign: 'center' },
  planMetricaSep:   { width: 1, height: 36, backgroundColor: '#1B5E20', marginHorizontal: 4, alignSelf: 'center' },
  planBarBg:  { height: 5, backgroundColor: '#0A2E0A', borderRadius: 3, overflow: 'hidden' },
  planBarFill:{ height: 5, borderRadius: 3 },

  // Botón avanzar modelo
  btnAvanzar: {
    marginTop: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#0D3321', borderWidth: 1, borderColor: '#2E7D32',
    alignItems: 'center',
  },
  btnAvanzarText: { color: '#66BB6A', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Próximos cambios
  proximosBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0D1B2A', borderRadius: 10,
    borderWidth: 1, borderColor: '#1A3A5F',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  proximosBtnText:  { color: '#42A5F5', fontSize: 12, fontWeight: '700' },
  proximosBadge:    { backgroundColor: '#1A3A5F', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  proximosBadgeText:{ color: '#42A5F5', fontSize: 11, fontWeight: 'bold' },
  proximosArrow:    { color: '#42A5F5', fontSize: 11 },
  proximoRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#090F18', borderRadius: 10,
    borderWidth: 1, borderColor: '#1A2A3A',
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4, gap: 10,
  },
  proximoOrden: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1A2A3A', justifyContent: 'center', alignItems: 'center',
  },
  proximoOrdenText: { color: '#546E7A', fontSize: 11, fontWeight: 'bold' },
  proximoNombre:    { color: '#CFD8E3', fontSize: 13, fontWeight: '600' },
  proximoInterno:   { color: '#37474F', fontSize: 10, marginTop: 2 },
  proximoPiezas:    { color: '#42A5F5', fontSize: 14, fontWeight: 'bold' },

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
