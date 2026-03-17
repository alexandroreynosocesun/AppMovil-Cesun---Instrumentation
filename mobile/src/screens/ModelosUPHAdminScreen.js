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

function ModalFormulario({ visible, modelo, onClose, onGuardar }) {
  const [nombre, setNombre] = useState('');
  const [numPlaca, setNumPlaca] = useState('');
  const [modeloInterno, setModeloInterno] = useState('');
  const [uph, setUph] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (modelo) {
      setNombre(modelo.nombre || '');
      setNumPlaca(modelo.num_placa || '');
      setModeloInterno(modelo.modelo_interno || '');
      setUph(String(modelo.uph_total));
    } else {
      setNombre('');
      setNumPlaca('');
      setModeloInterno('');
      setUph('');
    }
  }, [modelo, visible]);

  const handleGuardar = async () => {
    if (!nombre.trim() || !uph.trim()) {
      showAlert('Campos requeridos', 'Completa nombre y UPH.');
      return;
    }
    const uphNum = parseFloat(uph);
    if (isNaN(uphNum) || uphNum <= 0) {
      showAlert('UPH invalido', 'Ingresa un valor numerico mayor a 0.');
      return;
    }
    setGuardando(true);
    await onGuardar(modelo?.id, nombre.trim(), numPlaca.trim() || null, modeloInterno.trim() || null, uphNum);
    setGuardando(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitulo}>{modelo ? 'Editar modelo' : 'Nuevo modelo'}</Text>

          <Text style={styles.label}>Nombre del modelo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 55U75QUF"
            placeholderTextColor="#616161"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Numero de placa</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: RSAG7.820.9451"
            placeholderTextColor="#616161"
            value={numPlaca}
            onChangeText={setNumPlaca}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Modelo interno</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 55A7500F"
            placeholderTextColor="#616161"
            value={modeloInterno}
            onChangeText={setModeloInterno}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>UPH por linea *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 220"
            placeholderTextColor="#616161"
            value={uph}
            onChangeText={setUph}
            keyboardType="numeric"
          />

          <View style={styles.modalBtns}>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ModelosUPHAdminScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const isAdmin = user?.tipo_usuario === 'admin' || user?.tipo_usuario === 'superadmin';

  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modeloEditar, setModeloEditar] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const rModelos = await uphService.getModelos();
    if (rModelos.success) setModelos(rModelos.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async (id, nombre, num_placa, modelo_interno, uph_total) => {
    let result;
    if (id) {
      result = await uphService.actualizarModelo(id, nombre, num_placa, modelo_interno, uph_total);
    } else {
      result = await uphService.crearModelo(nombre, num_placa, modelo_interno, uph_total);
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
    showAlert(
      'Eliminar modelo',
      `Eliminar "${modelo.nombre}"? Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const result = await uphService.eliminarModelo(modelo.id);
            if (result.success) cargar();
            else showAlert('Error', result.error);
          },
        },
      ]
    );
  };

  const modelosFiltrados = busqueda.trim()
    ? modelos.filter(m =>
        m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (m.num_placa || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (m.modelo_interno || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : modelos;

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

        {isAdmin && (
          <TouchableOpacity
            style={styles.operadoresBtn}
            onPress={() => navigation.navigate('OperadoresAdmin')}
          >
            <Text style={styles.operadoresBtnText}>Gestionar operadores</Text>
          </TouchableOpacity>
        )}

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar modelo, placa, interno..."
            placeholderTextColor="#616161"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          <Text style={styles.conteo}>{modelosFiltrados.length} modelos</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />
          }
        >
          {modelosFiltrados.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {busqueda ? 'Sin resultados' : 'Sin modelos registrados'}
              </Text>
              {!busqueda && <Text style={styles.emptyHint}>Toca + para agregar el primero</Text>}
            </View>
          ) : (
            modelosFiltrados.map(m => (
              <View key={m.id} style={styles.modeloCard}>
                <View style={styles.modeloInfo}>
                  <Text style={styles.modeloNombre}>{m.nombre}</Text>
                  <View style={styles.metaRow}>
                    {m.num_placa ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipLabel}>Placa</Text>
                        <Text style={styles.metaChipValor}>{m.num_placa}</Text>
                      </View>
                    ) : null}
                    {m.modelo_interno ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipLabel}>Interno</Text>
                        <Text style={styles.metaChipValor}>{m.modelo_interno}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.uphRow}>
                    <View style={styles.uphBloque}>
                      <Text style={styles.uphEtiqueta}>UPH/linea</Text>
                      <Text style={styles.uphValor}>{m.uph_total}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.modeloAcciones}>
                  <TouchableOpacity
                    style={styles.btnEditar}
                    onPress={() => { setModeloEditar(m); setModalVisible(true); }}
                  >
                    <Text style={styles.btnEditarText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnEliminar}
                    onPress={() => handleEliminar(m)}
                  >
                    <Text style={styles.btnEliminarText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => { setModeloEditar(null); setModalVisible(true); }}
        >
          <Text style={styles.fabText}>+</Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: '#1A1A1A', color: '#FFFFFF', borderWidth: 1, borderColor: '#333',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  conteo: { color: '#616161', fontSize: 12, marginTop: 4, marginLeft: 4 },
  scroll: { padding: 14, paddingBottom: 80 },
  modeloCard: {
    flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 10,
    marginBottom: 8, padding: 14, borderWidth: 1, borderColor: '#2D2D2D',
    alignItems: 'center',
  },
  modeloInfo: { flex: 1 },
  modeloNombre: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  metaChip: {
    backgroundColor: '#0F0F0F', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#333',
  },
  metaChipLabel: { color: '#616161', fontSize: 10 },
  metaChipValor: { color: '#BDBDBD', fontSize: 12, fontWeight: 'bold' },
  uphRow: { flexDirection: 'row' },
  uphBloque: { marginRight: 20 },
  uphEtiqueta: { color: '#757575', fontSize: 11 },
  uphValor: { color: '#2196F3', fontSize: 15, fontWeight: 'bold' },
  modeloAcciones: { flexDirection: 'row', gap: 8 },
  btnEditar: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#1A237E33', justifyContent: 'center', alignItems: 'center',
  },
  btnEditarText: { fontSize: 16 },
  btnEliminar: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#B71C1C33', justifyContent: 'center', alignItems: 'center',
  },
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
  fabText: { color: '#FFFFFF', fontSize: 30, lineHeight: 34 },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000BB',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: '#2D2D2D',
  },
  modalTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#9E9E9E', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#0F0F0F', color: '#FFFFFF', borderWidth: 1,
    borderColor: '#333', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
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
