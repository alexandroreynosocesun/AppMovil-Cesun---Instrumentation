import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Text,
  Modal, TextInput, FlatList, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { showAlert } from '../utils/alertUtils';
import { uphService } from '../services/UPHService';

// ── Modal selector de operador ────────────────────────────────
function ModalOperador({ visible, operadores, onSelect, onClose }) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return operadores.filter(
      o => o.nombre.toLowerCase().includes(q) || o.num_empleado.includes(q)
    );
  }, [busqueda, operadores]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Seleccionar operador</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.busquedaInput}
            placeholder="Buscar por nombre o #empleado..."
            placeholderTextColor="#616161"
            value={busqueda}
            onChangeText={setBusqueda}
            autoFocus
          />

          <FlatList
            data={filtrados}
            keyExtractor={item => item.num_empleado}
            style={{ maxHeight: 360 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Sin resultados</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.opItem}
                onPress={() => { onSelect(item); setBusqueda(''); }}
              >
                <Text style={styles.opNombre}>{item.nombre}</Text>
                <Text style={styles.opNum}>#{item.num_empleado}</Text>
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

  // Datos del servidor
  const [lineas, setLineas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [modelos, setModelos] = useState([]);

  // Selección actual
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [modeloSeleccionado, setModeloSeleccionado] = useState(null);
  const [estaciones, setEstaciones] = useState([]);

  // Mapa estacion → operador asignado
  const [asignacion, setAsignacion] = useState({}); // { "601": { num_empleado, nombre }, ... }

  // UI state
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [estacionModal, setEstacionModal] = useState(null); // estación que se está asignando
  const [loadingEstaciones, setLoadingEstaciones] = useState(false);

  const hoy = new Date().toISOString().split('T')[0];

  // Carga inicial
  useEffect(() => {
    async function init() {
      const [rLineas, rTurnos, rOps] = await Promise.all([
        uphService.getLineas(),
        uphService.getTurnos(),
        uphService.getOperadores(),
      ]);
      if (rLineas.success) setLineas(rLineas.data);
      if (rTurnos.success) {
        setTurnos(rTurnos.data);
        // Auto-detectar turno actual
        const rTurnoActual = await uphService.getTurnoActual();
        if (rTurnoActual.success?.turno || rTurnoActual.data?.turno) {
          setTurnoSeleccionado(rTurnoActual.data?.turno || rTurnos.data[0]);
        } else if (rTurnos.data.length > 0) {
          setTurnoSeleccionado(rTurnos.data[0]);
        }
      }
      if (rOps.success) setOperadores(rOps.data);
      setLoading(false);
    }
    init();
  }, []);

  // Cuando cambia la línea: cargar estaciones y modelos
  useEffect(() => {
    if (!lineaSeleccionada) return;
    async function cargarLineaData() {
      setLoadingEstaciones(true);
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
      setLoadingEstaciones(false);
    }
    cargarLineaData();
  }, [lineaSeleccionada]);

  const handleAsignar = (operador) => {
    setAsignacion(prev => ({ ...prev, [estacionModal]: operador }));
    setEstacionModal(null);
  };

  const handleQuitar = (estacion) => {
    setAsignacion(prev => {
      const next = { ...prev };
      delete next[estacion];
      return next;
    });
  };

  const handleGuardar = async () => {
    if (!lineaSeleccionada) return showAlert('Falta línea', 'Selecciona una línea.');
    if (!turnoSeleccionado) return showAlert('Falta turno', 'Selecciona un turno.');

    const items = estaciones
      .filter(est => asignacion[est])
      .map(est => ({ estacion: est, num_empleado: asignacion[est].num_empleado }));

    if (items.length === 0) {
      return showAlert('Sin asignaciones', 'Asigna al menos un operador a una estación.');
    }

    setGuardando(true);
    const result = await uphService.asignarBulk(
      lineaSeleccionada.nombre,
      hoy,
      turnoSeleccionado.id,
      modeloSeleccionado?.id || null,
      items,
    );
    setGuardando(false);

    if (result.success) {
      showAlert('✅ Asignación guardada', `${result.data.creadas} operadores asignados en ${lineaSeleccionada.nombre}.`);
    } else {
      showAlert('Error', result.error);
    }
  };

  const asignados = estaciones.filter(e => asignacion[e]).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#1A237E', '#0F0F0F']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* Fecha */}
        <Text style={styles.fechaLabel}>📅 {hoy}</Text>

        {/* Selector de línea */}
        <Text style={styles.sectionLabel}>LÍNEA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {lineas.map(l => (
            <TouchableOpacity
              key={l.id}
              style={[styles.chip, lineaSeleccionada?.id === l.id && styles.chipActivo]}
              onPress={() => setLineaSeleccionada(l)}
            >
              <Text style={[styles.chipText, lineaSeleccionada?.id === l.id && styles.chipTextActivo]}>
                {l.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Selector de turno */}
        <Text style={styles.sectionLabel}>TURNO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {turnos.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, turnoSeleccionado?.id === t.id && styles.chipActivo]}
              onPress={() => setTurnoSeleccionado(t)}
            >
              <Text style={[styles.chipText, turnoSeleccionado?.id === t.id && styles.chipTextActivo]}>
                {t.nombre}  {t.hora_inicio}–{t.hora_fin}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Selector de modelo */}
        {modelos.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>MODELO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {modelos.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.chip, modeloSeleccionado?.id === m.id && styles.chipModelo]}
                  onPress={() => setModeloSeleccionado(m)}
                >
                  <Text style={[styles.chipText, modeloSeleccionado?.id === m.id && styles.chipTextActivo]}>
                    {m.nombre}  ({m.uph_total} UPH)
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Lista de estaciones */}
        <View style={styles.estHeader}>
          <Text style={styles.sectionLabel}>ESTACIONES  ({asignados}/{estaciones.length})</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
        >
          {!lineaSeleccionada ? (
            <Text style={styles.hint}>Selecciona una línea para ver las estaciones</Text>
          ) : loadingEstaciones ? (
            <ActivityIndicator size="small" color="#2196F3" style={{ marginTop: 20 }} />
          ) : estaciones.length === 0 ? (
            <Text style={styles.hint}>Sin estaciones configuradas para {lineaSeleccionada.nombre}</Text>
          ) : (
            estaciones.map(est => {
              const op = asignacion[est];
              return (
                <View key={est} style={styles.estRow}>
                  <View style={styles.estBadge}>
                    <Text style={styles.estNumero}>{est}</Text>
                  </View>

                  {op ? (
                    <TouchableOpacity
                      style={styles.opAsignado}
                      onPress={() => setEstacionModal(est)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.opAsignadoNombre}>{op.nombre}</Text>
                        <Text style={styles.opAsignadoNum}>#{op.num_empleado}</Text>
                      </View>
                      <TouchableOpacity style={styles.quitarBtn} onPress={() => handleQuitar(est)}>
                        <Text style={styles.quitarText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.asignarBtn}
                      onPress={() => setEstacionModal(est)}
                    >
                      <Text style={styles.asignarBtnText}>+ Asignar operador</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Botón guardar */}
        {lineaSeleccionada && estaciones.length > 0 && (
          <TouchableOpacity
            style={[styles.guardarBtn, guardando && styles.guardarBtnDisabled]}
            onPress={handleGuardar}
            disabled={guardando}
          >
            {guardando
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.guardarBtnText}>
                  Guardar asignación · {asignados} operadores
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* Modal selector */}
        <ModalOperador
          visible={!!estacionModal}
          operadores={operadores}
          onSelect={handleAsignar}
          onClose={() => setEstacionModal(null)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  fechaLabel: { color: '#9E9E9E', fontSize: 12, paddingHorizontal: 16, paddingTop: 8, marginBottom: 4 },
  sectionLabel: { color: '#2196F3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 6 },
  chipRow: { paddingHorizontal: 12, marginBottom: 12, maxHeight: 44 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', marginRight: 8,
  },
  chipActivo: { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  chipModelo: { backgroundColor: '#4A148C', borderColor: '#7B1FA2' },
  chipText: { color: '#9E9E9E', fontSize: 13 },
  chipTextActivo: { color: '#FFFFFF', fontWeight: 'bold' },
  estHeader: { paddingHorizontal: 16, marginBottom: 6 },
  scroll: { paddingHorizontal: 14, paddingBottom: 100 },
  hint: { color: '#616161', textAlign: 'center', marginTop: 24, fontSize: 14 },

  // Fila de estación
  estRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  estBadge: {
    width: 52, height: 52, borderRadius: 10, backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  estNumero: { color: '#BDBDBD', fontSize: 14, fontWeight: 'bold' },

  opAsignado: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1B5E2033', borderWidth: 1, borderColor: '#4CAF50',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  opAsignadoNombre: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  opAsignadoNum: { color: '#9E9E9E', fontSize: 11, marginTop: 2 },
  quitarBtn: { padding: 4 },
  quitarText: { color: '#F44336', fontSize: 16 },

  asignarBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#333',
    borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center',
  },
  asignarBtnText: { color: '#616161', fontSize: 13 },

  // Guardar
  guardarBtn: {
    margin: 14, backgroundColor: '#1565C0', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  guardarBtnDisabled: { backgroundColor: '#1A1A1A' },
  guardarBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: '#000000CC',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalCerrar: { color: '#9E9E9E', fontSize: 20 },
  busquedaInput: {
    backgroundColor: '#0F0F0F', color: '#FFFFFF', borderWidth: 1, borderColor: '#333',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: 12,
  },
  opItem: {
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#2D2D2D',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  opNombre: { color: '#FFFFFF', fontSize: 15 },
  opNum: { color: '#757575', fontSize: 12 },
  emptyText: { color: '#616161', textAlign: 'center', padding: 20 },
});
