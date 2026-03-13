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

function ModalNuevoOperador({ visible, onClose, onGuardar }) {
  const [num, setNum] = useState('');
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!num.trim() || !nombre.trim()) {
      return showAlert('Campos requeridos', 'Completa número de empleado y nombre.');
    }
    setGuardando(true);
    await onGuardar(num.trim(), nombre.trim());
    setGuardando(false);
    setNum('');
    setNombre('');
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

export default function OperadoresAdminScreen() {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await uphService.getOperadores();
    if (result.success) setOperadores(result.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleAgregar = async (num_empleado, nombre) => {
    const result = await uphService.crearOperador(num_empleado, nombre);
    if (result.success) {
      setModalVisible(false);
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

        {/* Buscador */}
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
              {!busqueda && (
                <Text style={styles.emptyHint}>Toca + para agregar el primero</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, !item.activo && styles.cardInactivo]}>
              <View style={[styles.avatar, !item.activo && styles.avatarInactivo]}>
                <Text style={styles.avatarText}>
                  {item.nombre.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.numEmpleado}>#{item.num_empleado}</Text>
              </View>
              <View style={[styles.estadoBadge, item.activo ? styles.activo : styles.inactivo]}>
                <Text style={styles.estadoText}>{item.activo ? 'Activo' : 'Inactivo'}</Text>
              </View>
            </View>
          )}
        />

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <ModalNuevoOperador
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onGuardar={handleAgregar}
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
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activo: { backgroundColor: '#1B5E2033', borderWidth: 1, borderColor: '#4CAF50' },
  inactivo: { backgroundColor: '#2D2D2D', borderWidth: 1, borderColor: '#424242' },
  estadoText: { color: '#BDBDBD', fontSize: 11 },
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
