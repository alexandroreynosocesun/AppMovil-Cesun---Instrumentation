import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Text,
  Modal, FlatList, Platform, RefreshControl, KeyboardAvoidingView, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { showAlert } from '../utils/alertUtils';
import { uphService } from '../services/UPHService';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/apiClient';

const MAX_SLOTS_POR_LINEA = { 'HI-4': 6 };
const getMaxSlots = (linea) => MAX_SLOTS_POR_LINEA[linea] || 4;

// ── Avatar iniciales ────────────────────────────────────────
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

// ── Avatar con foto o iniciales ──────────────────────────────
function AvatarOp({ op, size = 40 }) {
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
  return <Iniciales nombre={op?.nombre} size={size} />;
}

// ── Modal selector de operador ──────────────────────────────
function ModalOperador({ visible, operadores, onSelect, onClose }) {
  const [busqueda, setBusqueda] = useState('');

  const lista = operadores.filter(o => {
    const q = busqueda.toLowerCase();
    return !q
      || (o.nombre || '').toLowerCase().includes(q)
      || (o.num_empleado || '').includes(q);
  });

  const handleClose = () => { setBusqueda(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>Seleccionar operador</Text>
            <TouchableOpacity onPress={handleClose}><Text style={s.modalCerrar}>✕</Text></TouchableOpacity>
          </View>

          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nombre o #empleado..."
            placeholderTextColor="#37474F"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          <FlatList
            data={lista}
            keyExtractor={item => item.num_empleado}
            style={{ maxHeight: 360 }}
            ListEmptyComponent={<Text style={s.emptyText}>Sin resultados</Text>}
            ItemSeparatorComponent={() => <View style={s.itemSep} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.opCard} onPress={() => { setBusqueda(''); onSelect(item); }}>
                <AvatarOp op={item} size={40} />
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
export default function AsignacionLideraScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const lineaUsuario = user?.linea_uph;
  const turnoUsuario = user?.turno_actual;

  const [operadores,         setOperadores]         = useState([]);
  const [modelos,            setModelos]            = useState([]);
  const [todasEstaciones,    setTodasEstaciones]    = useState([]);
  const [lineaSeleccionada,  setLineaSeleccionada]  = useState(null);
  const [turnoSeleccionado,  setTurnoSeleccionado]  = useState(null);
  const [modeloSeleccionado, setModeloSeleccionado] = useState(null);

  // asignacion: { slotIdx: { op: operador, estaciones: ['101','102'] } }
  const [numSlots,     setNumSlots]     = useState(2);
  const [asignacion,   setAsignacion]   = useState({});
  const [expandedSlot, setExpandedSlot] = useState(null); // slot con estaciones expandidas
  const [slotModal,    setSlotModal]    = useState(null);  // slot esperando operador
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [guardando,      setGuardando]      = useState(false);
  const [planInterno,    setPlanInterno]    = useState('');
  const [planActivo,     setPlanActivo]     = useState(null);  // plan multi-turno activo

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
    const turnosData = (rTurnos.success && rTurnos.data?.length > 0)
      ? rTurnos.data
      : [
          { id: 'A', nombre: 'A', hora_inicio: '06:00', hora_fin: '18:00' },
          { id: 'B', nombre: 'B', hora_inicio: '18:00', hora_fin: '06:00' },
          { id: 'C', nombre: 'C', hora_inicio: '08:00', hora_fin: '20:00' },
        ];
    // Siempre detectar turno por hora/día del servidor (ignora perfil de usuario)
    const rActual = await uphService.getTurnoActual();
    let elegido = rActual.success && rActual.data.turno ? rActual.data.turno : turnosData[0];
    setTurnoSeleccionado(elegido);
    if (rOps.success) setOperadores(rOps.data);
    setLoading(false);
    setRefreshing(false);
  }, [lineaUsuario, turnoUsuario]);

  useEffect(() => { cargarInicial(); }, [cargarInicial]);

  // ── Carga modelos + estaciones + asignación del día ─────
  useEffect(() => {
    if (!lineaSeleccionada) return;
    async function cargar() {
      setLoadingModelos(true);
      setExpandedSlot(null);
      const [rMod, rEst, rAsig, rPlan] = await Promise.all([
        uphService.getModelosPorLinea(lineaSeleccionada.nombre),
        uphService.getEstacionesPorLinea(lineaSeleccionada.nombre),
        uphService.getAsignacionHoy(lineaSeleccionada.nombre),
        uphService.getPlanLinea(lineaSeleccionada.nombre),
      ]);

      // Plan multi-turno activo
      const plan = rPlan.success ? rPlan.data.plan : null;
      setPlanActivo(plan);

      let modeloActual = null;
      if (rMod.success) {
        setModelos(rMod.data);
        modeloActual = rMod.data[0] || null;
      } else { setModelos([]); }

      if (rEst.success) setTodasEstaciones(rEst.data.estaciones || []);

      // Restaurar asignación del día si existe
      if (rAsig.success && rAsig.data.operadores?.length > 0) {
        const ops = rAsig.data.operadores;
        const nuevaAsig = {};
        ops.forEach((op, idx) => {
          nuevaAsig[idx] = { op, estaciones: op.estaciones || [] };
        });
        setAsignacion(nuevaAsig);
        setNumSlots(ops.length);
        // Modelo: plan activo tiene prioridad sobre asignación del día
        if (plan && rMod.success) {
          const m = rMod.data.find(x => x.id === plan.modelo_id);
          if (m) modeloActual = m;
        } else if (rAsig.data.modelo_id && rMod.success) {
          const m = rMod.data.find(x => x.id === rAsig.data.modelo_id);
          if (m) modeloActual = m;
        }
        // Cantidad: plan activo > plan_interno de asignación
        if (plan) {
          setPlanInterno(String(plan.plan_total));
        } else if (rAsig.data.plan_interno) {
          setPlanInterno(String(rAsig.data.plan_interno));
        }
      } else {
        setAsignacion({});
        setNumSlots(2);
        // Aunque no haya operadores, pre-llenar desde plan activo
        if (plan && rMod.success) {
          const m = rMod.data.find(x => x.id === plan.modelo_id);
          if (m) modeloActual = m;
          setPlanInterno(String(plan.plan_total));
        }
      }

      setModeloSeleccionado(modeloActual);
      setLoadingModelos(false);
    }
    cargar();
  }, [lineaSeleccionada]);

  // ── Estaciones ya asignadas en OTROS slots ──────────────
  const estacionesOcupadas = (slotIdx) =>
    Object.entries(asignacion)
      .filter(([k]) => parseInt(k) !== slotIdx)
      .flatMap(([_, v]) => v.estaciones || []);

  // ── Toggle estación en un slot ──────────────────────────
  const toggleEstacion = (slotIdx, est) => {
    setAsignacion(prev => {
      const slot = prev[slotIdx] || { op: null, estaciones: [] };
      const ests = slot.estaciones.includes(est)
        ? slot.estaciones.filter(e => e !== est)
        : [...slot.estaciones, est];
      return { ...prev, [slotIdx]: { ...slot, estaciones: ests } };
    });
  };

  // ── Agregar / quitar slots ──────────────────────────────
  const addSlot = () => setNumSlots(n => Math.min(n + 1, getMaxSlots(lineaSeleccionada?.nombre)));
  const removeSlot = (idx) => {
    setNumSlots(n => Math.max(n - 1, 1));
    if (expandedSlot === idx) setExpandedSlot(null);
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

  // ── Asignar operador a slot ─────────────────────────────
  const asignarOperador = (slotIdx, op) => {
    setAsignacion(prev => ({
      ...prev,
      [slotIdx]: { op, estaciones: prev[slotIdx]?.estaciones || [] },
    }));
    setSlotModal(null);
    setExpandedSlot(slotIdx); // expandir para asignar estaciones
  };


  // ── Limpiar asignación del día ──────────────────────────
  const handleLimpiar = () => {
    showAlert(
      'Limpiar operadores',
      '¿Deseas quitar todos los operadores asignados hoy? El modelo se conserva.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar', style: 'destructive',
          onPress: async () => {
            if (lineaSeleccionada) {
              await uphService.limpiarAsignacionHoy(lineaSeleccionada.nombre);
            }
            setAsignacion({});
            setNumSlots(2);
            setExpandedSlot(null);
          },
        },
      ],
    );
  };

  // ── UPH de la línea seleccionada ────────────────────────
  const getUphLinea = (modelo) => {
    if (!modelo || !lineaSeleccionada) return modelo?.uph_total ?? null;
    const num = (lineaSeleccionada.nombre || '').replace(/[^0-9]/g, '');
    const key = num ? `uph_hi${num}` : null;
    return (key && modelo[key] != null) ? modelo[key] : (modelo.uph_total ?? null);
  };

  // ── Métricas ────────────────────────────────────────────
  const opsConOp = Object.values(asignacion).filter(v => v?.op).length;
  // Estaciones seleccionadas hoy (suma de todas las asignadas en slots)
  const estacionesSeleccionadas = Object.values(asignacion)
    .flatMap(v => v?.estaciones || []);
  const numEstSeleccionadas = estacionesSeleccionadas.length;
  const uphLinea = getUphLinea(modeloSeleccionado);
  // UPH/EST solo cuando hay estaciones ya seleccionadas
  const uphPorEst = uphLinea && numEstSeleccionadas > 0
    ? Math.round(uphLinea / numEstSeleccionadas)
    : null;
  const metaTurno = uphLinea ? Math.round(uphLinea * 11) : null; // 12h turno - 1h descanso = 11h efectivas
  const opsAsignados = opsConOp;

  // ── Guardar ─────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!lineaSeleccionada) return showAlert('Falta línea', 'Configura tu línea en Inicio.');
    if (opsAsignados < 2)    return showAlert('Pocos operadores', 'Asigna al menos 2 operadores antes de guardar.');
    const items = [];
    Object.values(asignacion).forEach(v => {
      if (v?.op && v.estaciones.length > 0) {
        v.estaciones.forEach(est => items.push({ estacion: est, num_empleado: v.op.num_empleado }));
      }
    });
    if (items.length === 0) return showAlert('Sin estaciones', 'Abre cada card y selecciona las estaciones.');
    setGuardando(true);
    const turnoId = turnoSeleccionado && typeof turnoSeleccionado.id === 'number'
      ? turnoSeleccionado.id : null;
    const cantidadPlan = planInterno ? parseInt(planInterno) : null;

    const result = await uphService.asignarBulk(
      lineaSeleccionada.nombre, hoy, turnoId, modeloSeleccionado?.id || null, items,
      cantidadPlan,
    );
    setGuardando(false);
    if (result.success) {
      showAlert('✅ Listo', `${opsAsignados} operador(es) asignados en ${lineaSeleccionada.nombre}.`, [
        { text: 'Cerrar', onPress: () => navigation.navigate('Inicio') },
      ]);
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
          <View style={s.headerLeft}>
            <Text style={s.headerFecha}>{hoy}</Text>
            {lineaUsuario ? (
              <View style={s.headerLineaRow}>
                <View style={s.headerLineaDot} />
                <Text style={s.headerLinea}>{lineaSeleccionada?.nombre || lineaUsuario}</Text>
                {turnoSeleccionado && (
                  <View style={s.headerTurnoPill}>
                    <Text style={s.headerTurnoPillText}>T-{turnoSeleccionado.nombre}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={s.headerSinLinea}>⚠️ Sin línea — configura en Inicio</Text>
            )}
          </View>
        </View>

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
          {/* ── Modelo ──────────────────────────────────── */}
          <Text style={s.secLabel}>MODELO</Text>
          {loadingModelos ? (
            <ActivityIndicator size="small" color="#2196F3" style={{ marginBottom: 12 }} />
          ) : (
            <>
              {/* Card modelo — solo lectura (plan asignado por planner) */}
              <View style={[s.modeloItem, s.modeloItemActivo, { marginBottom: 10 }]}>
                <View style={{ flex: 1 }}>
                  {modeloSeleccionado ? (
                    <>
                      <Text style={s.modeloItemNombreActivo}>{modeloSeleccionado.nombre}</Text>
                      {modeloSeleccionado.modelo_interno && (
                        <Text style={s.modeloItemSub}>{modeloSeleccionado.modelo_interno}</Text>
                      )}
                    </>
                  ) : (
                    <Text style={[s.modeloItemNombre, { color: '#37474F' }]}>Sin modelo asignado</Text>
                  )}
                </View>
                {planInterno ? (
                  <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                    <Text style={{ color: '#66BB6A', fontSize: 12, fontWeight: 'bold' }}>{parseInt(planInterno).toLocaleString()} pzs</Text>
                    <Text style={{ color: '#37474F', fontSize: 10 }}>meta del día</Text>
                  </View>
                ) : null}
                <View style={{ backgroundColor: '#1B3A1B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#2E7D32' }}>
                  <Text style={{ color: '#66BB6A', fontSize: 11, fontWeight: 'bold' }}>Plan asignado</Text>
                </View>
              </View>

              {modeloSeleccionado && (
                <View style={s.uphCard}>
                  <LinearGradient colors={['#0D2137', '#0A1628']} style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>UPH {lineaSeleccionada?.nombre ?? 'LÍNEA'}</Text>
                    <Text style={s.uphValor}>{uphLinea ?? '—'}</Text>
                    <Text style={s.uphUnidad}>pzs / hr</Text>
                  </View>
                  <View style={s.uphSep} />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>
                      {numEstSeleccionadas > 0 ? `UPH / ${numEstSeleccionadas} EST` : 'UPH / EST'}
                    </Text>
                    <Text style={[s.uphValor, { color: '#42A5F5' }]}>{uphPorEst ?? '—'}</Text>
                    <Text style={s.uphUnidad}>pzs / hr</Text>
                  </View>
                  <View style={s.uphSep} />
                  <View style={s.uphBloque}>
                    <Text style={s.uphLabel}>META TURNO</Text>
                    <Text style={[s.uphValor, { color: '#66BB6A' }]}>
                      {planInterno ? parseInt(planInterno).toLocaleString() : (metaTurno ?? '—')}
                    </Text>
                    <Text style={s.uphUnidad}>pzs</Text>
                  </View>
                </View>
              )}

              {modelos.length === 0 && (
                <View style={s.sinModeloCard}>
                  <Text style={s.sinModeloIcon}>🔧</Text>
                  <Text style={s.sinModeloText}>Sin modelos configurados</Text>
                  <Text style={s.sinModeloHint}>El administrador debe configurar los modelos para esta línea</Text>
                </View>
              )}
            </>
          )}

          {/* ── Operadores ──────────────────────────────── */}
          <View style={s.opsHeader}>
            <Text style={s.secLabel}>OPERADORES</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {opsAsignados > 0 && (
                <TouchableOpacity onPress={handleLimpiar} style={s.limpiarBtn}>
                  <Text style={s.limpiarBtnText}>Limpiar</Text>
                </TouchableOpacity>
              )}
              <View style={s.opsPill}>
                <Text style={s.opsPillText}>{opsAsignados} / {numSlots}</Text>
              </View>
            </View>
          </View>

          {Array.from({ length: numSlots }).map((_, idx) => {
            const slot      = asignacion[idx];
            const op        = slot?.op;
            const estSlot   = slot?.estaciones || [];
            const ocupadas  = estacionesOcupadas(idx);
            const disponibles = todasEstaciones.filter(e => !ocupadas.includes(e));
            const isExpanded = expandedSlot === idx;

            return (
              <View key={idx} style={[s.opSlot, op ? s.opSlotAsignado : s.opSlotVacioStyle]}>
                {/* Número */}
                <View style={[s.opSlotNumero, op && s.opSlotNumeroAsignado]}>
                  <Text style={[s.opSlotNumeroText, op && s.opSlotNumeroTextAsignado]}>{idx + 1}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  {op ? (
                    /* ── Card asignada ─────────────────────── */
                    <>
                      <TouchableOpacity
                        style={s.opSlotInfo}
                        onPress={() => setExpandedSlot(isExpanded ? null : idx)}
                        activeOpacity={0.8}
                      >
                        <AvatarOp op={op} size={42} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={s.opSlotNombre}>{op.nombre}</Text>
                          <View style={s.opSlotSubRow}>
                            <Text style={s.opSlotNumEmp}>#{op.num_empleado}</Text>
                            {estSlot.length > 0 && (
                              <View style={s.estBadge}>
                                <Text style={s.estBadgeText}>{estSlot.length} est.</Text>
                              </View>
                            )}
                            {uphPorEst && (
                              <View style={s.uphMiniChip}>
                                <Text style={s.uphMiniChipText}>{uphPorEst} pzs/hr</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={s.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                        <TouchableOpacity style={s.opSlotCambiar} onPress={() => setSlotModal(idx)}>
                          <Text style={s.opSlotCambiarText}>Cambiar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.opSlotQuitar} onPress={() => removeSlot(idx)}>
                          <Text style={s.opSlotQuitarText}>✕</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>

                      {/* ── Estaciones (expandible) ────────── */}
                      {isExpanded && (
                        <View style={s.estPanel}>
                          <Text style={s.estPanelLabel}>ESTACIONES</Text>
                          {disponibles.length === 0 && estSlot.length === 0 ? (
                            <Text style={s.estPanelEmpty}>Todas las estaciones están asignadas</Text>
                          ) : (
                            <View style={s.estChipRow}>
                              {/* Estaciones ya asignadas a ESTE slot (siempre visibles) */}
                              {estSlot.map(e => (
                                <TouchableOpacity key={e}
                                  style={[s.estChip, s.estChipActivo]}
                                  onPress={() => toggleEstacion(idx, e)}>
                                  <Text style={s.estChipTextActivo}>{e} ✓</Text>
                                </TouchableOpacity>
                              ))}
                              {/* Estaciones disponibles (no asignadas a nadie) */}
                              {disponibles.filter(e => !estSlot.includes(e)).map(e => (
                                <TouchableOpacity key={e}
                                  style={s.estChip}
                                  onPress={() => toggleEstacion(idx, e)}>
                                  <Text style={s.estChipText}>{e}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  ) : (
                    /* ── Slot vacío ────────────────────────── */
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
              </View>
            );
          })}

          {numSlots < getMaxSlots(lineaSeleccionada?.nombre) && (
            <TouchableOpacity style={s.addSlotBtn} onPress={addSlot}>
              <Text style={s.addSlotText}>＋  Agregar operador</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── Guardar ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.guardarBtn, (guardando || opsAsignados < 2) && s.guardarBtnDisabled]}
          onPress={handleGuardar}
          disabled={guardando || opsAsignados < 2}
        >
          {guardando
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.guardarBtnText}>Guardar</Text>}
        </TouchableOpacity>

        <ModalOperador
          visible={slotModal !== null}
          operadores={operadores.filter(o => {
            // Excluir operadores ya asignados en OTRO slot
            return !Object.entries(asignacion).some(
              ([k, v]) => parseInt(k) !== slotModal && v?.op?.num_empleado === o.num_empleado
            );
          })}
          onSelect={(op) => asignarOperador(slotModal, op)}
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

  header: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#0F1F3A',
  },
  headerLeft:      { gap: 4 },
  headerFecha:     { color: '#546E7A', fontSize: 11, letterSpacing: 0.5 },
  headerLineaRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLineaDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2196F3' },
  headerLinea:     { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', letterSpacing: -0.5 },
  headerTurnoPill: {
    backgroundColor: '#1A237E55', borderRadius: 8, borderWidth: 1, borderColor: '#3949AB',
    paddingHorizontal: 10, paddingVertical: 3, marginTop: 2,
  },
  headerTurnoPillText: { color: '#90CAF9', fontSize: 12, fontWeight: 'bold' },
  headerSinLinea:  { color: '#EF9A9A', fontSize: 13, marginTop: 2 },
  configHint:      { color: '#EF9A9A', fontSize: 11, paddingHorizontal: 16, marginBottom: 6 },

  scroll: { paddingHorizontal: 14, paddingBottom: 90 },

  secLabel: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, marginTop: 14 },

  modeloSearch: {
    backgroundColor: '#0F1923', borderRadius: 10, borderWidth: 1, borderColor: '#1E3A5F',
    color: '#ECEFF1', fontSize: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  modeloItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0A1422', borderRadius: 10, borderWidth: 1, borderColor: '#1E2D3D',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  modeloItemActivo:        { borderColor: '#7B1FA2', backgroundColor: '#1A0533' },
  modeloItemNombre:        { color: '#9E9E9E', fontSize: 14, fontWeight: '600' },
  modeloItemNombreActivo:  { color: '#FFFFFF' },
  modeloItemSub:           { color: '#37474F', fontSize: 11, marginTop: 2 },
  modeloItemUph:           { color: '#37474F', fontSize: 12, fontWeight: 'bold', marginRight: 8 },
  modeloItemCheck:         { color: '#CE93D8', fontSize: 16, fontWeight: 'bold' },

  sinModeloCard: {
    backgroundColor: '#0F1923', borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#1E2D3D', marginBottom: 4,
  },
  sinModeloIcon: { fontSize: 28, marginBottom: 8 },
  sinModeloText: { color: '#546E7A', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sinModeloHint: { color: '#37474F', fontSize: 12, textAlign: 'center' },

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

  opsHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opsPill:     { backgroundColor: '#1565C022', borderRadius: 10, borderWidth: 1, borderColor: '#1565C0', paddingHorizontal: 10, paddingVertical: 3 },
  limpiarBtn:  { backgroundColor: '#7f1d1d33', borderRadius: 8, borderWidth: 1, borderColor: '#ef444466', paddingHorizontal: 10, paddingVertical: 3 },
  limpiarBtnText: { color: '#fca5a5', fontSize: 11, fontWeight: '600' },
  cambiarModeloBtn: { backgroundColor: '#1a3a1a', borderRadius: 10, borderWidth: 1, borderColor: '#4CAF50', padding: 12, alignItems: 'center', marginBottom: 10 },
  cambiarModeloBtnText: { color: '#81C784', fontWeight: '700', fontSize: 14 },
  opsPillText: { color: '#42A5F5', fontSize: 12, fontWeight: 'bold' },

  opSlot: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 14, borderWidth: 1,
    marginBottom: 10, padding: 14,
    overflow: 'hidden',
  },
  opSlotAsignado:   { borderColor: '#2E7D32', backgroundColor: '#071A0A' },
  opSlotVacioStyle: { borderColor: '#1E2D3D', backgroundColor: '#0A1422', borderStyle: 'dashed', alignItems: 'center' },

  opSlotNumero: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: '#1E3A5F',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 4,
  },
  opSlotNumeroAsignado:     { backgroundColor: '#1B5E2044', borderColor: '#2E7D32' },
  opSlotNumeroText:         { color: '#546E7A', fontSize: 13, fontWeight: 'bold' },
  opSlotNumeroTextAsignado: { color: '#66BB6A' },

  opSlotInfo:    { flexDirection: 'row', alignItems: 'center' },
  opSlotNombre:  { color: '#ECEFF1', fontSize: 15, fontWeight: '700' },
  opSlotSubRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  opSlotNumEmp:  { color: '#546E7A', fontSize: 11 },

  estBadge:     { backgroundColor: '#1B5E2033', borderRadius: 6, borderWidth: 1, borderColor: '#2E7D32', paddingHorizontal: 7, paddingVertical: 2 },
  estBadgeText: { color: '#66BB6A', fontSize: 10, fontWeight: 'bold' },

  uphMiniChip:     { backgroundColor: '#0D47A122', borderRadius: 6, borderWidth: 1, borderColor: '#1565C0', paddingHorizontal: 7, paddingVertical: 2 },
  uphMiniChipText: { color: '#42A5F5', fontSize: 10, fontWeight: 'bold' },

  expandIcon: { color: '#546E7A', fontSize: 11, marginHorizontal: 4, alignSelf: 'center' },

  opSlotCambiar:     { backgroundColor: '#1A237E22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#3949AB55', marginLeft: 4 },
  opSlotCambiarText: { color: '#7986CB', fontSize: 11, fontWeight: '600' },
  opSlotQuitar:      { padding: 6, marginLeft: 2 },
  opSlotQuitarText:  { color: '#EF5350', fontSize: 16 },

  opSlotVacioRow:  { flex: 1, flexDirection: 'row', alignItems: 'center' },
  opSlotVacio:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 8 },
  opSlotVacioIcon: { color: '#1E3A5F', fontSize: 20, fontWeight: 'bold' },
  opSlotVacioText: { color: '#37474F', fontSize: 14, fontWeight: '600' },
  opSlotEliminar:  { padding: 6 },

  // Panel de estaciones (expandible)
  estPanel:      { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#0F2D12' },
  estPanelLabel: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  estPanelEmpty: { color: '#37474F', fontSize: 12 },
  estChipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  estChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#0A1422', borderWidth: 1, borderColor: '#1E3A5F',
  },
  estChipActivo:    { backgroundColor: '#1B5E20', borderColor: '#4CAF50' },
  estChipText:      { color: '#546E7A', fontSize: 13, fontWeight: 'bold' },
  estChipTextActivo:{ color: '#A5D6A7', fontWeight: 'bold', fontSize: 13 },

  addSlotBtn: {
    borderWidth: 1.5, borderColor: '#1E3A5F', borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, backgroundColor: '#060E17',
  },
  addSlotText: { color: '#1E88E5', fontSize: 14, fontWeight: '600' },

  guardarBtn:         { margin: 14, backgroundColor: '#1565C0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  guardarBtnDisabled: { backgroundColor: '#0A1422' },
  guardarBtnText:     { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalCerrar: { color: '#9E9E9E', fontSize: 20 },
  searchInput: {
    backgroundColor: '#0F1923', borderRadius: 10, borderWidth: 1, borderColor: '#1E3A5F',
    color: '#ECEFF1', fontSize: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  filtroRow:            { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filtroChip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: '#2D2D2D' },
  filtroChipActivo:     { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  filtroChipText:       { color: '#757575', fontSize: 12, fontWeight: 'bold' },
  filtroChipTextActivo: { color: '#FFFFFF' },
  opCard:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  opNombre:     { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  opNum:        { color: '#757575', fontSize: 11, marginTop: 1 },
  opTurnoBadge: { backgroundColor: '#1A237E44', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#3949AB' },
  opTurnoBadgeText: { color: '#90CAF9', fontSize: 11, fontWeight: 'bold' },
  itemSep:  { height: 1, backgroundColor: '#1E1E1E' },
  emptyText:{ color: '#616161', textAlign: 'center', padding: 20 },
});
