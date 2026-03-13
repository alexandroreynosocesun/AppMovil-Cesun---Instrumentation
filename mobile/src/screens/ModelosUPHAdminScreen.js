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

function ModalFormulario({ visible, modelo, lineas, onClose, onGuardar }) {
  const [nombre, setNombre] = useState('');
  const [uph, setUph] = useState('');
  const [lineaId, setLineaId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (modelo) {
      setNombre(modelo.nombre);
      setUph(String(modelo.uph_total));
      setLineaId(modelo.linea_id);
    } else {
      setNombre('');
      setUph('');
      setLineaId(lineas[0]?.id || null);
    }
  }, [modelo, lineas, visible]);

  const handleGuardar = async () => {
    if (!nombre.trim() || !uph.trim() || !lineaId) {
      showAlert('Campos requeridos', 'Completa todos los campos.');
      return;
    }
    const uphNum = parseFloat(uph);
    if (isNaN(uphNum) || uphNum <= 0) {
      showAlert('UPH inválido', 'Ingresa un valor numérico mayor a 0.');
      return;
    }
    setGuardando(true);
    await onGuardar(modelo?.id, nombre.trim(), uphNum, lineaId);
    setGuardando(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitulo}>{modelo ? 'Editar modelo' : 'Nuevo modelo'}</Text>

          <Text style={styles.label}>Nombre del modelo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 55U75QUF"
            placeholderTextColor="#616161"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>UPH total (línea completa)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 280"
            placeholderTextColor="#616161"
            value={uph}
            onChangeText={setUph}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Línea</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {lineas.map(l => (
              <TouchableOpacity
                key={l.id}
                style={[styles.lineaChip, lineaId === l.id && styles.lineaChipActivo]}
                onPress={() => setLineaId(l.id)}
              >
                <Text style={[styles.lineaChipText, lineaId === l.id && styles.lineaChipTextActivo]}>
                  {l.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
  const [modelos, setModelos] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modeloEditar, setModeloEditar] = useState(null);
  const [lineaFiltro, setLineaFiltro] = useState(null);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [rModelos, rLineas] = await Promise.all([
      uphService.getModelos(),
      uphService.getLineas(),
    ]);
    if (rModelos.success) setModelos(rModelos.data);
    if (rLineas.success) setLineas(rLineas.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async (id, nombre, uph_total, linea_id) => {
    let result;
    if (id) {
      result = await uphService.actualizarModelo(id, nombre, uph_total, linea_id);
    } else {
      result = await uphService.crearModelo(nombre, uph_total, linea_id);
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
      `¿Eliminar "${modelo.nombre}"? Esta acción no se puede deshacer.`,
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

  const modelosFiltrados = lineaFiltro
    ? modelos.filter(m => m.linea_id === lineaFiltro)
    : modelos;

  // Agrupar por línea
  const porLinea = lineas.map(l => ({
    linea: l,
    items: modelosFiltrados.filter(m => m.linea_id === l.id),
  })).filter(g => g.items.length > 0 || !lineaFiltro);

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

        {/* Header: Operadores */}
        <TouchableOpacity
          style={styles.operadoresBtn}
          onPress={() => navigation.navigate('OperadoresAdmin')}
        >
          <Text style={styles.operadoresBtnText}>👥 Gestionar operadores</Text>
        </TouchableOpacity>

        {/* Filtro por línea */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtroRow}>
          <TouchableOpacity
            style={[styles.filtroChip, !lineaFiltro && styles.filtroActivo]}
            onPress={() => setLineaFiltro(null)}
          >
            <Text style={[styles.filtroText, !lineaFiltro && styles.filtroTextActivo]}>Todas</Text>
          </TouchableOpacity>
          {lineas.map(l => (
            <TouchableOpacity
              key={l.id}
              style={[styles.filtroChip, lineaFiltro === l.id && styles.filtroActivo]}
              onPress={() => setLineaFiltro(lineaFiltro === l.id ? null : l.id)}
            >
              <Text style={[styles.filtroText, lineaFiltro === l.id && styles.filtroTextActivo]}>
                {l.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />
          }
        >
          {modelos.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sin modelos registrados</Text>
              <Text style={styles.emptyHint}>Toca + para agregar el primero</Text>
            </View>
          ) : (
            porLinea.map(({ linea, items }) => (
              <View key={linea.id}>
                <Text style={styles.lineaTitulo}>{linea.nombre}</Text>
                {items.length === 0 ? (
                  <Text style={styles.sinModelos}>Sin modelos en esta línea</Text>
                ) : (
                  items.map(m => {
                    return (
                      <View key={m.id} style={styles.modeloCard}>
                        <View style={styles.modeloInfo}>
                          <Text style={styles.modeloNombre}>{m.nombre}</Text>
                          <View style={styles.uphRow}>
                            <View style={styles.uphBloque}>
                              <Text style={styles.uphEtiqueta}>UPH línea</Text>
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
                    );
                  })
                )}
              </View>
            ))
          )}
        </ScrollView>

        {/* FAB agregar */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => { setModeloEditar(null); setModalVisible(true); }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <ModalFormulario
          visible={modalVisible}
          modelo={modeloEditar}
          lineas={lineas}
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
    marginHorizontal: 14, marginTop: 10, marginBottom: 2,
    backgroundColor: '#1A2744', borderWidth: 1, borderColor: '#2196F3',
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  operadoresBtnText: { color: '#2196F3', fontWeight: 'bold', fontSize: 14 },
  filtroRow: { paddingHorizontal: 12, paddingVertical: 10, maxHeight: 52 },
  filtroChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', marginRight: 8,
  },
  filtroActivo: { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  filtroText: { color: '#9E9E9E', fontSize: 13 },
  filtroTextActivo: { color: '#FFFFFF', fontWeight: 'bold' },
  scroll: { padding: 14, paddingBottom: 80 },
  lineaTitulo: {
    color: '#2196F3', fontSize: 13, fontWeight: 'bold',
    letterSpacing: 1, marginTop: 16, marginBottom: 8, marginLeft: 2,
  },
  sinModelos: { color: '#424242', fontSize: 13, marginBottom: 8, marginLeft: 4 },
  modeloCard: {
    flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 10,
    marginBottom: 8, padding: 14, borderWidth: 1, borderColor: '#2D2D2D',
    alignItems: 'center',
  },
  modeloInfo: { flex: 1 },
  modeloNombre: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  uphRow: { flexDirection: 'row' },
  uphBloque: { marginRight: 20 },
  uphEtiqueta: { color: '#757575', fontSize: 11 },
  uphValor: { color: '#BDBDBD', fontSize: 15, fontWeight: 'bold' },
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

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4,
  },
  fabText: { color: '#FFFFFF', fontSize: 30, lineHeight: 34 },

  // Modal
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
  lineaChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: '#333', marginRight: 8,
  },
  lineaChipActivo: { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  lineaChipText: { color: '#9E9E9E', fontSize: 13 },
  lineaChipTextActivo: { color: '#FFFFFF', fontWeight: 'bold' },
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
