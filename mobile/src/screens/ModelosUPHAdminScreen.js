import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Text, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { showAlert } from '../utils/alertUtils';
import { uphService } from '../services/UPHService';
import { useAuth } from '../contexts/AuthContext';

const LINEAS = ['HI-1', 'HI-2', 'HI-3', 'HI-4', 'HI-5', 'HI-6', 'HI-7'];
const UPH_KEYS = ['uph_hi1', 'uph_hi2', 'uph_hi3', 'uph_hi4', 'uph_hi5', 'uph_hi6', 'uph_hi7'];

function ModalFormulario({ visible, modelo, onClose, onGuardar }) {
  const [nombre, setNombre] = useState('');
  const [modeloInterno, setModeloInterno] = useState('');
  const [tipo, setTipo] = useState('');
  const [uphValues, setUphValues] = useState({ uph_hi1: '', uph_hi2: '', uph_hi3: '', uph_hi4: '', uph_hi5: '', uph_hi6: '', uph_hi7: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (modelo) {
      setNombre(modelo.nombre || '');
      setModeloInterno(modelo.modelo_interno || '');
      setTipo(modelo.tipo || '');
      const vals = {};
      UPH_KEYS.forEach(k => { vals[k] = modelo[k] != null ? String(modelo[k]) : ''; });
      setUphValues(vals);
    } else {
      setNombre('');
      setModeloInterno('');
      setTipo('');
      setUphValues({ uph_hi1: '', uph_hi2: '', uph_hi3: '', uph_hi4: '', uph_hi5: '', uph_hi6: '', uph_hi7: '' });
    }
  }, [modelo, visible]);

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      showAlert('Campo requerido', 'El nombre del modelo es obligatorio.');
      return;
    }
    const uphNums = {};
    for (const k of UPH_KEYS) {
      const v = uphValues[k];
      uphNums[k] = v.trim() ? parseFloat(v) : null;
    }
    setGuardando(true);
    await onGuardar({
      id: modelo?.id,
      nombre: nombre.trim(),
      modelo_interno: modeloInterno.trim() || null,
      tipo: tipo.trim() || null,
      ...uphNums,
    });
    setGuardando(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{modelo ? 'Editar modelo' : 'Nuevo modelo'}</Text>

            <Text style={s.label}>Nombre del modelo *</Text>
            <TextInput style={s.input} placeholder="Ej: 55U75QUF" placeholderTextColor="#555"
              value={nombre} onChangeText={setNombre} autoCapitalize="characters" />

            <Text style={s.label}>Modelo interno</Text>
            <TextInput style={s.input} placeholder="Ej: 50A53FUR" placeholderTextColor="#555"
              value={modeloInterno} onChangeText={setModeloInterno} autoCapitalize="characters" />

            <Text style={s.label}>Tipo</Text>
            <TextInput style={s.input} placeholder="Ej: 3 IN 1 / REFLOV" placeholderTextColor="#555"
              value={tipo} onChangeText={setTipo} autoCapitalize="characters" />

            <Text style={[s.label, { marginTop: 4, color: '#4FC3F7', fontWeight: 'bold' }]}>UPH por línea</Text>
            <View style={s.uphGrid}>
              {LINEAS.map((linea, i) => (
                <View key={linea} style={s.uphItem}>
                  <Text style={s.uphLinea}>{linea}</Text>
                  <TextInput
                    style={s.uphInput}
                    placeholder="—"
                    placeholderTextColor="#444"
                    value={uphValues[UPH_KEYS[i]]}
                    onChangeText={v => setUphValues(prev => ({ ...prev, [UPH_KEYS[i]]: v }))}
                    keyboardType="numeric"
                  />
                </View>
              ))}
            </View>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnCancelar} onPress={onClose}>
                <Text style={s.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGuardar} onPress={handleGuardar} disabled={guardando}>
                {guardando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnGuardarText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ModelosUPHAdminScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'ingeniero'].includes(user?.tipo_usuario);

  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modeloEditar, setModeloEditar] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const r = await uphService.getModelos();
    if (r.success) setModelos(r.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async (data) => {
    const payload = {
      nombre: data.nombre,
      modelo_interno: data.modelo_interno,
      tipo: data.tipo,
      uph_hi1: data.uph_hi1,
      uph_hi2: data.uph_hi2,
      uph_hi3: data.uph_hi3,
      uph_hi4: data.uph_hi4,
      uph_hi5: data.uph_hi5,
      uph_hi6: data.uph_hi6,
      uph_hi7: data.uph_hi7,
    };
    let result;
    if (data.id) {
      result = await uphService.actualizarModelo(data.id, payload);
    } else {
      result = await uphService.crearModelo(payload);
    }
    if (result.success) {
      setModalVisible(false);
      setModeloEditar(null);
      cargar();
    } else {
      showAlert('Error', result.error);
    }
  };

  const handleEliminar = (modelo) => {
    showAlert('Eliminar modelo', `Eliminar "${modelo.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const r = await uphService.eliminarModelo(modelo.id);
          if (r.success) cargar();
          else showAlert('Error', r.error);
        },
      },
    ]);
  };

  const modelosFiltrados = busqueda.trim()
    ? modelos.filter(m =>
        m.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        (m.modelo_interno || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (m.tipo || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : modelos;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#2196F3" /></View>;
  }

  return (
    <View style={[s.container, isWeb && webStyles.container]}>
      <LinearGradient colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>

        {isAdmin && (
          <TouchableOpacity style={s.operadoresBtn} onPress={() => navigation.navigate('OperadoresAdmin')}>
            <Text style={s.operadoresBtnText}>Gestionar operadores</Text>
          </TouchableOpacity>
        )}

        <View style={s.searchContainer}>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar modelo, interno, tipo..."
            placeholderTextColor="#616161"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          <Text style={s.conteo}>{modelosFiltrados.length} modelos</Text>
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />}
        >
          {modelosFiltrados.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>{busqueda ? 'Sin resultados' : 'Sin modelos registrados'}</Text>
              {!busqueda && <Text style={s.emptyHint}>Toca + para agregar el primero</Text>}
            </View>
          ) : (
            modelosFiltrados.map(m => (
              <View key={m.id} style={s.modeloCard}>
                {/* Header */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modeloNombre}>{m.nombre}</Text>
                    <View style={s.metaRow}>
                      {m.modelo_interno ? (
                        <View style={s.chip}>
                          <Text style={s.chipLabel}>Interno</Text>
                          <Text style={s.chipVal}>{m.modelo_interno}</Text>
                        </View>
                      ) : null}
                      {m.tipo ? (
                        <View style={[s.chip, { borderColor: '#4FC3F730' }]}>
                          <Text style={s.chipLabel}>Tipo</Text>
                          <Text style={[s.chipVal, { color: '#4FC3F7' }]}>{m.tipo}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={s.acciones}>
                    <TouchableOpacity style={s.btnEditar} onPress={() => { setModeloEditar(m); setModalVisible(true); }}>
                      <Text style={s.btnEditarText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnEliminar} onPress={() => handleEliminar(m)}>
                      <Text style={s.btnEliminarText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* UPH por línea */}
                <View style={s.uphRow}>
                  {LINEAS.map((linea, i) => {
                    const val = m[UPH_KEYS[i]];
                    return (
                      <View key={linea} style={[s.uphBloque, !val && s.uphBloqueVacio]}>
                        <Text style={s.uphLinea}>{linea}</Text>
                        <Text style={[s.uphVal, !val && s.uphValVacio]}>{val ?? '—'}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity style={s.fab} onPress={() => { setModeloEditar(null); setModalVisible(true); }}>
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>

        <ModalFormulario
          visible={modalVisible}
          modelo={modeloEditar}
          onClose={() => { setModalVisible(false); setModeloEditar(null); }}
          onGuardar={handleGuardar}
        />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  operadoresBtn: {
    marginHorizontal: 14, marginTop: 10, marginBottom: 4,
    backgroundColor: '#1A2744', borderWidth: 1, borderColor: '#2196F3',
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  operadoresBtnText: { color: '#2196F3', fontWeight: 'bold', fontSize: 14 },
  searchContainer: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  searchInput: {
    backgroundColor: '#1A1A1A', color: '#FFF', borderWidth: 1, borderColor: '#333',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  conteo: { color: '#616161', fontSize: 12, marginTop: 4, marginLeft: 4 },
  scroll: { padding: 14, paddingBottom: 90 },

  modeloCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, marginBottom: 10,
    padding: 14, borderWidth: 1, borderColor: '#2D2D2D',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  modeloNombre: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#0F0F0F', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#333',
  },
  chipLabel: { color: '#555', fontSize: 10 },
  chipVal: { color: '#BDBDBD', fontSize: 12, fontWeight: 'bold' },

  /* UPH grid */
  uphRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  uphBloque: {
    backgroundColor: '#0D1A26', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    alignItems: 'center', minWidth: 46, borderWidth: 1, borderColor: '#1565C0',
  },
  uphBloqueVacio: { borderColor: '#2A2A2A', backgroundColor: '#111' },
  uphLinea: { color: '#4FC3F7', fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  uphVal: { color: '#2196F3', fontSize: 13, fontWeight: 'bold' },
  uphValVacio: { color: '#333', fontSize: 12 },

  acciones: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  btnEditar: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1A237E33', justifyContent: 'center', alignItems: 'center' },
  btnEditarText: { fontSize: 16 },
  btnEliminar: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#B71C1C33', justifyContent: 'center', alignItems: 'center' },
  btnEliminarText: { fontSize: 16 },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#9E9E9E', fontSize: 16, marginBottom: 8 },
  emptyHint: { color: '#616161', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4,
  },
  fabText: { color: '#FFF', fontSize: 30, lineHeight: 34 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: '#000000BB' },
  modalCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 420, borderWidth: 1, borderColor: '#2D2D2D', alignSelf: 'center',
  },
  modalTitulo: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#9E9E9E', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#0F0F0F', color: '#FFF', borderWidth: 1, borderColor: '#333',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 14,
  },
  uphGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  uphItem: { width: '27%' },
  uphLinea: { color: '#4FC3F7', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  uphInput: {
    backgroundColor: '#0F0F0F', color: '#FFF', borderWidth: 1, borderColor: '#1565C0',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, textAlign: 'center',
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnCancelar: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2D2D2D', alignItems: 'center' },
  btnCancelarText: { color: '#9E9E9E', fontWeight: 'bold' },
  btnGuardar: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#1565C0', alignItems: 'center' },
  btnGuardarText: { color: '#FFF', fontWeight: 'bold' },
});
