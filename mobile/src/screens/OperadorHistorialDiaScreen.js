import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, Text, Image,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { uphService } from '../services/UPHService';
import { API_BASE_URL } from '../utils/apiClient';

const BAR_W_PER_HOUR = 48;  // ancho fijo por barra (px)
const BAR_H = 160;
const PAD = { left: 28, right: 20, top: 12, bottom: 28 };

function ini(nombre) {
  return (nombre || '?').trim().split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
}

function Avatar({ op, size = 48 }) {
  const [err, setErr] = useState(false);
  if (op?.foto_url && !err) {
    const uri = op.foto_url.startsWith('http') ? op.foto_url : `${API_BASE_URL}${op.foto_url}`;
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#1565C0' }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#1565C033', borderWidth: 2, borderColor: '#1565C0',
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#90CAF9', fontSize: size * 0.36, fontWeight: 'bold' }}>{ini(op?.nombre)}</Text>
    </View>
  );
}

function GraficaBarras({ horas, meta }) {
  if (!horas || horas.length === 0) return null;

  const barW   = 32;
  const gap    = BAR_W_PER_HOUR - barW;
  const svgW   = PAD.left + horas.length * BAR_W_PER_HOUR + PAD.right;
  const h      = BAR_H - PAD.top - PAD.bottom;
  const maxVal = Math.max(meta || 0, ...horas.map(d => d.piezas)) * 1.2 || 1;
  const metaY  = PAD.top + h - (meta / maxVal) * h;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={svgW} height={BAR_H}>
        {/* Línea meta */}
        {meta > 0 && (
          <>
            <Line
              x1={PAD.left} y1={metaY}
              x2={svgW - PAD.right} y2={metaY}
              stroke="#4CAF5088" strokeWidth={1} strokeDasharray="5,3"
            />
            <SvgText x={svgW - PAD.right + 2} y={metaY + 4} fontSize="8" fill="#4CAF50">
              {Math.round(meta)}
            </SvgText>
          </>
        )}

        {/* Barras */}
        {horas.map((d, i) => {
          const barH  = Math.max((d.piezas / maxVal) * h, 0);
          const x     = PAD.left + i * BAR_W_PER_HOUR + gap / 2;
          const y     = PAD.top + h - barH;
          const color = d.piezas >= meta ? '#4CAF50' : d.piezas > 0 ? '#F44336' : '#263238';
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={Math.max(barH, 1)} fill={color} rx={3} />
              {d.piezas > 0 && (
                <SvgText x={x + barW / 2} y={y - 3} fontSize="8" fill={color} textAnchor="middle">
                  {d.piezas}
                </SvgText>
              )}
              <SvgText x={x + barW / 2} y={PAD.top + h + 14} fontSize="8" fill="#546E7A" textAnchor="middle">
                {d.hora}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Eje Y */}
        <SvgText x={2} y={PAD.top + 6} fontSize="8" fill="#37474F">
          {Math.round(maxVal)}
        </SvgText>
      </Svg>
    </ScrollView>
  );
}

export default function OperadorHistorialDiaScreen({ route, navigation }) {
  const { num_empleado, nombre, foto_url, linea } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await uphService.getHistorialOperadorHoy(num_empleado, linea);
      if (r.success) setData(r.data);
      setLoading(false);
    })();
  }, [num_empleado, linea]);

  const totalDia = data?.horas?.reduce((s, h) => s + h.piezas, 0) || 0;
  const meta = data?.uph_meta || 0;
  const horasConProd = data?.horas?.filter(h => h.piezas > 0).length || 0;
  const eficiencia = meta > 0 && horasConProd > 0
    ? Math.round((totalDia / (meta * horasConProd)) * 100)
    : null;

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>← Atrás</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          {/* Perfil operador */}
          <View style={s.perfilCard}>
            <Avatar op={{ nombre: nombre || data?.nombre, foto_url }} size={56} />
            <View style={s.perfilInfo}>
              <Text style={s.perfilNombre}>{nombre || data?.nombre || '—'}</Text>
              <Text style={s.perfilSub}>#{num_empleado} · {linea}</Text>
              {data?.estaciones?.length > 0 && (
                <Text style={s.perfilEsts}>
                  Estaciones: {data.estaciones.join(', ')}
                </Text>
              )}
            </View>
          </View>

          {/* Métricas resumen */}
          <View style={s.metricasRow}>
            <View style={s.metrica}>
              <Text style={s.metricaVal}>{totalDia.toLocaleString()}</Text>
              <Text style={s.metricaLabel}>Total hoy</Text>
            </View>
            <View style={s.sep} />
            <View style={s.metrica}>
              <Text style={s.metricaVal}>{meta > 0 ? Math.round(meta) : '—'}</Text>
              <Text style={s.metricaLabel}>Meta/hr</Text>
            </View>
            <View style={s.sep} />
            <View style={s.metrica}>
              <Text style={[s.metricaVal, eficiencia != null && {
                color: eficiencia >= 100 ? '#4CAF50' : eficiencia >= 80 ? '#FF9800' : '#F44336'
              }]}>
                {eficiencia != null ? `${eficiencia}%` : '—'}
              </Text>
              <Text style={s.metricaLabel}>Eficiencia</Text>
            </View>
          </View>

          {/* Gráfica */}
          <View style={s.graficaCard}>
            <Text style={s.graficaTitulo}>Producción por hora</Text>
            {loading ? (
              <ActivityIndicator color="#2196F3" style={{ marginVertical: 30 }} />
            ) : data?.horas?.length > 0 ? (
              <GraficaBarras horas={data.horas} meta={meta} />
            ) : (
              <Text style={s.sinDatos}>Sin producción registrada hoy</Text>
            )}
          </View>

          {/* Detalle por hora */}
          {!loading && data?.horas?.length > 0 && (
            <View style={s.detalleCard}>
              <Text style={s.detalleTitulo}>Detalle por hora</Text>
              {data.horas.map((h, i) => {
                const pct = meta > 0 ? Math.round((h.piezas / meta) * 100) : null;
                const color = h.piezas >= meta ? '#4CAF50' : h.piezas > 0 ? '#F44336' : '#37474F';
                return (
                  <View key={i} style={s.detalleRow}>
                    <Text style={s.detalleHora}>{h.hora}</Text>
                    <View style={s.detalleBarBg}>
                      <View style={[s.detalleBarFill, {
                        width: meta > 0 ? `${Math.min((h.piezas / meta) * 100, 100)}%` : '0%',
                        backgroundColor: color,
                      }]} />
                    </View>
                    <Text style={[s.detallePzs, { color }]}>{h.piezas}</Text>
                    {pct != null && (
                      <Text style={[s.detallePct, { color }]}>{pct}%</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  safe:      { flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingBottom: 40 },

  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  backBtn: { paddingVertical: 8, paddingRight: 16 },
  backText:{ color: '#90CAF9', fontSize: 15, fontWeight: '600' },

  perfilCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#1565C033',
  },
  perfilInfo:   { flex: 1 },
  perfilNombre: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  perfilSub:    { color: '#546E7A', fontSize: 12, marginTop: 2 },
  perfilEsts:   { color: '#42A5F5', fontSize: 11, marginTop: 3 },

  metricasRow: {
    flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 12,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1565C033',
    justifyContent: 'space-around',
  },
  metrica:      { alignItems: 'center', flex: 1 },
  metricaVal:   { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  metricaLabel: { color: '#546E7A', fontSize: 11, marginTop: 2 },
  sep:          { width: 1, backgroundColor: '#1E3A5F', marginVertical: 4 },

  graficaCard: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#1565C033',
  },
  graficaTitulo: { color: '#90CAF9', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  sinDatos:      { color: '#37474F', fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  detalleCard: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1565C033',
  },
  detalleTitulo: { color: '#90CAF9', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  detalleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detalleHora:   { color: '#546E7A', fontSize: 11, width: 36 },
  detalleBarBg:  { flex: 1, height: 6, backgroundColor: '#0D1B2A', borderRadius: 3, overflow: 'hidden' },
  detalleBarFill:{ height: 6, borderRadius: 3 },
  detallePzs:    { fontSize: 12, fontWeight: 'bold', width: 28, textAlign: 'right' },
  detallePct:    { fontSize: 10, width: 32, textAlign: 'right' },
});
