import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Text,
  Modal, TextInput, SectionList, KeyboardAvoidingView, Platform, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { showAlert } from '../utils/alertUtils';
import { uphService } from '../services/UPHService';
import { useAuth } from '../contexts/AuthContext';

// ── Avatar con iniciales ──────────────────────────────────────
function Iniciales({ nombre, size = 40 }) {
  const parts = nombre.trim().split(' ');
  const text = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.text, { fontSize: size * 0.33 }]}>{text.toUpperCase()}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { backgroundColor: '#1565C044', borderWidth: 1, borderColor: '#1565C0', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#90CAF9', fontWeight: 'bold' },
});

// ── Modal selector de operador (agrupado por turno) ──────────
function ModalOperador({ visible, operadores, turnoActivo, onSelect, onClose }) {
  const [busqueda, setBusqueda] = useState('');

  const secciones = useMemo(() => {
    const q = busqueda.toLowerCase();
    const todos = q
      ? operadores.filter(o =>
          o.nombre.toLowerCase().includes(q) || o.num_empleado.includes(q)
        )
      : operadores;

    const grupos = {};
    todos.forEach(o => {
      const t = o.turno || 'Sin turno';
      if (!grupos[t]) grupos[t] = [];
      grupos[t].push(o);
    });

    const orden = ['A', 'B', 'C', 'Sin turno'];
    const claves = Object.keys(grupos).sort((a, b) => {
      const ia = a === turnoActivo ? -1 : orden.indexOf(a);
      const ib = b === turnoActivo ? -1 : orden.indexOf(b);
      return ia - ib;
    });

    return claves.map(t => ({ title: t, esActivo: t === turnoActivo, data: grupos[t] }));
  }, [busqueda, operadores, turnoActivo]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Seleccionar operador</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={s.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={s.busquedaInput}
            placeholder="Buscar por nombre o #empleado..."
            placeholderTextColor="#616161"
            value={busqueda}
            onChangeText={setBusqueda}
            autoFocus
          />

          <SectionList
            sections={secciones}
            keyExtractor={item => item.num_empleado}
            style={{ maxHeight: 380 }}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={<Text style={s.emptyText}>Sin resultados</Text>}
            renderSectionHeader={({ section }) => (
              <View style={[s.turnoHeader, section.esActivo && s.turnoHeaderActivo]}>
                <Text style={[s.turnoHeaderText, section.esActivo && s.turnoHeaderTextActivo]}>
                  Turno {section.title}{section.esActivo ? '  ★ tu turno' : ''}
                </Text>
                <Text style={s.turnoHeaderCount}>{section.data.length}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.opCard}
                onPress={() => { onSelect(item); setBusqueda(''); }}
              >
                <Iniciales nombre={item.nombre} />
                <View style={{ flex: 1 }}>
                  <Text style={s.opNombre}>{item.nombre}</Text>
                  <Text style={s.opNum}>#{item.num_empleado}</Text>
                </View>
                {item.turno && (
                  <View style={s.opTurnoBadge}>
                    <Text style={s.opTurnoBadgeText}>{item.turno}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────
export default function AsignacionLideraScreen() {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const lineaUsuario = user?.linea_uph;
  const turnoUsuario = user?.turno_actual;

  const [turnos, setTurnos] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [modelos, setModelos] = useState([]);

  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [modeloSeleccionado, setModeloSeleccionado] = useState(null);
  const [estaciones, setEstaciones] = useState([]);

  // Asignación por slot de operador (índice del grupo)
  const [asignacion, setAsignacion] = useState({}); // { 0: op, 1: op, ... }
  const [slotModal, setSlotModal] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingLinea, setLoadingLinea] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const hoy = new Date().toISOString().split('T')[0];

  // ── Carga inicial ─────────────────────────────────────────
  const cargarInicial = useCallback(async () => {
    const [rLineas, rTurnos, rOps] = await Promise.all([
      uphService.getLineas(),
      uphService.getTurnos(),
      uphService.getOperadores(),
    ]);
    if (rLineas.success && rLineas.data.length > 0) {
      const linea = lineaUsuario
        ? rLineas.data.find(l => l.nombre === lineaUsuario) || rLineas.data[0]
        : rLineas.data[0];
      setLineaSeleccionada(linea);
    }
    const turnosData = (rTurnos.success && rTurnos.data?.length > 0)
      ? rTurnos.data
      : [
          { id: 'A', nombre: 'A', hora_inicio: '06:00', hora_fin: '18:00' },
          { id: 'B', nombre: 'B', hora_inicio: '18:00', hora_fin: '06:00' },
          { id: 'C', nombre: 'C', hora_inicio: '08:00', hora_fin: '20:00' },
        ];
    setTurnos(turnosData);
    let elegido = turnoUsuario
      ? turnosData.find(t => t.nombre === turnoUsuario) || null
      : null;
    if (!elegido) {
      const rActual = await uphService.getTurnoActual();
      elegido = rActual.success ? rActual.data : null;
      if (!elegido) elegido = turnosData[0];
    }
    setTurnoSeleccionado(elegido);
    if (rOps.success) setOperadores(rOps.data);
    setLoading(false);
    setRefreshing(false);
  }, [lineaUsuario, turnoUsuario]);

  useEffect(() => { cargarInicial(); }, [cargarInicial]);

  // ── Carga datos de línea ──────────────────────────────────
  useEffect(() => {
    if (!lineaSeleccionada) return;
    async function cargarLinea() {
      setLoadingLinea(true);
      setEstaciones([]);
      setAsignacion({});
      setModeloSeleccionado(null);
      const [rEst, rMod] = await Promise.all([
        uphService.getEstacionesPorLinea(lineaSeleccionada.nombre),
        uphService.getModelosPorLinea(lineaSeleccionada.nombre),
      ]);
      if (rEst.success) setEstaciones(rEst.data.estaciones || []);
      if (rMod.success) {
        setModelos(rMod.data);
        if (rMod.data.length > 0) setModeloSeleccionado(rMod.data[0]);
      }
      setLoadingLinea(false);
    }
    cargarLinea();
  }, [lineaSeleccionada]);

  // ── Grupos de estaciones (3 estaciones = 1 operador) ──────
  const grupos = useMemo(() => {
    const g = [];
    for (let i = 0; i < estaciones.length; i += 3) g.push(estaciones.slice(i, i + 3));
    return g;
  }, [estaciones]);

  const numOps = grupos.length;
  const opsAsignados = Object.keys(asignacion).length;
  const uphPorOp = modeloSeleccionado && numOps > 0
    ? Math.round(modeloSeleccionado.uph_total / numOps)
    : null;
  const metaTurno = modeloSeleccionado ? Math.round(modeloSeleccionado.uph_total * 12) : null;

  // ── Guardar ───────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!lineaSeleccionada) return showAlert('Falta línea', 'Configura tu línea en Inicio.');
    if (!turnoSeleccionado) return showAlert('Falta turno', 'Selecciona un turno.');
    if (opsAsignados === 0) return showAlert('Sin operadores', 'Asigna al menos un operador.');

    // Cada operador se asigna a todas las estaciones de su grupo
    const items = [];
    grupos.forEach((grupo, idx) => {
      const op = asignacion[idx];
      if (op) grupo.forEach(est => items.push({ estacion: est, num_empleado: op.num_empleado }));
    });

    setGuardando(true);
    const turnoId = typeof turnoSeleccionado.id === 'number' ? turnoSeleccionado.id : null;
    const result = await uphService.asignarBulk(
      lineaSeleccionada.nombre, hoy,
      turnoId, modeloSeleccionado?.id || null, items,
    );
    setGuardando(false);
    if (result.success) {
      showAlert('✅ Listo', `${opsAsignados} operador(es) asignados en ${lineaSeleccionada.nombre}.`);
    } else {
      showAlert('Error', result.error);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={[s.container, isWeb && webStyles.container]}>
      <LinearGradient colors={['#1A237E', '#0F0F0F']} style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.35 }} />

      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerFecha}>📅 {hoy}</Text>
            {lineaUsuario
              ? <Text style={s.headerLinea}>{lineaSeleccionada?.nombre || lineaUsuario}</Text>
              : <Text style={[s.headerLinea, { color: '#EF9A9A' }]}>⚠️ Sin línea</Text>
            }
          </View>
          {turnoSeleccionado && (
            <View style={s.turnoBadge}>
              <Text style={s.turnoBadgeLabel}>TURNO</Text>
              <Text style={s.turnoBadgeValor}>{turnoSeleccionado.nombre}</Text>
              <Text style={s.turnoBadgeHora}>{turnoSeleccionado.hora_inicio}–{turnoSeleccionado.hora_fin}</Text>
            </View>
          )}
        </View>

        {!lineaUsuario && (
          <Text style={s.configHint}>Configura tu línea en la pestaña Inicio</Text>
        )}

        <ScrollView
          contentContainerStyle={[
            s.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); cargarInicial(); }}
              tintColor="#2196F3" />
          }
        >
          {/* ── Selector de turno ──────────────────────────── */}
          <Text style={s.secLabel}>TURNO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
            {turnos.map(t => (
              <TouchableOpacity key={t.id}
                style={[s.chip, turnoSeleccionado?.id === t.id && s.chipActivo]}
                onPress={() => setTurnoSeleccionado(t)}
              >
                <Text style={[s.chipText, turnoSeleccionado?.id === t.id && s.chipTextActivo]}>
                  {t.nombre}  {t.hora_inicio}–{t.hora_fin}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Selector de modelo ─────────────────────────── */}
          {loadingLinea ? (
            <ActivityIndicator size="small" color="#2196F3" style={{ marginVertical: 16 }} />
          ) : modelos.length > 0 ? (
            <>
              <Text style={s.secLabel}>MODELO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
                {modelos.map(m => (
                  <TouchableOpacity key={m.id}
                    style={[s.chip, modeloSeleccionado?.id === m.id && s.chipModelo]}
                    onPress={() => setModeloSeleccionado(m)}
                  >
                    <Text style={[s.chipText, modeloSeleccionado?.id === m.id && s.chipTextActivo]}>
                      {m.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* ── Card UPH ───────────────────────────────── */}
              {modeloSeleccionado && (
                <View style={s.uphCard}>
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>UPH línea</Text>
                    <Text style={s.uphValor}>{modeloSeleccionado.uph_total}</Text>
                    <Text style={s.uphUnidad}>pzs/hr</Text>
                  </View>
                  <View style={s.uphSep} />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>UPH / op</Text>
                    <Text style={[s.uphValor, { color: '#2196F3' }]}>{uphPorOp ?? '—'}</Text>
                    <Text style={s.uphUnidad}>pzs/hr</Text>
                  </View>
                  <View style={s.uphSep} />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>Meta turno</Text>
                    <Text style={[s.uphValor, { color: '#4CAF50' }]}>{metaTurno}</Text>
                    <Text style={s.uphUnidad}>pzs</Text>
                  </View>
                </View>
              )}
            </>
          ) : null}

          {/* ── Slots de operadores ────────────────────────── */}
          {estaciones.length > 0 && (
            <>
              <View style={s.opsHeader}>
                <Text style={s.secLabel}>OPERADORES</Text>
                <Text style={s.opsCount}>{opsAsignados}/{numOps} asignados</Text>
              </View>

              {grupos.map((_grupo, idx) => {
                const op = asignacion[idx];
                return (
                  <View key={idx} style={[s.opSlot, op && s.opSlotAsignado]}>
                    <View style={s.opSlotNumero}>
                      <Text style={s.opSlotNumeroText}>{idx + 1}</Text>
                    </View>

                    {op ? (
                      <View style={s.opSlotInfo}>
                        <Iniciales nombre={op.nombre} size={38} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={s.opSlotNombre}>{op.nombre}</Text>
                          <Text style={s.opSlotSub}>
                            #{op.num_empleado}
                            {uphPorOp ? `  ·  ${uphPorOp} pzs/hr` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity style={s.opSlotCambiar}
                          onPress={() => setSlotModal(idx)}>
                          <Text style={s.opSlotCambiarText}>Cambiar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.opSlotQuitar}
                          onPress={() => setAsignacion(prev => { const n = { ...prev }; delete n[idx]; return n; })}>
                          <Text style={s.opSlotQuitarText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={s.opSlotVacio}
                        onPress={() => setSlotModal(idx)}>
                        <Text style={s.opSlotVacioText}>+ Asignar operador</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* ── Botón guardar ──────────────────────────────── */}
        {estaciones.length > 0 && (
          <TouchableOpacity
            style={[s.guardarBtn, (guardando || opsAsignados === 0) && s.guardarBtnDisabled]}
            onPress={handleGuardar}
            disabled={guardando || opsAsignados === 0}
          >
            {guardando
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.guardarBtnText}>
                  Guardar asignación · {opsAsignados} operador{opsAsignados !== 1 ? 'es' : ''}
                </Text>
            }
          </TouchableOpacity>
        )}

        <ModalOperador
          visible={slotModal !== null}
          operadores={operadores}
          turnoActivo={turnoSeleccionado?.nombre}
          onSelect={(op) => {
            setAsignacion(prev => ({ ...prev, [slotModal]: op }));
            setSlotModal(null);
          }}
          onClose={() => setSlotModal(null)}
        />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
  },
  headerFecha: { color: '#9E9E9E', fontSize: 12, marginBottom: 2 },
  headerLinea: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  turnoBadge: {
    backgroundColor: '#1A237E55', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#3949AB', alignItems: 'center',
  },
  turnoBadgeLabel: { color: '#9FA8DA', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  turnoBadgeValor: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  turnoBadgeHora: { color: '#9FA8DA', fontSize: 10 },
  configHint: { color: '#EF9A9A', fontSize: 11, paddingHorizontal: 16, marginBottom: 6 },

  scroll: { paddingHorizontal: 14, paddingBottom: 90 },

  // Sections
  secLabel: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  chipRow: { marginBottom: 4, maxHeight: 44 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', marginRight: 8,
  },
  chipActivo: { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  chipModelo: { backgroundColor: '#4A148C', borderColor: '#7B1FA2' },
  chipText: { color: '#9E9E9E', fontSize: 13 },
  chipTextActivo: { color: '#FFFFFF', fontWeight: 'bold' },

  // UPH card
  uphCard: {
    flexDirection: 'row', backgroundColor: '#111827',
    borderRadius: 12, padding: 16, marginTop: 10, marginBottom: 4,
    borderWidth: 1, borderColor: '#1E3A5F',
  },
  uphBloque: { flex: 1, alignItems: 'center' },
  uphLabel: { color: '#757575', fontSize: 10, marginBottom: 4, textAlign: 'center' },
  uphValor: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  uphUnidad: { color: '#616161', fontSize: 10, marginTop: 2 },
  uphSep: { width: 1, height: 44, backgroundColor: '#1E3A5F', marginHorizontal: 4, alignSelf: 'center' },

  // Operadores
  opsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  opsCount: { color: '#616161', fontSize: 12 },

  opSlot: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414', borderRadius: 12,
    borderWidth: 1, borderColor: '#2D2D2D',
    marginBottom: 10, padding: 12, minHeight: 64,
  },
  opSlotAsignado: { borderColor: '#2E7D32', backgroundColor: '#0A1F0A' },
  opSlotNumero: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  opSlotNumeroText: { color: '#616161', fontSize: 12, fontWeight: 'bold' },
  opSlotInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  opSlotNombre: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  opSlotSub: { color: '#757575', fontSize: 11, marginTop: 2 },
  opSlotCambiar: {
    backgroundColor: '#1A237E33', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#3949AB', marginLeft: 6,
  },
  opSlotCambiarText: { color: '#90CAF9', fontSize: 11 },
  opSlotQuitar: { padding: 6, marginLeft: 4 },
  opSlotQuitarText: { color: '#F44336', fontSize: 16 },
  opSlotVacio: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  opSlotVacioText: { color: '#424242', fontSize: 14 },

  // Guardar
  guardarBtn: {
    margin: 14, backgroundColor: '#1565C0', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  guardarBtnDisabled: { backgroundColor: '#1A1A1A' },
  guardarBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalCerrar: { color: '#9E9E9E', fontSize: 20 },
  busquedaInput: {
    backgroundColor: '#0F0F0F', color: '#FFFFFF', borderWidth: 1, borderColor: '#333',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: 12,
  },
  opCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  opNombre: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  opNum: { color: '#757575', fontSize: 11, marginTop: 1 },
  opTurnoBadge: { backgroundColor: '#1A237E44', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#3949AB' },
  opTurnoBadgeText: { color: '#90CAF9', fontSize: 11, fontWeight: 'bold' },
  emptyText: { color: '#616161', textAlign: 'center', padding: 20 },
  turnoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, marginTop: 4, borderBottomWidth: 1, borderBottomColor: '#2D2D2D' },
  turnoHeaderActivo: { borderBottomColor: '#2196F3' },
  turnoHeaderText: { color: '#616161', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 },
  turnoHeaderTextActivo: { color: '#2196F3' },
  turnoHeaderCount: { color: '#444', fontSize: 11 },
});
