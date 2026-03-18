import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Text,
  Modal, FlatList, Platform, RefreshControl, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { showAlert } from '../utils/alertUtils';
import { uphService } from '../services/UPHService';
import { useAuth } from '../contexts/AuthContext';

const MAX_SLOTS = 4;

// ── Avatar con iniciales ────────────────────────────────────
function Iniciales({ nombre, size = 40 }) {
  const parts = (nombre || '?').trim().split(' ');
  const text = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.text, { fontSize: size * 0.33 }]}>{text}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { backgroundColor: '#1565C044', borderWidth: 1, borderColor: '#1565C0', justifyContent: 'center', alignItems: 'center' },
  text:   { color: '#90CAF9', fontWeight: 'bold' },
});

const FILTROS_TURNO = ['Todos', 'A', 'B', 'C'];

// ── Modal selector de operador con filtro por turno ─────────
function ModalOperador({ visible, operadores, onSelect, onClose }) {
  const [filtro, setFiltro] = useState('Todos');

  const lista = filtro === 'Todos'
    ? operadores
    : operadores.filter(o => o.turno === filtro);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.modalOverlay}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Seleccionar operador</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={s.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Filtro por turno */}
          <View style={s.filtroRow}>
            {FILTROS_TURNO.map(f => (
              <TouchableOpacity
                key={f}
                style={[s.filtroChip, filtro === f && s.filtroChipActivo]}
                onPress={() => setFiltro(f)}
              >
                <Text style={[s.filtroChipText, filtro === f && s.filtroChipTextActivo]}>
                  {f === 'Todos' ? 'Todos' : `Turno ${f}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={lista}
            keyExtractor={item => item.num_empleado}
            style={{ maxHeight: 380 }}
            ListEmptyComponent={<Text style={s.emptyText}>Sin operadores en este turno</Text>}
            ItemSeparatorComponent={() => <View style={s.itemSep} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.opCard} onPress={() => onSelect(item)}>
                <Iniciales nombre={item.nombre} />
                <View style={{ flex: 1, marginLeft: 10 }}>
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

// ── Pantalla principal ──────────────────────────────────────
export default function AsignacionLideraScreen() {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const lineaUsuario  = user?.linea_uph;
  const turnoUsuario  = user?.turno_actual;

  const [operadores,        setOperadores]        = useState([]);
  const [modelos,           setModelos]           = useState([]);
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [modeloSeleccionado,setModeloSeleccionado]= useState(null);

  // Slots de operadores: mínimo 2, máximo 4
  const [numSlots,  setNumSlots]  = useState(2);
  const [asignacion,setAsignacion]= useState({}); // { slotIdx: operador }
  const [slotModal, setSlotModal] = useState(null);

  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loadingModelos,setLoadingModelos]=useState(false);
  const [guardando,    setGuardando]    = useState(false);

  const hoy = new Date().toISOString().split('T')[0];

  // ── Carga inicial ───────────────────────────────────────
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

    // Turno del perfil o del servidor (solo para el header / bulk save)
    const turnosData = (rTurnos.success && rTurnos.data?.length > 0)
      ? rTurnos.data
      : [
          { id: 'A', nombre: 'A', hora_inicio: '06:00', hora_fin: '18:00' },
          { id: 'B', nombre: 'B', hora_inicio: '18:00', hora_fin: '06:00' },
          { id: 'C', nombre: 'C', hora_inicio: '08:00', hora_fin: '20:00' },
        ];
    let elegido = turnoUsuario
      ? turnosData.find(t => t.nombre === turnoUsuario) || null
      : null;
    if (!elegido) {
      const rActual = await uphService.getTurnoActual();
      elegido = rActual.success ? rActual.data : turnosData[0];
    }
    setTurnoSeleccionado(elegido);

    if (rOps.success) setOperadores(rOps.data);
    setLoading(false);
    setRefreshing(false);
  }, [lineaUsuario, turnoUsuario]);

  useEffect(() => { cargarInicial(); }, [cargarInicial]);

  // ── Carga modelos de la línea ───────────────────────────
  useEffect(() => {
    if (!lineaSeleccionada) return;
    async function cargarModelos() {
      setLoadingModelos(true);
      setModeloSeleccionado(null);
      const r = await uphService.getModelosPorLinea(lineaSeleccionada.nombre);
      if (r.success) {
        setModelos(r.data);
        if (r.data.length > 0) setModeloSeleccionado(r.data[0]);
      } else {
        setModelos([]);
      }
      setLoadingModelos(false);
    }
    cargarModelos();
  }, [lineaSeleccionada]);

  // ── Métricas UPH ───────────────────────────────────────
  const uphPorOp  = modeloSeleccionado && numSlots > 0
    ? Math.round(modeloSeleccionado.uph_total / numSlots)
    : null;
  const metaTurno = modeloSeleccionado
    ? Math.round(modeloSeleccionado.uph_total * 12)
    : null;

  const opsAsignados = Object.keys(asignacion).length;

  // ── Agregar / quitar slots ──────────────────────────────
  const addSlot = () => setNumSlots(n => Math.min(n + 1, MAX_SLOTS));
  const removeSlot = (idx) => {
    setNumSlots(n => Math.max(n - 1, 1));
    setAsignacion(prev => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
  };

  // ── Guardar ─────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!lineaSeleccionada) return showAlert('Falta línea', 'Configura tu línea en Inicio.');
    if (opsAsignados === 0)  return showAlert('Sin operadores', 'Asigna al menos un operador.');

    const items = [];
    Array.from({ length: numSlots }).forEach((_, idx) => {
      const op = asignacion[idx];
      if (op) items.push({ estacion: `slot_${idx + 1}`, num_empleado: op.num_empleado });
    });

    setGuardando(true);
    const turnoId = turnoSeleccionado && typeof turnoSeleccionado.id === 'number'
      ? turnoSeleccionado.id : null;
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

        {/* ── Header ──────────────────────────────────────── */}
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
              <Text style={s.turnoBadgeHora}>
                {turnoSeleccionado.hora_inicio}–{turnoSeleccionado.hora_fin}
              </Text>
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
          {/* ── Selector de modelo ──────────────────────── */}
          <Text style={s.secLabel}>MODELO</Text>
          {loadingModelos ? (
            <ActivityIndicator size="small" color="#2196F3" style={{ marginBottom: 12 }} />
          ) : modelos.length > 0 ? (
            <>
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

              {/* ── Card UPH ─────────────────────────────── */}
              {modeloSeleccionado && (
                <View style={s.uphCard}>
                  <LinearGradient
                    colors={['#0D2137', '#0A1628']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>UPH LÍNEA</Text>
                    <Text style={s.uphValor}>{modeloSeleccionado.uph_total}</Text>
                    <Text style={s.uphUnidad}>pzs / hr</Text>
                  </View>
                  <View style={s.uphSep} />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>UPH / OP</Text>
                    <Text style={[s.uphValor, { color: '#42A5F5' }]}>{uphPorOp ?? '—'}</Text>
                    <Text style={s.uphUnidad}>pzs / hr</Text>
                  </View>
                  <View style={s.uphSep} />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>META TURNO</Text>
                    <Text style={[s.uphValor, { color: '#66BB6A' }]}>{metaTurno ?? '—'}</Text>
                    <Text style={s.uphUnidad}>pzs</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={s.sinModeloCard}>
              <Text style={s.sinModeloIcon}>🔧</Text>
              <Text style={s.sinModeloText}>Sin modelos configurados</Text>
              <Text style={s.sinModeloHint}>El administrador debe configurar los modelos para esta línea</Text>
            </View>
          )}

          {/* ── Slots de operadores ──────────────────────── */}
          <View style={s.opsHeader}>
            <Text style={s.secLabel}>OPERADORES</Text>
            <View style={s.opsPill}>
              <Text style={s.opsPillText}>{opsAsignados} / {numSlots}</Text>
            </View>
          </View>

          {Array.from({ length: numSlots }).map((_, idx) => {
            const op = asignacion[idx];
            return (
              <View key={idx} style={[s.opSlot, op ? s.opSlotAsignado : s.opSlotVacioStyle]}>
                {/* Número del slot */}
                <View style={[s.opSlotNumero, op && s.opSlotNumeroAsignado]}>
                  <Text style={[s.opSlotNumeroText, op && s.opSlotNumeroTextAsignado]}>{idx + 1}</Text>
                </View>

                {op ? (
                  /* Slot asignado */
                  <View style={s.opSlotInfo}>
                    <Iniciales nombre={op.nombre} size={42} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.opSlotNombre}>{op.nombre}</Text>
                      <View style={s.opSlotSubRow}>
                        <Text style={s.opSlotNumEmp}>#{op.num_empleado}</Text>
                        {uphPorOp ? (
                          <View style={s.uphMiniChip}>
                            <Text style={s.uphMiniChipText}>{uphPorOp} pzs/hr</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity style={s.opSlotCambiar} onPress={() => setSlotModal(idx)}>
                      <Text style={s.opSlotCambiarText}>Cambiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.opSlotQuitar} onPress={() => removeSlot(idx)}>
                      <Text style={s.opSlotQuitarText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Slot vacío */
                  <View style={s.opSlotVacioRow}>
                    <TouchableOpacity style={s.opSlotVacio} onPress={() => setSlotModal(idx)}>
                      <Text style={s.opSlotVacioIcon}>＋</Text>
                      <Text style={s.opSlotVacioText}>Asignar operador</Text>
                    </TouchableOpacity>
                    {numSlots > 1 && (
                      <TouchableOpacity style={s.opSlotEliminar} onPress={() => removeSlot(idx)}>
                        <Text style={s.opSlotQuitarText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* ── Botón agregar slot ──────────────────────── */}
          {numSlots < MAX_SLOTS && (
            <TouchableOpacity style={s.addSlotBtn} onPress={addSlot}>
              <Text style={s.addSlotText}>＋  Agregar operador</Text>
            </TouchableOpacity>
          )}

        </ScrollView>

        {/* ── Botón guardar ───────────────────────────── */}
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

        <ModalOperador
          visible={slotModal !== null}
          operadores={operadores}
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
  safeArea:  { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },

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
  turnoBadgeHora:  { color: '#9FA8DA', fontSize: 10 },
  configHint: { color: '#EF9A9A', fontSize: 11, paddingHorizontal: 16, marginBottom: 6 },

  scroll: { paddingHorizontal: 14, paddingBottom: 90 },

  // Labels / chips
  secLabel: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  chipRow:  { marginBottom: 4, maxHeight: 44 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', marginRight: 8,
  },
  chipModelo:     { backgroundColor: '#4A148C', borderColor: '#7B1FA2' },
  chipText:       { color: '#9E9E9E', fontSize: 13 },
  chipTextActivo: { color: '#FFFFFF', fontWeight: 'bold' },

  // Sin modelo
  sinModeloCard: {
    backgroundColor: '#0F1923', borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#1E2D3D', marginBottom: 4,
  },
  sinModeloIcon: { fontSize: 28, marginBottom: 8 },
  sinModeloText: { color: '#546E7A', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sinModeloHint: { color: '#37474F', fontSize: 12, textAlign: 'center' },

  // UPH card
  uphCard: {
    flexDirection: 'row', borderRadius: 14, padding: 18,
    marginTop: 10, marginBottom: 4,
    borderWidth: 1, borderColor: '#1E3A5F', overflow: 'hidden',
  },
  uphBloque:  { flex: 1, alignItems: 'center' },
  uphLabel:   { color: '#546E7A', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
  uphValor:   { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
  uphUnidad:  { color: '#37474F', fontSize: 10, marginTop: 3 },
  uphSep:     { width: 1, height: 48, backgroundColor: '#1E3A5F88', marginHorizontal: 4, alignSelf: 'center' },

  // Operadores header
  opsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opsCount:  { color: '#616161', fontSize: 12 },
  opsPill: {
    backgroundColor: '#1565C022', borderRadius: 10, borderWidth: 1, borderColor: '#1565C0',
    paddingHorizontal: 10, paddingVertical: 3,
  },
  opsPillText: { color: '#42A5F5', fontSize: 12, fontWeight: 'bold' },

  // Slot base
  opSlot: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    marginBottom: 10, padding: 14, minHeight: 72,
    overflow: 'hidden',
  },
  opSlotAsignado:  { borderColor: '#2E7D32', backgroundColor: '#071A0A' },
  opSlotVacioStyle:{ borderColor: '#1E2D3D', backgroundColor: '#0A1422', borderStyle: 'dashed' },

  opSlotNumero: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: '#1E3A5F',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  opSlotNumeroAsignado:     { backgroundColor: '#1B5E2044', borderColor: '#2E7D32' },
  opSlotNumeroText:         { color: '#546E7A', fontSize: 13, fontWeight: 'bold' },
  opSlotNumeroTextAsignado: { color: '#66BB6A' },

  opSlotInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center' },
  opSlotNombre:  { color: '#ECEFF1', fontSize: 15, fontWeight: '700' },
  opSlotSubRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  opSlotNumEmp:  { color: '#546E7A', fontSize: 11 },
  uphMiniChip: {
    backgroundColor: '#0D47A122', borderRadius: 6, borderWidth: 1, borderColor: '#1565C0',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  uphMiniChipText: { color: '#42A5F5', fontSize: 10, fontWeight: 'bold' },

  opSlotCambiar: {
    backgroundColor: '#1A237E22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#3949AB55', marginLeft: 6,
  },
  opSlotCambiarText: { color: '#7986CB', fontSize: 11, fontWeight: '600' },
  opSlotQuitar:      { padding: 6, marginLeft: 2 },
  opSlotQuitarText:  { color: '#EF5350', fontSize: 16 },

  opSlotVacioRow:  { flex: 1, flexDirection: 'row', alignItems: 'center' },
  opSlotVacio:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 8 },
  opSlotVacioIcon: { color: '#1E3A5F', fontSize: 20, fontWeight: 'bold' },
  opSlotVacioText: { color: '#37474F', fontSize: 14, fontWeight: '600' },
  opSlotEliminar:  { padding: 6 },

  // Add slot
  addSlotBtn: {
    borderWidth: 1.5, borderColor: '#1E3A5F', borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, backgroundColor: '#060E17',
  },
  addSlotText: { color: '#1E88E5', fontSize: 14, fontWeight: '600' },

  // Guardar
  guardarBtn: {
    margin: 14, backgroundColor: '#1565C0', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  guardarBtnDisabled: { backgroundColor: '#1A1A1A' },
  guardarBtnText:     { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalCerrar: { color: '#9E9E9E', fontSize: 20 },
  opCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  opNombre:  { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  opNum:     { color: '#757575', fontSize: 11, marginTop: 1 },
  itemSep:   { height: 1, backgroundColor: '#1E1E1E' },
  emptyText: { color: '#616161', textAlign: 'center', padding: 20 },

  // Filtro turno modal
  filtroRow:           { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filtroChip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: '#2D2D2D' },
  filtroChipActivo:    { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  filtroChipText:      { color: '#757575', fontSize: 12, fontWeight: 'bold' },
  filtroChipTextActivo:{ color: '#FFFFFF' },
  opTurnoBadge:        { backgroundColor: '#1A237E44', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#3949AB' },
  opTurnoBadgeText:    { color: '#90CAF9', fontSize: 11, fontWeight: 'bold' },
});
