import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  Text, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { uphService } from '../services/UPHService';

const DIAS_OPCIONES = [7, 14, 30];

function colorKPI(kpi) {
  if (kpi >= 90) return '#4CAF50';
  if (kpi >= 70) return '#FF9800';
  return '#F44336';
}

function FilaDia({ item }) {
  const color = colorKPI(item.kpi_pct);
  return (
    <View style={styles.filaDia}>
      <View style={styles.filaDiaFecha}>
        <Text style={styles.fechaTexto}>{item.fecha}</Text>
        <Text style={styles.eventosTexto}>{item.total_eventos} pzs</Text>
      </View>

      <View style={styles.filaDiaDatos}>
        {/* Barra de KPI */}
        <View style={styles.barraRow}>
          <View style={styles.barraFondo}>
            <View
              style={[
                styles.barraRelleno,
                { width: `${Math.min(item.kpi_pct, 100)}%`, backgroundColor: color },
              ]}
            />
          </View>
          <Text style={[styles.kpiText, { color }]}>{item.kpi_pct}%</Text>
        </View>

        <View style={styles.uphRow}>
          <Text style={styles.uphLabel}>UPH real: </Text>
          <Text style={[styles.uphVal, { color }]}>{item.uph_promedio}</Text>
          <Text style={styles.uphLabel}>  /  Meta: </Text>
          <Text style={styles.uphMeta}>{item.uph_meta}</Text>
        </View>
      </View>
    </View>
  );
}

export default function OperadorHistorialScreen({ route }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const operador = route?.params?.operador;
  const [dias, setDias] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (!operador?.num_empleado) return;
    if (isRefresh) setRefreshing(true);
    const result = await uphService.getHistorialOperador(operador.num_empleado, dias);
    if (result.success) setData(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [operador, dias]);

  useEffect(() => {
    setLoading(true);
    cargar();
  }, [cargar]);

  const historial = data?.historial || [];
  const promedioGeneral = historial.length > 0
    ? (historial.reduce((sum, d) => sum + d.uph_promedio, 0) / historial.length).toFixed(1)
    : 0;
  const kpiGeneral = historial.length > 0
    ? (historial.reduce((sum, d) => sum + d.kpi_pct, 0) / historial.length).toFixed(1)
    : 0;

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />
          }
        >
          {/* Info del operador */}
          <View style={styles.opCard}>
            <Text style={styles.opNombre}>{operador?.nombre || 'Operador'}</Text>
            <Text style={styles.opNum}>#{operador?.num_empleado}</Text>
          </View>

          {/* Resumen */}
          {!loading && historial.length > 0 && (
            <View style={styles.resumenRow}>
              <View style={styles.resumenBlock}>
                <Text style={styles.resumenLabel}>UPH Promedio</Text>
                <Text style={[styles.resumenVal, { color: colorKPI(Number(kpiGeneral)) }]}>
                  {promedioGeneral}
                </Text>
              </View>
              <View style={styles.resumenSep} />
              <View style={styles.resumenBlock}>
                <Text style={styles.resumenLabel}>KPI Promedio</Text>
                <Text style={[styles.resumenVal, { color: colorKPI(Number(kpiGeneral)) }]}>
                  {kpiGeneral}%
                </Text>
              </View>
              <View style={styles.resumenSep} />
              <View style={styles.resumenBlock}>
                <Text style={styles.resumenLabel}>Días activos</Text>
                <Text style={styles.resumenVal}>{historial.length}</Text>
              </View>
            </View>
          )}

          {/* Selector de período */}
          <View style={styles.diasSelector}>
            {DIAS_OPCIONES.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.diasBtn, dias === d && styles.diasBtnActivo]}
                onPress={() => setDias(d)}
              >
                <Text style={[styles.diasBtnText, dias === d && styles.diasBtnTextActivo]}>
                  {d} días
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Historial */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#2196F3" />
            </View>
          ) : historial.length === 0 ? (
            <Text style={styles.emptyText}>Sin actividad en los últimos {dias} días</Text>
          ) : (
            historial.map((item) => <FilaDia key={item.fecha} item={item} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { padding: 24, alignItems: 'center' },
  scroll: { padding: 16 },

  // Operador
  opCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#2D2D2D', alignItems: 'center',
  },
  opNombre: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  opNum: { color: '#9E9E9E', fontSize: 13, marginTop: 4 },

  // Resumen
  resumenRow: {
    flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 12,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2D2D2D',
  },
  resumenBlock: { flex: 1, alignItems: 'center' },
  resumenLabel: { color: '#757575', fontSize: 11, marginBottom: 4 },
  resumenVal: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  resumenSep: { width: 1, backgroundColor: '#2D2D2D', marginHorizontal: 8 },

  // Selector días
  diasSelector: {
    flexDirection: 'row', marginBottom: 16, backgroundColor: '#1A1A1A',
    borderRadius: 8, padding: 4, borderWidth: 1, borderColor: '#2D2D2D',
  },
  diasBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  diasBtnActivo: { backgroundColor: '#1565C0' },
  diasBtnText: { color: '#757575', fontSize: 13 },
  diasBtnTextActivo: { color: '#FFFFFF', fontWeight: 'bold' },

  // Fila diaria
  filaDia: {
    flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 10,
    marginBottom: 8, padding: 12, borderWidth: 1, borderColor: '#2D2D2D',
  },
  filaDiaFecha: { width: 80, justifyContent: 'center' },
  fechaTexto: { color: '#BDBDBD', fontSize: 12, fontWeight: 'bold' },
  eventosTexto: { color: '#616161', fontSize: 11, marginTop: 2 },
  filaDiaDatos: { flex: 1 },
  barraRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barraFondo: {
    flex: 1, height: 12, backgroundColor: '#2D2D2D',
    borderRadius: 6, overflow: 'hidden', marginRight: 8,
  },
  barraRelleno: { height: 12, borderRadius: 6 },
  kpiText: { fontSize: 13, fontWeight: 'bold', width: 40, textAlign: 'right' },
  uphRow: { flexDirection: 'row', alignItems: 'center' },
  uphLabel: { color: '#757575', fontSize: 11 },
  uphVal: { fontSize: 13, fontWeight: 'bold' },
  uphMeta: { color: '#9E9E9E', fontSize: 13 },

  emptyText: { color: '#757575', textAlign: 'center', marginTop: 32, fontSize: 14 },
});
