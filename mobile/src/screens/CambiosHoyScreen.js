import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, IconButton, Chip, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { cambiosHoyService } from '../services/CambiosHoyService';

const STATUS_COLOR = {
  Done: '#4CAF50',
  Pending: '#FF9800',
  'Re-write': '#F44336',
  'Write In': '#2196F3',
};

export default function CambiosHoyScreen() {
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState(null);
  const [filtro, setFiltro] = useState('Todos');
  const [expandido, setExpandido] = useState({});

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitas permitir acceso a la galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    // En web, base64 puede ser null — usar uri (data URL) directamente
    const imagen = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    if (!imagen) { Alert.alert('Error', 'No se pudo leer la imagen.'); return; }
    analizar(imagen);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitas permitir acceso a la camara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    analizar(`data:image/jpeg;base64,${asset.base64}`);
  };

  const analizar = async (base64) => {
    setCargando(true);
    setDatos(null);
    try {
      const res = await cambiosHoyService.analizar(base64);
      setDatos(res.data);
      setFiltro('Todos');
      setExpandido({});
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Error al analizar';
      Alert.alert('Error', msg);
    } finally {
      setCargando(false);
    }
  };

  const toggleExpandido = (idx) => {
    setExpandido((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const lineasFiltradas = () => {
    if (!datos?.lineas) return [];
    if (filtro === 'Todos') return datos.lineas;
    if (filtro === 'Nuevos') return datos.lineas.filter((l) => l.is_new);
    if (filtro === 'Problemas') return datos.lineas.filter((l) => l.has_issue);
    return datos.lineas.filter((l) => l.status === filtro);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#0D0D0D', '#1A1A1A']} style={s.bg} />
      <ScrollView contentContainerStyle={s.scroll}>

        <Text style={s.titulo}>Cambios de Hoy</Text>
        {datos?.fecha && <Text style={s.fecha}>{datos.fecha}</Text>}

        {/* Botones subir imagen */}
        <View style={s.botonesRow}>
          <TouchableOpacity style={s.botonImagen} onPress={pickImage} activeOpacity={0.8}>
            <LinearGradient colors={['#1565C0', '#0D47A1']} style={s.botonGrad}>
              <IconButton icon="image-plus" size={28} iconColor="#fff" style={s.botonIcon} />
              <Text style={s.botonTxt}>Galeria</Text>
            </LinearGradient>
          </TouchableOpacity>
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={s.botonImagen} onPress={takePhoto} activeOpacity={0.8}>
              <LinearGradient colors={['#00838F', '#006064']} style={s.botonGrad}>
                <IconButton icon="camera" size={28} iconColor="#fff" style={s.botonIcon} />
                <Text style={s.botonTxt}>Camara</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.hint}>Sube una foto de la pantalla del MES con el plan del dia</Text>

        {cargando && (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={s.loadingTxt}>Analizando con IA...</Text>
          </View>
        )}

        {datos && !cargando && (
          <>
            {/* Filtros */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosRow}>
              {['Todos', 'Nuevos', 'Problemas', 'Done', 'Pending', 'Re-write', 'Write In'].map((f) => (
                <Chip
                  key={f}
                  selected={filtro === f}
                  onPress={() => setFiltro(f)}
                  style={[s.chip, filtro === f && s.chipSelected]}
                  textStyle={{ color: filtro === f ? '#fff' : '#aaa', fontSize: 12 }}
                >
                  {f}
                </Chip>
              ))}
            </ScrollView>

            <Text style={s.resumen}>
              {lineasFiltradas().length} lineas · {datos.lineas?.filter((l) => l.is_new).length} nuevas · {datos.lineas?.filter((l) => l.has_issue).length} con problema
            </Text>

            {/* Cards por linea */}
            {lineasFiltradas().map((linea, idx) => (
              <View key={idx} style={[
                s.card,
                linea.is_new && s.cardNuevo,
                linea.has_issue && s.cardProblema,
              ]}>
                {/* Header */}
                <TouchableOpacity onPress={() => toggleExpandido(idx)} activeOpacity={0.8}>
                  <View style={s.cardHeader}>
                    <View style={s.cardHeaderLeft}>
                      <Text style={s.cardLinea}>{linea.linea ?? '—'}</Text>
                      {linea.is_new && <View style={s.badgeNuevo}><Text style={s.badgeTxt}>NUEVO</Text></View>}
                      {linea.has_issue && <View style={s.badgeProblema}><Text style={s.badgeTxt}>!</Text></View>}
                    </View>
                    <View style={s.cardHeaderRight}>
                      {linea.status && (
                        <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[linea.status] || '#666' }]}>
                          <Text style={s.statusTxt}>{linea.status}</Text>
                        </View>
                      )}
                      <IconButton
                        icon={expandido[idx] ? 'chevron-up' : 'chevron-down'}
                        size={20} iconColor="#aaa" style={{ margin: 0 }}
                      />
                    </View>
                  </View>
                  <Text style={s.cardRolling}>{linea.rolling ?? '—'} · {linea.internal_model ?? '—'}</Text>
                  <Text style={s.cardMercado}>{linea.market_country ?? '—'} · UPH: {linea.uph ?? '—'}</Text>
                </TouchableOpacity>

                {/* Detalle expandido */}
                {expandido[idx] && (
                  <>
                    <Divider style={s.divider} />
                    <View style={s.detalle}>
                      {[
                        ['Model', linea.model],
                        ['SW Version', linea.sw_version],
                        ['Project ID', linea.project_id],
                        ['Keys', linea.keys],
                        ['LCD Interface', linea.lcd_interface],
                        ['Tool', linea.tool],
                        ['Tool SW', linea.tool_sw],
                        ['Converter', linea.converter],
                        ['MIC', linea.mic],
                      ].map(([label, valor]) => (
                        <View key={label} style={s.detalleRow}>
                          <Text style={s.detalleLabel}>{label}</Text>
                          <Text style={s.detalleVal}>{valor ?? '—'}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  bg: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  scroll: { padding: 16, paddingBottom: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  fecha: { fontSize: 13, color: '#888', marginBottom: 16 },
  botonesRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  botonImagen: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  botonGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  botonIcon: { margin: 0 },
  botonTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hint: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 20 },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  loadingTxt: { color: '#888', marginTop: 12, fontSize: 14 },
  filtrosRow: { marginBottom: 10 },
  chip: { marginRight: 8, backgroundColor: '#222' },
  chipSelected: { backgroundColor: '#1565C0' },
  resumen: { fontSize: 12, color: '#666', marginBottom: 14 },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    marginBottom: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#333',
  },
  cardNuevo: { borderLeftColor: '#FF9800' },
  cardProblema: { borderLeftColor: '#F44336' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  cardLinea: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  cardRolling: { fontSize: 13, color: '#bbb', marginBottom: 2 },
  cardMercado: { fontSize: 13, color: '#888' },
  badgeNuevo: { backgroundColor: '#FF9800', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeProblema: { backgroundColor: '#F44336', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  divider: { backgroundColor: '#333', marginVertical: 10 },
  detalle: { gap: 6 },
  detalleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detalleLabel: { fontSize: 12, color: '#666', flex: 1 },
  detalleVal: { fontSize: 12, color: '#ccc', flex: 2, textAlign: 'right' },
});
