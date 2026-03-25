import React, { useState, useMemo } from 'react';
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

  /* Agrupar lineas por nombre de linea */
  const porLinea = useMemo(() => {
    if (!datos?.lineas) return [];
    let lista = datos.lineas;
    if (filtro === 'Nuevos') lista = lista.filter((l) => l.is_new);
    else if (filtro === 'Problemas') lista = lista.filter((l) => l.has_issue);
    else if (filtro !== 'Todos') lista = lista.filter((l) => l.status === filtro);

    const mapa = {};
    lista.forEach((item) => {
      const key = item.linea ?? 'Sin linea';
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(item);
    });
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b));
  }, [datos, filtro]);

  const uriToBase64 = async (uri) => {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitas permitir acceso a la galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    let imagen;
    if (asset.base64) {
      imagen = `data:image/jpeg;base64,${asset.base64}`;
    } else {
      imagen = await uriToBase64(asset.uri);
    }
    if (!imagen) { Alert.alert('Error', 'No se pudo leer la imagen.'); return; }
    analizar(imagen);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitas permitir acceso a la camara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9, base64: true });
    if (result.canceled) return;
    analizar(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const analizar = async (base64) => {
    setCargando(true);
    setDatos(null);
    try {
      const res = await cambiosHoyService.analizar(base64);
      setDatos(res.data);
      setFiltro('Todos');
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : detail ? JSON.stringify(detail) : (e?.message || 'Error al analizar');
      Alert.alert('Error ' + (e?.response?.status || ''), msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#0D0D0D', '#1A1A1A']} style={s.bg} />
      <ScrollView contentContainerStyle={s.scroll}>

        <Text style={s.titulo}>Cambios de Hoy</Text>
        {datos?.fecha && <Text style={s.fecha}>{datos.fecha}</Text>}

        {/* Botones */}
        <View style={s.botonesRow}>
          <TouchableOpacity style={s.botonImagen} onPress={pickImage} activeOpacity={0.8}>
            <LinearGradient colors={['#1565C0', '#0D47A1']} style={s.botonGrad}>
              <IconButton icon="image-plus" size={24} iconColor="#fff" style={s.botonIcon} />
              <Text style={s.botonTxt}>Galeria</Text>
            </LinearGradient>
          </TouchableOpacity>
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={s.botonImagen} onPress={takePhoto} activeOpacity={0.8}>
              <LinearGradient colors={['#00838F', '#006064']} style={s.botonGrad}>
                <IconButton icon="camera" size={24} iconColor="#fff" style={s.botonIcon} />
                <Text style={s.botonTxt}>Camara</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.hint}>Sube una foto del MES con el plan del dia</Text>

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
              {datos.lineas?.length} modelos · {datos.lineas?.filter((l) => l.is_new).length} nuevos · {datos.lineas?.filter((l) => l.has_issue).length} con problema
            </Text>

            {/* Sección por linea */}
            {porLinea.map(([nombreLinea, modelos]) => (
              <View key={nombreLinea} style={s.lineaSection}>
                {/* Header de linea */}
                <LinearGradient colors={['#1A2A3A', '#0D1A26']} style={s.lineaHeader}>
                  <Text style={s.lineaNombre}>{nombreLinea}</Text>
                  <Text style={s.lineaCount}>{modelos.length} modelo{modelos.length !== 1 ? 's' : ''}</Text>
                </LinearGradient>

                {/* Modelos de esa linea */}
                {modelos.map((m, idx) => (
                  <View key={idx} style={[
                    s.modeloCard,
                    m.is_new && s.modeloNuevo,
                    m.has_issue && s.modeloProblema,
                  ]}>
                    {/* Fila top: rolling + internal model + badges + status */}
                    <View style={s.modeloTop}>
                      <View style={s.modeloTopLeft}>
                        <Text style={s.rolling}>{m.rolling ?? '—'}</Text>
                        <Text style={s.internalModel}>{m.internal_model ?? '—'}</Text>
                      </View>
                      <View style={s.modeloTopRight}>
                        {m.is_new && <View style={s.badgeNuevo}><Text style={s.badgeTxt}>NUEVO</Text></View>}
                        {m.has_issue && <View style={s.badgeProblema}><Text style={s.badgeTxt}>!</Text></View>}
                        {m.status && (
                          <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[m.status] || '#555' }]}>
                            <Text style={s.statusTxt}>{m.status}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Board/Model */}
                    <Text style={s.modelBoard}>{m.model ?? '—'}</Text>

                    <Divider style={s.divider} />

                    {/* Grid de campos */}
                    <View style={s.grid}>
                      <Campo label="Mercado" valor={m.market_country} />
                      <Campo label="UPH" valor={m.uph} />
                      <Campo label="SW Version" valor={m.sw_version} />
                      <Campo label="Project ID" valor={m.project_id} />
                      <Campo label="Keys" valor={m.keys} />
                      <Campo label="LCD Interface" valor={m.lcd_interface} />
                      <Campo label="Tool" valor={m.tool} />
                      <Campo label="Tool SW" valor={m.tool_sw} />
                      <Campo label="Converter" valor={m.converter} />
                      <Campo label="MIC" valor={m.mic} />
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Campo({ label, valor }) {
  return (
    <View style={s.campoWrap}>
      <Text style={s.campoLabel}>{label}</Text>
      <Text style={s.campoVal} numberOfLines={2}>{valor != null ? String(valor) : '—'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  bg: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  scroll: { padding: 16, paddingBottom: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  fecha: { fontSize: 13, color: '#888', marginBottom: 16 },
  botonesRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  botonImagen: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  botonGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  botonIcon: { margin: 0 },
  botonTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  hint: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 20 },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  loadingTxt: { color: '#888', marginTop: 12, fontSize: 14 },
  filtrosRow: { marginBottom: 10 },
  chip: { marginRight: 8, backgroundColor: '#222' },
  chipSelected: { backgroundColor: '#1565C0' },
  resumen: { fontSize: 12, color: '#666', marginBottom: 14 },

  /* Sección por linea */
  lineaSection: { marginBottom: 20 },
  lineaHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, marginBottom: 8,
    borderLeftWidth: 4, borderLeftColor: '#4FC3F7',
  },
  lineaNombre: { fontSize: 20, fontWeight: 'bold', color: '#4FC3F7' },
  lineaCount: { fontSize: 12, color: '#666' },

  /* Card de modelo */
  modeloCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#2A2A2A',
  },
  modeloNuevo: { borderLeftColor: '#FF9800', backgroundColor: '#1E1A0F' },
  modeloProblema: { borderLeftColor: '#F44336', backgroundColor: '#1E0F0F' },

  modeloTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  modeloTopLeft: { flex: 1 },
  modeloTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },

  rolling: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  internalModel: { fontSize: 13, color: '#aaa', marginTop: 1 },
  modelBoard: { fontSize: 12, color: '#4FC3F7', marginBottom: 8 },

  badgeNuevo: { backgroundColor: '#FF9800', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeProblema: { backgroundColor: '#F44336', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  divider: { backgroundColor: '#2A2A2A', marginBottom: 10 },

  /* Grid de campos 2 columnas */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  campoWrap: { width: '47%', backgroundColor: '#252525', borderRadius: 8, padding: 8 },
  campoLabel: { fontSize: 10, color: '#666', marginBottom: 2, textTransform: 'uppercase' },
  campoVal: { fontSize: 12, color: '#ddd', fontWeight: '500' },
});
