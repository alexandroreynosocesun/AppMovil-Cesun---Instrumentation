import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Text, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { useAuth } from '../contexts/AuthContext';
import { uphService } from '../services/UPHService';
import { API_BASE_URL } from '../utils/apiClient';

const REFRESH_INTERVAL = 15000;
const n2 = (s) => { const p = (s||'').trim().split(' '); return p.length >= 3 ? p[0]+' '+p[2] : p.slice(0,2).join(' '); };
const BAR_H = 160; // altura máxima de la barra

// ── Color según KPI ────────────────────────────────────────
function colorKPI(pct) {
  if (pct === null || pct === undefined) return '#546E7A';
  if (pct >= 100) return '#4CAF50';
  if (pct >= 90)  return '#FF9800';
  return '#F44336';
}

// ── Avatar pequeño ─────────────────────────────────────────
function AvatarMin({ op, size = 32 }) {
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

// ── Barra vertical de una línea ────────────────────────────
function BarraLinea({ linea, lineaUsuario }) {
  const esMia = linea.linea === lineaUsuario;
  const meta   = linea.uph_meta || 0;
  const piezas = linea.piezas_hora || 0;
  const pct    = meta > 0 ? Math.min((piezas / meta) * 100, 120) : 0;
  const kpiPct = meta > 0 ? Math.round((piezas / meta) * 100) : null;
  const color  = colorKPI(kpiPct);

  // Altura de la barra
  const barAltura = Math.round((pct / 120) * BAR_H);
  // Posición línea meta (100% = BAR_H * (100/120))
  const metaY = BAR_H - Math.round((100 / 120) * BAR_H);

  return (
    <View style={[s.barraCard, esMia && s.barraCardMia]}>
      {/* Nombre línea */}
      <Text style={[s.barraNombre, esMia && { color: '#42A5F5' }]}>{linea.linea}</Text>

      {/* Modelo */}
      <Text style={s.barraModelo} numberOfLines={1}>{linea.modelo || '—'}</Text>

      {/* Contenedor barra */}
      <View style={s.barraWrap}>
        {/* Línea meta */}
        <View style={[s.metaLine, { bottom: Math.round((100 / 120) * BAR_H) }]} />
        <Text style={[s.metaLabel, { bottom: Math.round((100 / 120) * BAR_H) + 2 }]}>
          {meta}
        </Text>

        {/* Barra */}
        <View style={s.barraFondo}>
          <View style={[s.barraRelleno, { height: barAltura, backgroundColor: color }]} />
        </View>
      </View>

      {/* Piezas / KPI */}
      <Text style={[s.barraVal, { color }]}>{piezas}</Text>
      <Text style={[s.barraKPI, { color }]}>
        {kpiPct !== null ? `${kpiPct}%` : '—'}
      </Text>
    </View>
  );
}

// ── Fila de medalla ────────────────────────────────────────
const MEDALLAS = ['🥇', '🥈', '🥉'];
function FilaMedalla({ op, rank, valor, label }) {
  return (
    <View style={s.medallaRow}>
      <Text style={s.medallaEmoji}>{MEDALLAS[rank] || `${rank + 1}.`}</Text>
      <AvatarMin op={op} size={30} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={s.medallaNombre} numberOfLines={1}>
          {n2(op?.nombre)}
        </Text>
      </View>
      <Text style={s.medallaVal}>{valor} <Text style={s.medallaValLabel}>{label}</Text></Text>
    </View>
  );
}

// ── Pantalla principal ─────────────────────────────────────
export default function UPHDashboardScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user, logout } = useAuth();
  const lineaUsuario = user?.linea_uph;

  const [lineas,    setLineas]    = useState([]);
  const [topOps,    setTopOps]    = useState(null);
  const [horaInicio, setHoraInicio] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAct,  setUltimaAct]  = useState(null);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [rRes, rTop] = await Promise.all([
      uphService.getResumen(),
      uphService.getTopOperadores(lineaUsuario || null),
    ]);
    if (rRes.success) {
      let data = rRes.data.lineas || [];
      // Poner la línea del usuario primero
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
        setHoraInicio(d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
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

  const ahora = new Date();
  const horaActual = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={[s.container, isWeb && webStyles.container]}>
      <LinearGradient colors={['#070d1a', '#0f0f0f']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.titulo}>UPH en vivo</Text>
            <Text style={s.subtitulo}>{horaActual} · cada 15s</Text>
          </View>
          <TouchableOpacity style={s.btnTendencias}
            onPress={() => navigation.navigate('TendenciasUPH')}>
            <Text style={s.btnReporteText}>📈 Tendencias</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnReporte}
            onPress={() => navigation.navigate('ReporteSemanalUPH')}>
            <Text style={s.btnReporteText}>📊 Reporte</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            s.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#2196F3" />}
        >

          {/* ── Leyenda colores ── */}
          <View style={s.leyendaRow}>
            <View style={s.leyendaDot}><View style={[s.dot, { backgroundColor: '#F44336' }]} /><Text style={s.leyendaText}>{'<'}90%</Text></View>
            <View style={s.leyendaDot}><View style={[s.dot, { backgroundColor: '#FF9800' }]} /><Text style={s.leyendaText}>90–99%</Text></View>
            <View style={s.leyendaDot}><View style={[s.dot, { backgroundColor: '#4CAF50' }]} /><Text style={s.leyendaText}>≥100%</Text></View>
            <Text style={s.leyendaHora}>Hora: {horaInicio}–ahora</Text>
          </View>

          {/* ── Barras por línea ── */}
          {lineas.length === 0 ? (
            <Text style={s.emptyText}>Sin líneas configuradas</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={s.barrasRow}>
                {lineas.map(l => (
                  <BarraLinea key={l.linea} linea={l} lineaUsuario={lineaUsuario} />
                ))}
              </View>
            </ScrollView>
          )}

          {/* ── Medallas ── */}
          {topOps && (
            <View style={s.medallasWrap}>
              {/* Top Hora */}
              <View style={s.medallaCard}>
                <Text style={s.medallaCardTitulo}>⚡ Mejor esta hora</Text>
                {topOps.top_hora.length === 0
                  ? <Text style={s.emptyMedalla}>Sin datos</Text>
                  : topOps.top_hora.map((op, i) => (
                      <FilaMedalla key={op.num_empleado} op={op} rank={i}
                        valor={op.piezas_hora} label="pzs" />
                    ))
                }
              </View>

              {/* Top Día */}
              <View style={s.medallaCard}>
                <Text style={s.medallaCardTitulo}>🏆 Mejor del día</Text>
                {topOps.top_dia.length === 0
                  ? <Text style={s.emptyMedalla}>Sin datos</Text>
                  : topOps.top_dia.map((op, i) => (
                      <FilaMedalla key={op.num_empleado} op={op} rank={i}
                        valor={op.piezas_dia} label="pzs" />
                    ))
                }
              </View>
            </View>
          )}

          <Text style={s.footer}>
            {ultimaAct ? `Actualizado: ${ultimaAct.toLocaleTimeString('es-MX')}` : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1 },
  safeArea:    { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#070d1a' },
  scroll:      { padding: 14, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a2a3a',
  },
  titulo:    { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitulo: { color: '#546E7A', fontSize: 11, marginTop: 2 },
  btnTendencias: { backgroundColor: '#00695C', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnReporte: { backgroundColor: '#1565C0', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnReporteText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  leyendaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  leyendaDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  leyendaText:{ color: '#78909C', fontSize: 11 },
  leyendaHora:{ color: '#42A5F5', fontSize: 11, marginLeft: 'auto' },

  barrasRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 4 },

  // ── Barra ──
  barraCard: {
    width: 80, alignItems: 'center',
    backgroundColor: '#0d1b2a', borderRadius: 12,
    borderWidth: 1, borderColor: '#1a2a3a',
    padding: 8, paddingBottom: 10,
  },
  barraCardMia: { borderColor: '#1565C0', backgroundColor: '#0d1b3e' },
  barraNombre: { color: '#cfd8e3', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  barraModelo: { color: '#546E7A', fontSize: 8, marginBottom: 8, textAlign: 'center' },

  barraWrap: { width: 36, height: BAR_H, position: 'relative', justifyContent: 'flex-end' },
  barraFondo: {
    width: 36, height: BAR_H,
    backgroundColor: '#1a2a3a', borderRadius: 6,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  barraRelleno: { width: '100%', borderRadius: 6, minHeight: 3 },

  metaLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: '#fff', opacity: 0.5, zIndex: 2,
  },
  metaLabel: {
    position: 'absolute', right: -28, fontSize: 8,
    color: '#fff', opacity: 0.6, zIndex: 3,
  },

  barraVal:  { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 6 },
  barraKPI:  { fontSize: 11, fontWeight: '700', marginTop: 1 },

  // ── Medallas ──
  medallasWrap: { flexDirection: 'row', gap: 10 },
  medallaCard: {
    flex: 1, backgroundColor: '#0d1b2a', borderRadius: 12,
    borderWidth: 1, borderColor: '#1a2a3a', padding: 12,
  },
  medallaCardTitulo: { color: '#90CAF9', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  medallaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  medallaEmoji: { fontSize: 16, width: 24 },
  medallaNombre: { color: '#cfd8e3', fontSize: 11, fontWeight: '600' },
  medallaVal: { color: '#42A5F5', fontSize: 13, fontWeight: '800' },
  medallaValLabel: { color: '#546E7A', fontSize: 10, fontWeight: '400' },
  emptyMedalla: { color: '#37474F', fontSize: 12 },

  emptyText: { color: '#546E7A', fontSize: 15, textAlign: 'center', marginTop: 40 },
  footer: { color: '#263238', fontSize: 11, textAlign: 'center', marginTop: 20 },
});
