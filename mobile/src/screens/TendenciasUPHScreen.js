import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../utils/apiClient';

const { width: SW } = Dimensions.get('window');
const CHART_H = 120;
const META     = 100;
const REFRESH  = 60000;

// ── Lógica turno activo (misma que backend) ───────────────────
function turnoActivo() {
  const ahora = new Date();
  const wd    = ahora.getDay();
  const mins  = ahora.getHours() * 60 + ahora.getMinutes();
  const T_INI = 6 * 60 + 30;
  const T_FIN = 18 * 60 + 30;

  let nombre = null, inicio = new Date(ahora);

  const esLunJue = wd >= 1 && wd <= 4;
  const esVie    = wd === 5;
  const esSabDom = wd === 6 || wd === 0;

  if (esLunJue) {
    if (mins >= T_INI && mins < T_FIN) {
      nombre = 'Turno A'; inicio.setHours(6, 30, 0, 0);
    } else if (mins >= T_FIN) {
      nombre = 'Turno B'; inicio.setHours(18, 30, 0, 0);
    } else {
      nombre = 'Turno B';
      inicio.setDate(inicio.getDate() - 1); inicio.setHours(18, 30, 0, 0);
    }
  } else if (esVie) {
    if (mins < T_INI) {
      nombre = 'Turno B';
      inicio.setDate(inicio.getDate() - 1); inicio.setHours(18, 30, 0, 0);
    } else if (mins >= T_INI && mins < T_FIN) {
      nombre = 'Turno C'; inicio.setHours(6, 30, 0, 0);
    } else {
      nombre = 'Turno B'; inicio.setHours(18, 30, 0, 0);
    }
  } else if (esSabDom) {
    if (mins >= T_INI && mins < T_FIN) {
      nombre = 'Turno C'; inicio.setHours(6, 30, 0, 0);
    } else {
      nombre = null; inicio = null;
    }
  }

  return { nombre, inicio };
}

function col(pct) {
  if (!pct) return '#546E7A';
  return pct >= 100 ? '#4CAF50' : pct >= 90 ? '#FF9800' : '#F44336';
}

function lineaLabel(l) {
  return (l || '').replace(/^HI-?/i, 'L');
}

// ── Gráfica de línea SVG-like usando Views ────────────────────
function MiniLineChart({ puntos, meta }) {
  if (!puntos || puntos.length < 2) {
    return (
      <View style={[ch.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#37474F', fontSize: 11 }}>Sin datos</Text>
      </View>
    );
  }

  // Normalizar a tasa horaria para display consistente
  const uphNorm = puntos.map(p =>
    p.minutos > 0 ? Math.round(p.uph / p.minutos * 60) : p.uph
  );
  const maxVal = Math.max(meta * 1.2, ...uphNorm) || meta * 1.2;
  const W      = SW - 48;
  const step   = puntos.length > 1 ? W / (puntos.length - 1) : W;

  const pts = puntos.map((p, i) => ({
    x: i * step,
    y: CHART_H - (uphNorm[i] / maxVal) * CHART_H,
    uph: uphNorm[i],
    uphRaw: p.uph,
    hora: p.hora,
    metaSlot: p.meta_slot != null ? p.meta_slot : meta,
  }));

  // Línea de meta en posición de la meta horaria completa (referencia)
  const metaY = CHART_H - (meta / maxVal) * CHART_H;

  return (
    <View style={ch.wrap}>
      {/* Línea de meta punteada */}
      <View style={[ch.metaLine, { top: metaY }]} />
      <Text style={[ch.metaLabel, { top: metaY - 10 }]}>{meta}</Text>

      {/* Segmentos de línea */}
      {pts.slice(0, -1).map((pt, i) => {
        const next = pts[i + 1];
        const dx   = next.x - pt.x;
        const dy   = next.y - pt.y;
        const len  = Math.sqrt(dx * dx + dy * dy);
        const ang  = Math.atan2(dy, dx) * (180 / Math.PI);
        const c    = col(meta > 0 ? Math.round(pt.uph / meta * 100) : null);
        return (
          <View key={i} style={[ch.seg, {
            width: len, left: pt.x, top: pt.y,
            transform: [{ rotate: `${ang}deg` }],
            borderColor: c,
          }]} />
        );
      })}

      {/* Puntos + etiquetas */}
      {pts.map((pt, i) => {
        const pct   = meta > 0 ? Math.round(pt.uph / meta * 100) : null;
        const c     = col(pct);
        const delta = pt.uph - meta;
        const flecha = pct >= 100 ? '▲' : pct >= 90 ? '▶' : '▼';
        return (
          <View key={i} style={[ch.ptWrap, { left: pt.x - 4, top: pt.y - 4 }]}>
            <View style={[ch.pt, { backgroundColor: c }]} />
            {/* Etiqueta arriba del punto */}
            <View style={ch.labelWrap}>
              <Text style={[ch.flecha, { color: c }]}>{flecha}</Text>
              <Text style={[ch.delta, { color: c }]}>
                {delta >= 0 ? `+${delta}` : `${delta}`}
              </Text>
            </View>
            {/* Hora abajo */}
            {i % 2 === 0 && (
              <Text style={ch.hora}>{pt.hora}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Card de una línea ─────────────────────────────────────────
function LineaCard({ linea }) {
  const puntos   = linea.puntos || [];
  const meta     = linea.uph_meta || META;
  const con      = puntos.filter(p => p.uph > 0);
  const ultPunto = con.length ? con[con.length - 1] : null;
  const uphAct   = ultPunto
    ? (ultPunto.minutos > 0 ? Math.round(ultPunto.uph / ultPunto.minutos * 60) : ultPunto.uph)
    : 0;
  const pct      = meta > 0 ? Math.round(uphAct / meta * 100) : null;
  const c        = col(pct);

  // Flecha tendencia
  const ult  = con.length >= 2 ? con[con.length - 1].uph : null;
  const prev = con.length >= 2 ? con[con.length - 2].uph : null;
  const diff = ult != null && prev != null ? ult - prev : 0;
  const trendFlecha = diff > 2 ? '↑' : diff < -2 ? '↓' : '→';
  const trendColor  = diff > 2 ? '#4CAF50' : diff < -2 ? '#F44336' : '#FF9800';

  return (
    <View style={[s.card, { borderColor: c + '55' }]}>
      <View style={s.cardHead}>
        <Text style={[s.cardLabel, { color: c }]}>{lineaLabel(linea.linea)}</Text>
        <View style={s.cardInfo}>
          <View style={s.uphRow}>
            <Text style={[s.uphVal, { color: c }]}>{uphAct}</Text>
            <Text style={s.uphMeta}>/ {meta}</Text>
            {pct != null && <Text style={[s.uphPct, { color: c }]}> {pct}%</Text>}
          </View>
          <Text style={s.modelo}>{linea.modelo || '—'}</Text>
        </View>
        <Text style={[s.trend, { color: trendColor }]}>{trendFlecha}</Text>
      </View>
      <MiniLineChart puntos={puntos} meta={meta} />
    </View>
  );
}

// ── Mock data ─────────────────────────────────────────────────
// base = tasa horaria (pzs/hr), meta = meta horaria
// Genera piezas REALES por slot (proporcional a duración del slot)
function mockPuntos(base, inicio, meta) {
  const ahora = new Date();
  const puntos = [];
  let tasa = base;
  const cur = new Date(inicio);
  let first = true;
  while (cur <= ahora) {
    let fin;
    if (first) {
      fin = new Date(cur); fin.setMinutes(0,0,0); fin.setHours(fin.getHours()+1);
      first = false;
    } else {
      fin = new Date(cur); fin.setHours(fin.getHours()+1);
    }
    if (fin > ahora) fin = new Date(ahora);
    const minutos = Math.max(1, (fin - cur) / 60000);
    tasa = Math.max(0, Math.round(tasa + (Math.random() - 0.48) * 16));
    const piezas   = Math.round(tasa * minutos / 60);
    const metaSlot = Math.round(meta * minutos / 60);
    const h = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`;
    puntos.push({ hora: h, uph: piezas, meta_slot: metaSlot, minutos: Math.round(minutos) });
    const next = new Date(cur); next.setMinutes(0,0,0); next.setHours(next.getHours()+1);
    cur.setTime(next.getTime());
  }
  return puntos;
}

function buildMock(inicio) {
  return { lineas: [
    { linea:'HI-1', uph_meta:100, puntos: mockPuntos(112, inicio, 100) },
    { linea:'HI-2', uph_meta:100, puntos: mockPuntos(94,  inicio, 100) },
    { linea:'HI-3', uph_meta:100, puntos: mockPuntos(78,  inicio, 100) },
    { linea:'HI-4', uph_meta:100, puntos: mockPuntos(103, inicio, 100) },
    { linea:'HI-5', uph_meta:100, puntos: mockPuntos(88,  inicio, 100) },
    { linea:'HI-6', uph_meta:100, puntos: mockPuntos(100, inicio, 100) },
  ]};
}

// ── Screen principal ──────────────────────────────────────────
export default function TendenciasUPHScreen({ navigation }) {
  const [lineas,  setLineas]  = useState([]);
  const [turno,   setTurno]   = useState('');
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    const { nombre, inicio } = turnoActivo();
    setTurno(nombre || 'Fuera de horario');

    if (!inicio) {
      setLineas([]);
      setLoading(false);
      return;
    }

    try {
      const desde = inicio.toISOString();
      const res   = await apiClient.get(`/uph/tendencias?desde=${encodeURIComponent(desde)}`);
      const data  = res.data;
      const sinDatos = (data.lineas || []).every(l => l.puntos.every(p => p.uph === 0));
      setLineas(sinDatos ? buildMock(inicio).lineas : data.lineas);
    } catch {
      setLineas(buildMock(inicio).lineas);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, REFRESH);
    return () => clearInterval(iv);
  }, [cargar]);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#040f0e', '#061412']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe} edges={['top','bottom']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.titulo}>📈 Tendencias UPH</Text>
            <Text style={s.subtitulo}>Por hora · {turno}</Text>
          </View>
          <View style={[s.turnoBadge, !turno.includes('Turno') && { backgroundColor: '#333' }]}>
            <Text style={s.turnoTxt}>{turno}</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#00c8b8" />
          </View>
        ) : lineas.length === 0 ? (
          <View style={s.center}>
            <Text style={s.fueraHorario}>🌙 Fuera de horario</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {lineas.map(l => <LineaCard key={l.linea} linea={l} />)}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Estilos chart ─────────────────────────────────────────────
const ch = StyleSheet.create({
  wrap:      { height: CHART_H + 30, position: 'relative', marginTop: 8 },
  metaLine:  { position: 'absolute', left: 0, right: 0, height: 1,
               borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)',
               borderStyle: 'dashed' },
  metaLabel: { position: 'absolute', right: 0, fontSize: 8, color: 'rgba(255,255,255,0.3)' },
  seg:       { position: 'absolute', height: 0, borderTopWidth: 2,
               transformOrigin: 'left center' },
  ptWrap:    { position: 'absolute', width: 8, height: 8 },
  pt:        { width: 8, height: 8, borderRadius: 4 },
  labelWrap: { position: 'absolute', top: -22, left: -6, alignItems: 'center', width: 20 },
  flecha:    { fontSize: 8, fontWeight: 'bold', lineHeight: 10 },
  delta:     { fontSize: 7, fontWeight: 'bold', lineHeight: 9 },
  hora:      { position: 'absolute', top: 14, left: -10, fontSize: 7,
               color: '#1a5048', width: 28, textAlign: 'center' },
});

// ── Estilos screen ────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1 },
  safe:    { flex: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:  { padding: 10, gap: 10, paddingBottom: 30 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#0a2e2a',
  },
  backBtn:  { padding: 6 },
  backTxt:  { fontSize: 20, color: '#00c8b8' },
  titulo:   { fontSize: 16, fontWeight: '900', color: '#00c8b8', letterSpacing: 1 },
  subtitulo:{ fontSize: 11, color: '#00856e', letterSpacing: 1 },
  turnoBadge: {
    marginLeft: 'auto', backgroundColor: '#00877a',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: '#00c8b8',
  },
  turnoTxt: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  fueraHorario: { color: '#1a5048', fontSize: 16, fontWeight: '700', letterSpacing: 2 },

  card: {
    backgroundColor: '#061412', borderWidth: 1, borderRadius: 14,
    padding: 12, gap: 4,
  },
  cardHead:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel: { fontSize: 28, fontWeight: '900', letterSpacing: -1, width: 42 },
  cardInfo:  { flex: 1 },
  uphRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  uphVal:    { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  uphMeta:   { fontSize: 12, color: '#00856e' },
  uphPct:    { fontSize: 13, fontWeight: '800' },
  modelo:    { fontSize: 10, color: '#00856e', letterSpacing: 1, textTransform: 'uppercase' },
  trend:     { fontSize: 22, fontWeight: '900' },
});
