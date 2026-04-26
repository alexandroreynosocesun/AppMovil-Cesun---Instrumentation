import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uphService } from '../services/UPHService';

const COLORES_LINEA = [
  '#00856e', '#1565C0', '#7B1FA2', '#E65100', '#00695C', '#AD1457',
];

function iniciales(nombre) {
  if (!nombre) return '?';
  const p = nombre.trim().split(/\s+/);
  return (p[0]?.[0] || '') + (p[1]?.[0] || '');
}

function CardLinea({ item, index, onPress }) {
  const color = COLORES_LINEA[index % COLORES_LINEA.length];
  const numLinea = item.linea.replace('HI-', '');

  return (
    <TouchableOpacity style={[styles.card, { borderColor: color + '66' }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardHeader, { backgroundColor: color + '22' }]}>
        <View style={[styles.lineaBadge, { backgroundColor: color }]}>
          <Text style={styles.lineaBadgeText}>L{numLinea}</Text>
        </View>
        <View style={styles.liderRow}>
          {item.lider_nombre ? (
            <Text style={styles.liderNombre} numberOfLines={1}>
              {item.lider_nombre.split(' ').slice(0, 2).join(' ')}
            </Text>
          ) : (
            <Text style={styles.sinLider}>Sin líder</Text>
          )}
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.totalNum, { color }]}>{item.total_turno}</Text>
        <Text style={styles.totalLabel}>piezas en turno</Text>
        <Text style={styles.uphText}>UPH {item.uph_actual}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.estacionesCount}>
          {item.estaciones.length} estaciones activas
        </Text>
        <Text style={[styles.verDetalle, { color }]}>Ver →</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function UPHMonitorScreen({ navigation }) {
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const intervalRef = useRef(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const r = await uphService.getMonitorLineas();
    if (r.success) {
      setLineas(r.data.lineas || []);
      setUltimaActualizacion(new Date());
    }
    if (!silencioso) setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    intervalRef.current = setInterval(() => cargar(true), 10000);
    return () => clearInterval(intervalRef.current);
  }, [cargar]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar(true);
    setRefreshing(false);
  };

  const horaActualizacion = ultimaActualizacion
    ? ultimaActualizacion.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const totalGeneral = lineas.reduce((s, l) => s + (l.total_turno || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#040f0e" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>MONITOR UPH</Text>
          <Text style={styles.headerSub}>Actualizado {horaActualizacion}</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeNum}>{totalGeneral}</Text>
          <Text style={styles.totalBadgeLabel}>total</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00c8b8" />
          <Text style={styles.loadingText}>Cargando líneas…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00c8b8" />}
          showsVerticalScrollIndicator={false}
        >
          {lineas.map((item, index) => (
            <CardLinea
              key={item.linea}
              item={item}
              index={index}
              onPress={() => navigation.navigate('UPHMonitorLinea', { linea: item })}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040f0e' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#0a2e2a',
    backgroundColor: '#061412',
  },
  backBtn: { padding: 4, marginRight: 8 },
  backText: { color: '#00856e', fontSize: 22 },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#e0f7f5', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  headerSub: { color: '#00856e', fontSize: 10, marginTop: 1 },
  totalBadge: { alignItems: 'center', backgroundColor: '#0a2e2a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  totalBadgeNum: { color: '#00c8b8', fontSize: 18, fontWeight: '900' },
  totalBadgeLabel: { color: '#00856e', fontSize: 9, letterSpacing: 1 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#00856e', marginTop: 10 },

  grid: { padding: 12, gap: 12 },

  card: {
    backgroundColor: '#061412', borderRadius: 16, borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  lineaBadge: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  lineaBadgeText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  liderRow: { flex: 1 },
  liderNombre: { color: '#e0f7f5', fontSize: 13, fontWeight: '700' },
  sinLider: { color: '#444', fontSize: 12, fontStyle: 'italic' },

  cardBody: { alignItems: 'center', paddingVertical: 14, gap: 2 },
  totalNum: { fontSize: 48, fontWeight: '900', lineHeight: 52 },
  totalLabel: { color: '#00856e', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  uphText: { color: '#00c8b8', fontSize: 13, fontWeight: '700', marginTop: 4 },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#0a2e2a',
  },
  estacionesCount: { color: '#00856e', fontSize: 11 },
  verDetalle: { fontSize: 12, fontWeight: '700' },
});
