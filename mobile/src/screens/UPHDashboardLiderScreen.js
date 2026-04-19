import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Text, Image, Modal, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { uphService } from '../services/UPHService';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/apiClient';

const REFRESH_INTERVAL = 15000;
const BAR_H    = 300;
const CARD_W   = 130;
const n2 = (s) => { const p = (s || '').trim().split(' '); return p.length >= 3 ? p[0] + ' ' + p[2] : p.slice(0, 2).join(' '); };

function colorKPI(pct) {
  if (pct === null || pct === undefined) return '#546E7A';
  if (pct >= 100) return '#4CAF50';
  if (pct >= 90)  return '#FF9800';
  return '#F44336';
}

// ── Avatar ──────────────────────────────────────────────────
function Avatar({ op, size = 34 }) {
  const [err, setErr] = useState(false);
  if (op?.foto_url && !err) {
    const uri = op.foto_url.startsWith('http') ? op.foto_url : `${API_BASE_URL}${op.foto_url}`;
    return (
      <Image source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: '#37474F' }}
        onError={() => setErr(true)} />
    );
  }
  const ini = (op?.nombre || '?').trim().split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1565C033',
      borderWidth: 1, borderColor: '#1565C0', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#90CAF9', fontSize: size * 0.35, fontWeight: 'bold' }}>{ini}</Text>
    </View>
  );
}

// ── Medalla row ─────────────────────────────────────────────
const MEDALS = ['🥇', '🥈', '🥉'];
function MedallaRow({ op, rank, valor }) {
  return (
    <View style={s.medalRow}>
      <Text style={s.medalEmoji}>{MEDALS[rank] || `${rank + 1}.`}</Text>
      <Avatar op={op} size={28} />
      <Text style={s.medalNombre} numberOfLines={1}>{n2(op?.nombre)}</Text>
      <Text style={s.medalVal}>{valor} pzs</Text>
    </View>
  );
}

// ── Barra vertical por línea ────────────────────────────────
function BarraLinea({ linea, activa, onPress }) {
  const meta   = linea.uph_meta   || 0;
  const piezas = linea.piezas_hora || 0;
  const pct    = meta > 0 ? Math.min((piezas / meta) * 100, 120) : 0;
  const kpiPct = meta > 0 ? Math.round((piezas / meta) * 100) : null;
  const color  = colorKPI(kpiPct);
  const barH   = Math.round((pct / 120) * BAR_H);

  return (
    <TouchableOpacity
      style={[s.barraCard, activa && s.barraCardActiva]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.barraNombre, activa && { color: '#42A5F5' }]}>{linea.linea}</Text>
      <Text style={s.barraModelo} numberOfLines={2}>{linea.modelo || '—'}</Text>

      <View style={s.barraWrap}>
        {meta > 0 && (
          <View style={[s.metaLine, { bottom: Math.round((100 / 120) * BAR_H) }]} />
        )}
        <View style={s.barraFondo}>
          <View style={[s.barraRelleno, { height: barH, backgroundColor: color }]} />
        </View>
      </View>

      <Text style={[s.barraVal, { color }]}>{piezas}</Text>
      <Text style={[s.barraKPI, { color }]}>{kpiPct !== null ? `${kpiPct}%` : '—'}</Text>
      {meta > 0 && <Text style={s.barraMeta}>meta {meta}</Text>}
      <Text style={s.barraTap}>👆 ver ops</Text>
    </TouchableOpacity>
  );
}

// ── Modal operadores de una línea ───────────────────────────
function ModalLinea({ visible, linea, onClose, navigation }) {
  const [ops,     setOps]     = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !linea) return;
    setOps([]);
    setLoading(true);
    uphService.getScoreboardHoy(linea.linea).then(r => {
      if (r.success) {
        const map = {};
        for (const item of (r.data?.scoreboard || [])) {
          if (!item.num_empleado) continue;
          if (!map[item.num_empleado]) map[item.num_empleado] = { ...item };
          else map[item.num_empleado].total_hoy += item.total_hoy;
        }
        setOps(Object.values(map).sort((a, b) => b.total_hoy - a.total_hoy));
      }
      setLoading(false);
    });
  }, [visible, linea]);

  const meta   = linea?.uph_meta   || 0;
  const piezas = linea?.piezas_hora || 0;
  const kpiPct = meta > 0 ? Math.round((piezas / meta) * 100) : null;
  const color  = colorKPI(kpiPct);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <LinearGradient colors={['#0d1b2a', '#0a0f1a']} style={StyleSheet.absoluteFill} borderRadius={20} />

          {/* Header del modal */}
          <View style={m.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={m.sheetTitulo}>{linea?.linea}</Text>
              <Text style={m.sheetModelo} numberOfLines={1}>{linea?.modelo || 'Sin modelo'}</Text>
            </View>
            <View style={m.kpiBadge}>
              <Text style={[m.kpiVal, { color }]}>{piezas}</Text>
              <Text style={[m.kpiPct, { color }]}>{kpiPct !== null ? `${kpiPct}%` : '—'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={m.cerrarBtn}>
              <Text style={m.cerrarText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={m.divider} />

          {/* Lista de operadores */}
          <ScrollView style={m.opsList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color="#2196F3" style={{ marginVertical: 30 }} />
            ) : ops.length === 0 ? (
              <Text style={m.empty}>Sin operadores asignados hoy</Text>
            ) : (
              ops.map((op, i) => {
                const opPct = meta > 0 ? Math.round((op.total_hoy / meta) * 100) : null;
                const opCol = colorKPI(opPct);
                return (
                  <TouchableOpacity
                    key={op.num_empleado}
                    style={m.opRow}
                    onPress={() => {
                      onClose();
                      navigation.navigate('OperadorHistorialDia', {
                        num_empleado: op.num_empleado,
                        nombre: op.nombre,
                        foto_url: op.foto_url,
                        linea: linea.linea,
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={m.opRank}>{i + 1}</Text>
                    <Avatar op={op} size={36} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={m.opNombre} numberOfLines={1}>{op.nombre}</Text>
                      <Text style={m.opNum}>#{op.num_empleado}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[m.opPzs, { color: opCol }]}>{op.total_hoy} pzs</Text>
                      {opPct !== null && <Text style={[m.opPct, { color: opCol }]}>{opPct}%</Text>}
                    </View>
                    <Text style={m.opChevron}>›</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Pantalla ───────────────────────────────────────────────
export default function UPHDashboardLiderScreen({ navigation }) {
  const { user } = useAuth();
  const lineaUsuario = user?.linea_uph;

  const [lineas,      setLineas]      = useState([]);
  const [topOps,      setTopOps]      = useState(null);
  const [horaInicio,  setHoraInicio]  = useState('');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [ultimaAct,   setUltimaAct]   = useState(null);
  const [lineaModal,  setLineaModal]  = useState(null);  // linea seleccionada para modal

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [rRes, rTop] = await Promise.all([
      uphService.getResumen(),
      uphService.getTopOperadores(lineaUsuario || null),
    ]);
    if (rRes.success) {
      let data = rRes.data.lineas || [];
      if (lineaUsuario) {
        data = [
          ...data.filter(l => l.linea === lineaUsuario),
          ...data.filter(l => l.linea !== lineaUsuario),
        ];
      }
      setLineas(data);
      setUltimaAct(new Date());
    }
    if (rTop.success) {
      setTopOps(rTop.data);
      if (rTop.data.hora_inicio) {
        const d = new Date(rTop.data.hora_inicio);
        const esMediaHoraTurno = d.getMinutes() === 30 && (d.getHours() === 6 || d.getHours() === 18);
        const duracion = esMediaHoraTurno ? 30 : 60;
        const dFin = new Date(d.getTime() + duracion * 60 * 1000);
        const fmt = t => t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        setHoraInicio(`${fmt(d)} – ${fmt(dFin)}`);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [lineaUsuario]);

  useEffect(() => {
    cargar();
    const iv = setInterval(() => cargar(), REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [cargar]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#070d1a', '#0f0f0f']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.titulo}>Dashboard UPH</Text>
          <Text style={s.subtitulo}>
            {ultimaAct
              ? ultimaAct.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : ''}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />}
        >
          {/* Leyenda */}
          <View style={s.leyendaRow}>
            {[['#F44336', '<90%'], ['#FF9800', '90–99%'], ['#4CAF50', '≥100%']].map(([c, l]) => (
              <View key={l} style={s.leyendaItem}>
                <View style={[s.dot, { backgroundColor: c }]} />
                <Text style={s.leyendaText}>{l}</Text>
              </View>
            ))}
            {horaInicio ? <Text style={s.leyendaHora}>{horaInicio}</Text> : null}
          </View>

          {/* Medallas */}
          {topOps && (
            <View style={s.medallasWrap}>
              <View style={s.medalCard}>
                <Text style={s.medalCardTitulo}>⚡ Mejor esta hora</Text>
                {topOps.top_hora.length === 0
                  ? <Text style={s.emptyMedal}>Sin datos</Text>
                  : topOps.top_hora.map((op, i) => (
                      <MedallaRow key={op.num_empleado} op={op} rank={i} valor={op.piezas_hora} />
                    ))
                }
              </View>
              <View style={s.medalCard}>
                <Text style={s.medalCardTitulo}>🏆 Mejor del día</Text>
                {topOps.top_dia.length === 0
                  ? <Text style={s.emptyMedal}>Sin datos</Text>
                  : topOps.top_dia.map((op, i) => (
                      <MedallaRow key={op.num_empleado} op={op} rank={i} valor={op.piezas_dia} />
                    ))
                }
              </View>
            </View>
          )}

          {/* Barras por línea */}
          <Text style={s.secLabel}>PRODUCCIÓN POR LÍNEA — HORA ACTUAL</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <View style={s.barrasRow}>
              {lineas.map(l => (
                <BarraLinea
                  key={l.linea}
                  linea={l}
                  activa={l.linea === lineaUsuario}
                  onPress={() => setLineaModal(l)}
                />
              ))}
            </View>
          </ScrollView>

          <Text style={s.footer}>Se actualiza cada 15 s · Toca una barra para ver operadores</Text>
        </ScrollView>

        {/* Modal operadores */}
        <ModalLinea
          visible={!!lineaModal}
          linea={lineaModal}
          onClose={() => setLineaModal(null)}
          navigation={navigation}
        />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  safe:      { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:    { padding: 14, paddingBottom: 40 },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
               paddingHorizontal: 16, paddingVertical: 12,
               borderBottomWidth: 1, borderBottomColor: '#1a2a3a' },
  titulo:    { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitulo: { color: '#546E7A', fontSize: 11 },

  leyendaRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  leyendaText: { color: '#78909C', fontSize: 11 },
  leyendaHora: { color: '#42A5F5', fontSize: 11, marginLeft: 'auto' },

  medallasWrap:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  medalCard:       { flex: 1, backgroundColor: '#0d1b2a', borderRadius: 12,
                     borderWidth: 1, borderColor: '#1a2a3a', padding: 12 },
  medalCardTitulo: { color: '#90CAF9', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  medalRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  medalEmoji:      { fontSize: 14, width: 20 },
  medalNombre:     { color: '#cfd8e3', fontSize: 11, fontWeight: '600', flex: 1 },
  medalVal:        { color: '#42A5F5', fontSize: 12, fontWeight: '800' },
  emptyMedal:      { color: '#37474F', fontSize: 12 },

  secLabel:  { color: '#42A5F5', fontSize: 10, fontWeight: '700', letterSpacing: 2,
               marginBottom: 12, marginTop: 16 },
  barrasRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 4, paddingBottom: 4 },

  barraCard: {
    width: CARD_W, alignItems: 'center',
    backgroundColor: '#0d1b2a', borderRadius: 14,
    borderWidth: 1, borderColor: '#1a2a3a', padding: 10, paddingBottom: 12,
  },
  barraCardActiva: { borderColor: '#1565C0', backgroundColor: '#0d1b3e' },

  barraNombre: { color: '#cfd8e3', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  barraModelo: { color: '#546E7A', fontSize: 8, marginBottom: 10, textAlign: 'center', lineHeight: 11 },

  barraWrap:   { width: 68, height: BAR_H, justifyContent: 'flex-end', position: 'relative' },
  barraFondo:  { width: 68, height: BAR_H, backgroundColor: '#1a2a3a', borderRadius: 10,
                 justifyContent: 'flex-end', overflow: 'hidden' },
  barraRelleno:{ width: '100%', borderRadius: 8, minHeight: 4 },
  metaLine:    { position: 'absolute', left: 0, right: 0, height: 2,
                 backgroundColor: '#fff', opacity: 0.4, zIndex: 2 },

  barraVal:  { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  barraKPI:  { fontSize: 12, fontWeight: '700', marginTop: 1 },
  barraMeta: { color: '#37474F', fontSize: 8, marginTop: 2 },
  barraTap:  { color: '#1E3A5F', fontSize: 9, marginTop: 6 },

  footer: { color: '#263238', fontSize: 10, textAlign: 'center', marginTop: 8 },
});

// Estilos del modal
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1b2a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingHorizontal: 16, paddingBottom: 40,
    maxHeight: '75%', overflow: 'hidden',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sheetTitulo: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sheetModelo: { color: '#546E7A', fontSize: 12, marginTop: 2 },
  kpiBadge:    { alignItems: 'flex-end', marginRight: 4 },
  kpiVal:      { fontSize: 26, fontWeight: '800' },
  kpiPct:      { fontSize: 13, fontWeight: '700' },
  cerrarBtn:   { padding: 8 },
  cerrarText:  { color: '#546E7A', fontSize: 18 },
  divider:     { height: 1, backgroundColor: '#1a2a3a', marginBottom: 12 },
  opsList:     { maxHeight: 420 },
  empty:       { color: '#37474F', fontSize: 13, textAlign: 'center', paddingVertical: 30 },
  opRow:       { flexDirection: 'row', alignItems: 'center', gap: 8,
                 paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f1e2e' },
  opRank:      { color: '#37474F', fontSize: 12, fontWeight: '700', width: 18 },
  opNombre:    { color: '#cfd8e3', fontSize: 14, fontWeight: '600' },
  opNum:       { color: '#37474F', fontSize: 11, marginTop: 1 },
  opPzs:       { fontSize: 16, fontWeight: '800' },
  opPct:       { fontSize: 11, fontWeight: '700', marginTop: 1 },
  opChevron:   { color: '#546E7A', fontSize: 20 },
});
