import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { uphService } from '../services/UPHService';
import { showAlert } from '../utils/alertUtils';

export default function LiderDashboardScreen() {
  const { user, logout } = useAuth();
  const [turno, setTurno] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [turnoRes, resumenRes] = await Promise.all([
      uphService.getTurnoActual(),
      uphService.getResumen(),
    ]);
    if (turnoRes.success) setTurno(turnoRes.data);
    if (resumenRes.success) setResumen(resumenRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = () => {
    showAlert('Cerrar sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const nombre = user?.nombre || user?.username || 'Líder';

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A237E', '#0F0F0F']} style={styles.gradient} />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2196F3" />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hola, {nombre}</Text>
              <Text style={styles.roleLabel}>Líder de línea</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>

          <Divider style={styles.divider} />

          {/* Resumen del turno */}
          <Text style={styles.sectionTitle}>Turno actual</Text>
          {loading ? (
            <ActivityIndicator color="#2196F3" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.turnoCard}>
              {turno ? (
                <>
                  <Row label="Turno" value={turno.nombre || turno.turno || '—'} />
                  <Row label="Horario" value={turno.hora_inicio && turno.hora_fin ? `${turno.hora_inicio} – ${turno.hora_fin}` : '—'} />
                  {resumen?.modelo_activo && <Row label="Modelo activo" value={resumen.modelo_activo} highlight />}
                  {resumen?.operadores_asignados != null && (
                    <Row label="Operadores asignados" value={String(resumen.operadores_asignados)} />
                  )}
                  {resumen?.uph_actual != null && (
                    <Row label="UPH actual" value={String(resumen.uph_actual)} highlight />
                  )}
                </>
              ) : (
                <Text style={styles.noData}>Sin turno activo</Text>
              )}
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value, highlight }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 220 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  roleLabel: { color: '#90CAF9', fontSize: 13, marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#B71C1C',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  logoutText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },

  divider: { backgroundColor: '#2A2A2A', marginVertical: 16 },
  sectionTitle: { color: '#90CAF9', fontSize: 13, fontWeight: 'bold', marginBottom: 10, letterSpacing: 0.5 },

  turnoCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: '#888', fontSize: 13 },
  rowValue: { color: '#DDD', fontSize: 13, fontWeight: '600' },
  rowValueHighlight: { color: '#64B5F6' },
  noData: { color: '#666', fontSize: 13, textAlign: 'center', paddingVertical: 8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    flex: 1,
    minWidth: '44%',
  },
  quickIcon: { fontSize: 28, marginBottom: 8 },
  quickLabel: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  quickSubtitle: { color: '#888', fontSize: 12 },
});
