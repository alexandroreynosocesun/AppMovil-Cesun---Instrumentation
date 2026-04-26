import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar, Modal, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uphService } from '../services/UPHService';

function iniciales(nombre) {
  if (!nombre) return '?';
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[2]?.[0] || p[1]?.[0] || '')).toUpperCase();
}

export default function UPHMonitorLineaScreen({ route, navigation }) {
  const { linea: lineaInicial } = route.params;
  const [lineaData, setLineaData] = useState(lineaInicial);
  const [refreshing, setRefreshing] = useState(false);
  const [showLiderPicker, setShowLiderPicker] = useState(false);
  const [lideres, setLideres] = useState([]);
  const [loadingLideres, setLoadingLideres] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const intervalRef = useRef(null);

  const numLinea = lineaData.linea.replace('HI-', '');
  const maxEst = lineaData.estaciones.reduce((m, e) => Math.max(m, e.total), 1);

  const actualizarLinea = useCallback(async (silencioso = false) => {
    const r = await uphService.getMonitorLineas();
    if (r.success) {
      const updated = (r.data.lineas || []).find(l => l.linea === lineaData.linea);
      if (updated) setLineaData(updated);
    }
  }, [lineaData.linea]);

  useEffect(() => {
    intervalRef.current = setInterval(() => actualizarLinea(true), 10000);
    return () => clearInterval(intervalRef.current);
  }, [actualizarLinea]);

  const onRefresh = async () => {
    setRefreshing(true);
    await actualizarLinea(true);
    setRefreshing(false);
  };

  const abrirPickerLider = async () => {
    setShowLiderPicker(true);
    setLoadingLideres(true);
    const r = await uphService.getLideresLista();
    if (r.success) {
      setLideres(r.data.lideres || []);
    }
    setLoadingLideres(false);
  };

  const asignarLider = async (lider) => {
    setShowLiderPicker(false);
    setAsignando(true);
    const r = await uphService.vincularLiderLinea(lider.num_empleado, lineaData.linea);
    setAsignando(false);
    if (r.success) {
      setLineaData(prev => ({
        ...prev,
        lider_nombre: lider.nombre,
        lider_emp: lider.num_empleado,
      }));
      Alert.alert('Listo', `${lider.nombre} asignado a ${lineaData.linea}`);
    } else {
      Alert.alert('Error', 'No se pudo asignar el líder');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#040f0e" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.lineaBadge}>
          <Text style={styles.lineaBadgeText}>L{numLinea}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{lineaData.linea}</Text>
          <Text style={styles.headerSub}>
            {lineaData.total_turno} pzs · UPH {lineaData.uph_actual}
          </Text>
        </View>
      </View>

      {/* Card líder */}
      <View style={styles.liderCard}>
        <View style={styles.liderAvatar}>
          <Text style={styles.liderAvatarText}>{iniciales(lineaData.lider_nombre)}</Text>
        </View>
        <View style={styles.liderInfo}>
          <Text style={styles.liderNombre}>
            {lineaData.lider_nombre || 'Sin líder asignado'}
          </Text>
          <Text style={styles.liderSub}>Líder de línea</Text>
        </View>
        <TouchableOpacity
          style={styles.cambiarBtn}
          onPress={abrirPickerLider}
          disabled={asignando}
        >
          {asignando
            ? <ActivityIndicator size="small" color="#00c8b8" />
            : <Text style={styles.cambiarBtnText}>Cambiar</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Botón asignar operadores */}
      <TouchableOpacity
        style={styles.asignarBtn}
        onPress={() => navigation.navigate('AsignacionLinea', { lineaNombre: lineaData.linea })}
      >
        <Text style={styles.asignarBtnText}>👷 Asignar Operadores a {lineaData.linea}</Text>
      </TouchableOpacity>

      {/* Estaciones */}
      <ScrollView
        contentContainerStyle={styles.estList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00c8b8" />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.seccionTitle}>ESTACIONES DEL TURNO</Text>
        {lineaData.estaciones.length === 0 ? (
          <Text style={styles.sinDatos}>Sin eventos registrados aún</Text>
        ) : (
          lineaData.estaciones.map((est) => {
            const pct = maxEst > 0 ? (est.total / maxEst) * 100 : 0;
            return (
              <View key={est.estacion} style={styles.estCard}>
                <Text style={styles.estNombre}>{est.estacion}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.estTotal}>{est.total}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal selector de líder */}
      <Modal visible={showLiderPicker} animationType="slide" transparent onRequestClose={() => setShowLiderPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Líder</Text>
              <TouchableOpacity onPress={() => setShowLiderPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingLideres ? (
              <ActivityIndicator size="large" color="#00c8b8" style={{ marginVertical: 30 }} />
            ) : (
              <FlatList
                data={lideres}
                keyExtractor={l => l.num_empleado}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.liderItem} onPress={() => asignarLider(item)}>
                    <View style={styles.liderItemAvatar}>
                      <Text style={styles.liderItemAvatarText}>{iniciales(item.nombre)}</Text>
                    </View>
                    <View style={styles.liderItemInfo}>
                      <Text style={styles.liderItemNombre}>{item.nombre}</Text>
                      <Text style={styles.liderItemEmp}>#{item.num_empleado}</Text>
                    </View>
                    {lineaData.lider_emp === item.num_empleado && (
                      <Text style={styles.actualBadge}>ACTUAL</Text>
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040f0e' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#0a2e2a',
    backgroundColor: '#061412',
  },
  backBtn: { padding: 4 },
  backText: { color: '#00856e', fontSize: 22 },
  lineaBadge: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#00856e', alignItems: 'center', justifyContent: 'center',
  },
  lineaBadgeText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#e0f7f5', fontSize: 15, fontWeight: '900' },
  headerSub: { color: '#00c8b8', fontSize: 11, marginTop: 1 },

  liderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 12, padding: 14,
    backgroundColor: '#061412', borderRadius: 14, borderWidth: 1, borderColor: '#0a2e2a',
  },
  liderAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#0a2e2a', borderWidth: 2, borderColor: '#00856e',
    alignItems: 'center', justifyContent: 'center',
  },
  liderAvatarText: { color: '#00c8b8', fontSize: 16, fontWeight: '900' },
  liderInfo: { flex: 1 },
  liderNombre: { color: '#e0f7f5', fontSize: 14, fontWeight: '700' },
  liderSub: { color: '#00856e', fontSize: 11, marginTop: 1 },
  cambiarBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#0a2e2a', borderRadius: 20, borderWidth: 1, borderColor: '#00856e',
  },
  cambiarBtnText: { color: '#00c8b8', fontSize: 12, fontWeight: '700' },

  asignarBtn: {
    marginHorizontal: 12, marginBottom: 4,
    backgroundColor: '#0a2e2a', borderRadius: 12,
    borderWidth: 1, borderColor: '#00856e',
    paddingVertical: 12, alignItems: 'center',
  },
  asignarBtnText: { color: '#00c8b8', fontSize: 13, fontWeight: '700' },

  estList: { padding: 12, gap: 8 },
  seccionTitle: { color: '#00856e', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  sinDatos: { color: '#444', textAlign: 'center', marginTop: 40, fontSize: 13 },

  estCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#061412', borderRadius: 12, borderWidth: 1, borderColor: '#0a2e2a',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  estNombre: { color: '#e0f7f5', fontSize: 13, fontWeight: '700', width: 60 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#0a2e2a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#00c8b8', borderRadius: 4 },
  estTotal: { color: '#00c8b8', fontSize: 14, fontWeight: '900', width: 40, textAlign: 'right' },

  modalOverlay: {
    flex: 1, backgroundColor: '#000000cc',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#061412', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%', paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1, borderBottomColor: '#0a2e2a',
  },
  modalTitle: { color: '#e0f7f5', fontSize: 15, fontWeight: '900' },
  modalClose: { color: '#00856e', fontSize: 20 },

  liderItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  liderItemAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0a2e2a', borderWidth: 1, borderColor: '#00856e',
    alignItems: 'center', justifyContent: 'center',
  },
  liderItemAvatarText: { color: '#00c8b8', fontSize: 14, fontWeight: '900' },
  liderItemInfo: { flex: 1 },
  liderItemNombre: { color: '#e0f7f5', fontSize: 14, fontWeight: '700' },
  liderItemEmp: { color: '#00856e', fontSize: 11, marginTop: 1 },
  actualBadge: {
    fontSize: 9, fontWeight: '900', color: '#00c8b8',
    backgroundColor: '#0a2e2a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    letterSpacing: 1,
  },
  sep: { height: 1, backgroundColor: '#0a2e2a', marginHorizontal: 18 },
});
