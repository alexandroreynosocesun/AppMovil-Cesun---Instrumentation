import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  TextInput,
  ActivityIndicator,
  Chip,
  Divider,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { hstvtService } from '../services/HStVtService';

// Extrae la familia (primer número antes del primer guión)
function getFamily(filename) {
  return filename.split('-')[0];
}

// Parsea el nombre del archivo en partes
function parseScript(filename) {
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
    nombre: noExt,
  };
}

export default function SearchHStVtScreen() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [familiaFiltro, setFamiliaFiltro] = useState(null);
  const [familias, setFamilias] = useState([]);

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    setLoading(true);
    const result = await hstvtService.getScripts();
    if (result.success) {
      const lista = result.data.scripts || [];
      setScripts(lista);
      // Familias únicas ordenadas
      const fams = [...new Set(lista.map(getFamily))].sort();
      setFamilias(fams);
    } else {
      setError('No se pudo conectar al servidor de scripts');
    }
    setLoading(false);
  };

  const filtered = scripts.filter(s => {
    const matchFamilia = familiaFiltro ? getFamily(s) === familiaFiltro : true;
    const matchSearch = search.trim()
      ? s.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchFamilia && matchSearch;
  });

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

        {/* Filtros de familia */}
        <View style={styles.chipsContainer}>
          <TouchableOpacity onPress={() => setFamiliaFiltro(null)}>
            <Chip
              style={[styles.chip, !familiaFiltro && styles.chipActive]}
              textStyle={styles.chipText}
            >
              Todos
            </Chip>
          </TouchableOpacity>
          <FlatList
            data={familias}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={f => f}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setFamiliaFiltro(item === familiaFiltro ? null : item)}>
                <Chip
                  style={[styles.chip, familiaFiltro === item && styles.chipActive]}
                  textStyle={styles.chipText}
                >
                  {item}
                </Chip>
              </TouchableOpacity>
            )}
          />
        </View>

        <Text style={styles.count}>{filtered.length} scripts</Text>
        <Divider style={styles.divider} />

        {loading ? (
          <ActivityIndicator color="#2196F3" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => `${item}-${i}`}
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
  searchInput: {
    backgroundColor: '#1A1A1A',
    marginBottom: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  chip: {
    backgroundColor: '#1E1E1E',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  chipActive: {
    backgroundColor: '#1A237E',
    borderColor: '#2196F3',
  },
  chipText: { color: '#FFF', fontSize: 12 },
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  familia: { color: '#2196F3', fontWeight: 'bold', fontSize: 13, marginRight: 8 },
  externoBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  externoText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  modelo: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { color: '#888', fontSize: 12 },
  value: { color: '#DDD', fontSize: 12 },
  modeloExterno: { color: '#FF9800', fontSize: 12, marginTop: 4 },
  error: { color: '#F44336', textAlign: 'center', marginTop: 40 },
});
