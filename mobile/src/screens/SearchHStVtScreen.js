import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView, TouchableOpacity, Modal, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, ActivityIndicator, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { hstvtService } from '../services/HStVtService';
import { useAuth } from '../contexts/AuthContext';
import { showAlert } from '../utils/alertUtils';

function getFamily(item) {
  const name = typeof item === 'string' ? item : item.nombre;
  return name.split('-')[0].replace(/\.HStvt$/i, '');
}

function getName(item) {
  return typeof item === 'string' ? item : item.nombre;
}

function naturalCompare(a, b) {
  const re = /(\d+)|(\D+)/g;
  const pa = a.match(re) || [];
  const pb = b.match(re) || [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = parseInt(pa[i], 10);
    const nb = parseInt(pb[i], 10);
    if (!isNaN(na) && !isNaN(nb)) {
      if (na !== nb) return na - nb;
    } else {
      const cmp = pa[i].localeCompare(pb[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

function getFecha(item) {
  return typeof item === 'object' && item.fecha ? item.fecha : 0;
}

const PINS_RE = /^\d+(\+\d+)?p$/i;
const MIC_RE = /^MIC/i;

function parseScript(item) {
  const filename = getName(item);
  const noExt = filename.replace(/\.HStvt$/i, '');
  const isExterno = noExt.toUpperCase().includes('EXTERNO');
  const parts = noExt.split('-');

  const pins = parts.find(p => PINS_RE.test(p)) || null;
  const mic  = parts.find(p => MIC_RE.test(p))  || null;
  const cleanParts = parts.filter(p => !PINS_RE.test(p) && !MIC_RE.test(p));
  const cleanNoExt = cleanParts.join('-');

  return {
    familia: cleanParts[0] || '',
    modelo:  cleanParts[1] || '',
    version: cleanParts[2] || '',
    destino: isExterno
      ? cleanNoExt.split(' ')[0].split('-').slice(3).join('-')
      : cleanParts.slice(3).join('-'),
    externo: isExterno,
    modeloExterno: isExterno ? noExt.split('EXTERNO')[1]?.trim() : null,
    fecha: getFecha(item),
    pins,
    mic,
  };
}

const SORT_OPTIONS = [
  { key: 'az',     label: 'A → Z',     icon: '↑' },
  { key: 'za',     label: 'Z → A',     icon: '↓' },
  { key: 'nuevo',  label: 'Más reciente', icon: '🕐' },
  { key: 'antiguo',label: 'Más antiguo',  icon: '🕓' },
];

export default function SearchHStVtScreen() {
  const { user, logout } = useAuth();
  const role = user?.tipo_usuario;
  const showLogout = role === 'lider_linea' || role === 'balances';

  const handleLogout = () => {
    showAlert('Cerrar sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [familiaFiltro, setFamiliaFiltro] = useState(null);
  const [familias, setFamilias] = useState([]);
  const [sortKey, setSortKey] = useState('nuevo');
  const [selectedScript, setSelectedScript] = useState(null);

  const handleShare = (p, filename) => {
    const lines = [
      `[ Script HStVt ]`,
      ``,
      `Familia   ${p.familia}`,
      `Modelo    ${p.modelo}`,
      `Versión   ${p.version}`,
      `Destino   ${p.destino || '—'}`,
    ];
    if (p.pins) lines.push(`Pines     ${p.pins}`);
    if (p.mic)  lines.push(`Mic       ${p.mic}`);
    if (p.externo && p.modeloExterno) lines.push(`Externo   ${p.modeloExterno}`);
    if (p.fecha) lines.push(``, `📅  ${formatFecha(p.fecha)}`);
    lines.push(``, `📁  ${filename}`);
    Share.share({ message: lines.join('\n') });
  };

  useEffect(() => { loadScripts(); }, []);

  const loadScripts = async () => {
    setLoading(true);
    const result = await hstvtService.getScripts();
    if (result.success) {
      const lista = result.data.scripts || [];
      setScripts(lista);
      const fams = [...new Set(lista.map(getFamily))].sort();
      setFamilias(fams);
    } else {
      setError('No se pudo conectar al servidor de scripts');
    }
    setLoading(false);
  };

  const filtered = scripts
    .filter(s => {
      const name = getName(s);
      const matchFamilia = familiaFiltro ? getFamily(s) === familiaFiltro : true;
      const matchSearch = search.trim() ? name.toLowerCase().includes(search.toLowerCase()) : true;
      return matchFamilia && matchSearch;
    })
    .sort((a, b) => {
      const na = getName(a).toLowerCase();
      const nb = getName(b).toLowerCase();
      if (sortKey === 'az') return naturalCompare(na, nb);
      if (sortKey === 'za') return naturalCompare(nb, na);
      if (sortKey === 'nuevo') return getFecha(b) - getFecha(a);
      if (sortKey === 'antiguo') return getFecha(a) - getFecha(b);
      return 0;
    });

  const formatFecha = (ts) => {
    if (!ts) return null;
    const d = new Date(ts * 1000);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  };

  const renderItem = ({ item }) => {
    const p = parseScript(item);
    const filename = getName(item);
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedScript({ p, filename })} activeOpacity={0.75}>
        <View style={styles.cardHeader}>
          <Text style={styles.familia}>{p.familia}</Text>
          {p.externo && (
            <View style={styles.externoBadge}>
              <Text style={styles.externoText}>EXTERNO</Text>
            </View>
          )}
          {p.fecha ? (
            <Text style={styles.fecha}>{formatFecha(p.fecha)}</Text>
          ) : null}
        </View>
        <Text style={styles.modelo}>{p.modelo}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Versión: </Text>
          <Text style={styles.value}>{p.version}</Text>
          <Text style={[styles.label, { marginLeft: 12 }]}>Destino: </Text>
          <Text style={styles.value}>{p.destino || '—'}</Text>
          {p.pins && <View style={styles.pinsBadge}><Text style={styles.pinsText}>{p.pins}</Text></View>}
          {p.mic  && <View style={styles.micBadge}><Text style={styles.micText}>{p.mic}</Text></View>}
        </View>
        {p.externo && p.modeloExterno && (
          <Text style={styles.modeloExterno}>Externo: {p.modeloExterno}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A237E', '#0F0F0F']} style={styles.gradient} />
      <SafeAreaView style={styles.safe}>

        {showLogout && (
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Búsqueda */}
        <TextInput
          mode="outlined"
          placeholder="Buscar modelo..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          outlineColor="#333"
          activeOutlineColor="#2196F3"
          textColor="#FFF"
          theme={{ colors: { onSurfaceVariant: '#AAA' } }}
          left={<TextInput.Icon icon="magnify" color="#AAA" />}
          right={search ? <TextInput.Icon icon="close" color="#AAA" onPress={() => setSearch('')} /> : null}
        />

        {/* Ordenar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={styles.rowContent}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortBtn, sortKey === opt.key && styles.sortBtnActive]}
              onPress={() => setSortKey(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortText, sortKey === opt.key && styles.sortTextActive]}>
                {opt.icon} {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtros de familia */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.familiaRow} contentContainerStyle={styles.rowContent}>
          <TouchableOpacity
            style={[styles.familiaBtn, !familiaFiltro && styles.familiaBtnActive]}
            onPress={() => setFamiliaFiltro(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.familiaText, !familiaFiltro && styles.familiaTextActive]}>Todos</Text>
          </TouchableOpacity>
          {familias.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.familiaBtn, familiaFiltro === f && styles.familiaBtnActive]}
              onPress={() => setFamiliaFiltro(familiaFiltro === f ? null : f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.familiaText, familiaFiltro === f && styles.familiaTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.count}>{filtered.length} scripts</Text>
        <Divider style={styles.divider} />

        {loading ? (
          <ActivityIndicator color="#2196F3" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => `${getName(item)}-${i}`}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}
      </SafeAreaView>

      {/* Modal detalle */}
      <Modal
        visible={!!selectedScript}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedScript(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedScript(null)}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            {selectedScript && (() => {
              const { p, filename } = selectedScript;
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalFamilia}>{p.familia}</Text>
                    {p.externo && (
                      <View style={styles.externoBadge}>
                        <Text style={styles.externoText}>EXTERNO</Text>
                      </View>
                    )}
                    {p.fecha && <Text style={styles.modalFecha}>{formatFecha(p.fecha)}</Text>}
                  </View>

                  <Text style={styles.modalModelo}>{p.modelo}</Text>

                  <Divider style={{ backgroundColor: '#333', marginVertical: 12 }} />

                  <DetailRow label="Versión"  value={p.version} />
                  <DetailRow label="Destino"  value={p.destino || '—'} />
                  {p.pins && <DetailRow label="Pines" value={p.pins} highlight />}
                  {p.mic  && <DetailRow label="Micrófono" value={p.mic} highlight />}
                  {p.externo && p.modeloExterno && (
                    <DetailRow label="Modelo externo" value={p.modeloExterno} orange />
                  )}

                  <Divider style={{ backgroundColor: '#333', marginVertical: 12 }} />

                  <Text style={styles.modalFilename}>{filename}</Text>

                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleShare(p, filename)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.shareBtnText}>Compartir</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, highlight, orange }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: '#90CAF9' }, orange && { color: '#FF9800' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 200 },
  safe: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  searchInput: { backgroundColor: '#1A1A1A', marginBottom: 8 },

  sortRow: { marginBottom: 8, flexGrow: 0, flexShrink: 0 },
  familiaRow: { marginBottom: 8, flexGrow: 0, flexShrink: 0 },
  rowContent: { alignItems: 'center', paddingVertical: 2 },
  sortBtn: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#1E1E1E',
    height: 32,
    justifyContent: 'center',
  },
  sortBtnActive: { backgroundColor: '#0D47A1', borderColor: '#2196F3' },
  sortText: { color: '#AAA', fontSize: 12 },
  sortTextActive: { color: '#FFF', fontWeight: 'bold' },
  familiaBtn: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
    backgroundColor: '#1E1E1E',
    height: 30,
    justifyContent: 'center',
  },
  familiaBtnActive: { backgroundColor: '#1A237E', borderColor: '#2196F3' },
  familiaText: { color: '#AAA', fontSize: 12 },
  familiaTextActive: { color: '#FFF', fontWeight: 'bold' },

  count: { color: '#888', fontSize: 12, marginBottom: 4 },
  divider: { backgroundColor: '#333', marginBottom: 8 },
  list: { paddingBottom: 20 },

  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap', gap: 6 },
  familia: { color: '#2196F3', fontWeight: 'bold', fontSize: 13 },
  externoBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  externoText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  fecha: { color: '#666', fontSize: 11, marginLeft: 'auto' },
  modelo: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  label: { color: '#888', fontSize: 12 },
  value: { color: '#DDD', fontSize: 12 },
  modeloExterno: { color: '#FF9800', fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  modalFamilia: { color: '#2196F3', fontWeight: 'bold', fontSize: 15 },
  modalFecha: { color: '#666', fontSize: 12, marginLeft: 'auto' },
  modalModelo: { color: '#FFF', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  modalFilename: { color: '#555', fontSize: 11, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { color: '#888', fontSize: 14 },
  detailValue: { color: '#DDD', fontSize: 14, fontWeight: '600' },
  shareBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  pinsBadge: { backgroundColor: '#1E3A5F', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 8 },
  pinsText: { color: '#90CAF9', fontSize: 10, fontWeight: 'bold' },
  micBadge: { backgroundColor: '#1B3A2F', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 },
  micText: { color: '#80CBC4', fontSize: 10, fontWeight: 'bold' },
  error: { color: '#F44336', textAlign: 'center', marginTop: 40 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topBtns: { flexDirection: 'row', alignItems: 'center' },
  modelosBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  modelosBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  logoutBtn: {
    backgroundColor: '#B71C1C',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  logoutText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
});
