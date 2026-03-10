import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, ActivityIndicator, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { hstvtService } from '../services/HStVtService';

function getFamily(item) {
  const name = typeof item === 'string' ? item : item.nombre;
  return name.split('-')[0];
}

function getName(item) {
  return typeof item === 'string' ? item : item.nombre;
}

function getFecha(item) {
  return typeof item === 'object' && item.fecha ? item.fecha : 0;
}

function parseScript(item) {
  const filename = getName(item);
  const noExt = filename.replace(/\.HStvt$/i, '');
  const isExterno = noExt.toUpperCase().includes('EXTERNO');
  const parts = noExt.split('-');
  return {
    familia: parts[0] || '',
    modelo: parts[1] || '',
    version: parts[2] || '',
    destino: isExterno
      ? noExt.split(' ')[0].split('-').slice(3).join('-')
      : parts.slice(3).join('-'),
    externo: isExterno,
    modeloExterno: isExterno ? noExt.split('EXTERNO')[1]?.trim() : null,
    fecha: getFecha(item),
  };
}

const SORT_OPTIONS = [
  { key: 'az',     label: 'A → Z',     icon: '↑' },
  { key: 'za',     label: 'Z → A',     icon: '↓' },
  { key: 'nuevo',  label: 'Más reciente', icon: '🕐' },
  { key: 'antiguo',label: 'Más antiguo',  icon: '🕓' },
];

export default function SearchHStVtScreen() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [familiaFiltro, setFamiliaFiltro] = useState(null);
  const [familias, setFamilias] = useState([]);
  const [sortKey, setSortKey] = useState('nuevo');

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
      if (sortKey === 'az') return na.localeCompare(nb);
      if (sortKey === 'za') return nb.localeCompare(na);
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
    return (
      <View style={styles.card}>
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
        </View>
        {p.externo && p.modeloExterno && (
          <Text style={styles.modeloExterno}>Externo: {p.modeloExterno}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A237E', '#0F0F0F']} style={styles.gradient} />
      <SafeAreaView style={styles.safe}>

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.familiaRow}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 200 },
  safe: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  searchInput: { backgroundColor: '#1A1A1A', marginBottom: 8 },

  sortRow: { marginBottom: 8 },
  sortBtn: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#1E1E1E',
  },
  sortBtnActive: { backgroundColor: '#0D47A1', borderColor: '#2196F3' },
  sortText: { color: '#AAA', fontSize: 12 },
  sortTextActive: { color: '#FFF', fontWeight: 'bold' },

  familiaRow: { marginBottom: 8 },
  familiaBtn: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
    backgroundColor: '#1E1E1E',
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
  error: { color: '#F44336', textAlign: 'center', marginTop: 40 },
});
