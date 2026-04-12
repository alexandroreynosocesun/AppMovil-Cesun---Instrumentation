import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, Text,
  Modal, TextInput, KeyboardAvoidingView, Platform, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { showAlert } from '../utils/alertUtils';
import { uphService } from '../services/UPHService';

const n2 = (s) => { const p = (s||'').trim().split(' '); return p.length >= 3 ? p[0]+' '+p[2] : p.slice(0,2).join(' '); };
const TURNOS = ['A', 'B', 'C'];
const TURNO_COLORS = { A: '#1565C0', B: '#6A1B9A', C: '#1B5E20' };
const TURNO_BORDER = { A: '#42A5F5', B: '#AB47BC', C: '#66BB6A' };

function SelectorTurno({ value, onChange }) {
  return (
    <View style={st.turnoRow}>
      {TURNOS.map(t => (
        <TouchableOpacity
          key={t}
          style={[st.turnoPill, { borderColor: TURNO_BORDER[t] }, value === t && { backgroundColor: TURNO_COLORS[t] }]}
          onPress={() => onChange(value === t ? null : t)}
        >
          <Text style={[st.turnoPillText, value === t && { color: '#fff' }]}>Turno {t}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ModalNuevoOperador({ visible, onClose, onGuardar }) {
  const [num, setNum] = useState('');
  const [nombre, setNombre] = useState('');
  const [turno, setTurno] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!num.trim() || !nombre.trim()) {
      return showAlert('Campos requeridos', 'Completa número de empleado y nombre.');
    }
    setGuardando(true);
    await onGuardar(num.trim(), nombre.trim(), turno);
    setGuardando(false);
    setNum(''); setNombre(''); setTurno(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitulo}>Nuevo operador</Text>

          <Text style={styles.label}>Número de empleado</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 12345"
            placeholderTextColor="#616161"
            value={num}
            onChangeText={setNum}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Juan López"
            placeholderTextColor="#616161"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Turno</Text>
          <SelectorTurno value={turno} onChange={setTurno} />

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnCancelar} onPress={onClose}>
              <Text style={styles.btnCancelarText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardar} disabled={guardando}>
              {guardando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.btnGuardarText}>Agregar</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalEditarTurno({ visible, operador, onClose, onGuardar }) {
  const [turno, setTurno] = useState(operador?.turno || null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setTurno(operador?.turno || null); }, [operador]);

  const handleGuardar = async () => {
    setGuardando(true);
    await onGuardar(operador.num_empleado, turno);
    setGuardando(false);
  };

  if (!operador) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { maxWidth: 320 }]}>
          <Text style={styles.modalTitulo}>Asignar turno</Text>
          <Text style={[styles.label, { marginBottom: 4 }]}>{operador.nombre}</Text>
          <Text style={[styles.label, { marginBottom: 16 }]}>#{operador.num_empleado}</Text>

          <SelectorTurno value={turno} onChange={setTurno} />

          <View style={[styles.modalBtns, { marginTop: 20 }]}>
            <TouchableOpacity style={styles.btnCancelar} onPress={onClose}>
              <Text style={styles.btnCancelarText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardar} disabled={guardando}>
              {guardando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.btnGuardarText}>Guardar</Text>
              }
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function OperadoresAdminScreen() {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [opEditando, setOpEditando] = useState(null);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await uphService.getOperadores();
    if (result.success) setOperadores(result.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleAgregar = async (num_empleado, nombre, turno) => {
    const result = await uphService.crearOperador(num_empleado, nombre);
    if (result.success) {
      if (turno) await uphService.actualizarTurnoOperador(num_empleado, turno);
      setModalNuevo(false);
      cargar();
    } else {
      showAlert('Error', result.error);
    }
  };

  const handleGuardarTurno = async (num_empleado, turno) => {
    const result = await uphService.actualizarTurnoOperador(num_empleado, turno || '');
    if (result.success) {
      setOpEditando(null);
      cargar();
    } else {
      showAlert('Error', result.error);
    }
  };

  const filtrados = operadores.filter(
    o => o.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
         o.num_empleado.includes(busqueda)
  );

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
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        <View style={[
          styles.searchContainer,
          isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding }
        ]}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍  Buscar por nombre o #empleado..."
            placeholderTextColor="#616161"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          <Text style={styles.conteo}>{filtrados.length} operadores</Text>
        </View>

        <FlatList
          data={filtrados}
          keyExtractor={item => item.num_empleado}
          contentContainerStyle={[
            styles.lista,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>
                {busqueda ? 'Sin resultados' : 'Sin operadores registrados'}
              </Text>
              {!busqueda && <Text style={styles.emptyHint}>Toca + para agregar el primero</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, !item.activo && styles.cardInactivo]}>
              <View style={[styles.avatar, !item.activo && styles.avatarInactivo]}>
                <Text style={styles.avatarText}>{item.nombre.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre}>{n2(item.nombre)}</Text>
                <Text style={styles.numEmpleado}>#{item.num_empleado}</Text>
              </View>
              {/* Badge turno — tap para editar */}
              <TouchableOpacity
                style={[
                  styles.turnoBadge,
                  item.turno
                    ? { backgroundColor: TURNO_COLORS[item.turno] + '33', borderColor: TURNO_BORDER[item.turno] }
                    : { backgroundColor: '#2D2D2D', borderColor: '#424242' }
                ]}
                onPress={() => setOpEditando(item)}
              >
                <Text style={[styles.turnoText, item.turno && { color: TURNO_BORDER[item.turno] }]}>
                  {item.turno ? `Turno ${item.turno}` : 'Sin turno'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <TouchableOpacity style={styles.fab} onPress={() => setModalNuevo(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <ModalNuevoOperador
          visible={modalNuevo}
          onClose={() => setModalNuevo(false)}
          onGuardar={handleAgregar}
        />
        <ModalEditarTurno
          visible={!!opEditando}
          operador={opEditando}
          onClose={() => setOpEditando(null)}
          onGuardar={handleGuardarTurno}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  searchContainer: { padding: 14, paddingBottom: 0 },
  searchInput: {
    backgroundColor: '#1A1A1A', color: '#FFFFFF', borderWidth: 1, borderColor: '#333',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  conteo: { color: '#616161', fontSize: 12, marginTop: 6, marginLeft: 4 },
  lista: { padding: 14, paddingBottom: 80 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2D2D2D',
  },
  cardInactivo: { opacity: 0.5 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarInactivo: { backgroundColor: '#424242' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  info: { flex: 1 },
  nombre: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  numEmpleado: { color: '#757575', fontSize: 12, marginTop: 2 },
  turnoBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    borderWidth: 1, marginLeft: 8,
  },
  turnoText: { color: '#757575', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#9E9E9E', fontSize: 16 },
  emptyHint: { color: '#616161', fontSize: 13, marginTop: 8 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center',
    elevation: 6,
  },
  fabText: { color: '#FFFFFF', fontSize: 30, lineHeight: 34 },
  overlay: {
    flex: 1, backgroundColor: '#000000BB',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#2D2D2D',
  },
  modalTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#9E9E9E', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#0F0F0F', color: '#FFFFFF', borderWidth: 1, borderColor: '#333',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnCancelar: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#2D2D2D', alignItems: 'center',
  },
  btnCancelarText: { color: '#9E9E9E', fontWeight: 'bold' },
  btnGuardar: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#1565C0', alignItems: 'center',
  },
  btnGuardarText: { color: '#FFFFFF', fontWeight: 'bold' },
});

const st = StyleSheet.create({
  turnoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  turnoPill: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
    backgroundColor: 'transparent',
  },
  turnoPillText: { fontSize: 13, fontWeight: '700', color: '#757575' },
});
