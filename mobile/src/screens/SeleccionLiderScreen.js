import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, Text, Image,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { showAlert } from '../utils/alertUtils';
import { uphService } from '../services/UPHService';
import { useLiderPerfil } from '../contexts/LiderPerfilContext';
import { API_BASE_URL } from '../utils/apiClient';

const COLS = 3;

function n2(nombre) {
  const p = (nombre || '').trim().split(' ');
  if (p.length >= 3) return p[0] + ' ' + p[2];
  return p.slice(0, 2).join(' ');
}

function ini(nombre) {
  return (nombre || '?').trim().split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
}

// Colores para avatars por iniciales
const AVATAR_COLORS = [
  '#1565C0', '#6A1B9A', '#1B5E20', '#BF360C',
  '#00695C', '#4527A0', '#880E4F', '#E65100',
];

function getColor(num_empleado) {
  const n = parseInt(num_empleado) || 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function AvatarCard({ lider, size, ocupado }) {
  const [err, setErr] = useState(false);
  const color = getColor(lider.num_empleado);
  const uri = lider.foto_url
    ? (lider.foto_url.startsWith('http') ? lider.foto_url : `${API_BASE_URL}${lider.foto_url}`)
    : null;

  return (
    <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      {uri && !err ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setErr(true)}
        />
      ) : (
        <View style={[av.fallback, { backgroundColor: color + '33' }]}>
          <Text style={[av.ini, { fontSize: size * 0.32 }]}>{ini(lider.nombre)}</Text>
        </View>
      )}
      {ocupado && (
        <View style={av.ocupadoOverlay}>
          <Text style={av.ocupadoIcon}>🔒</Text>
        </View>
      )}
    </View>
  );
}

const av = StyleSheet.create({
  wrap:          { borderWidth: 2, overflow: 'hidden' },
  fallback:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ini:           { color: '#fff', fontWeight: 'bold' },
  ocupadoOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: '#00000088',
                   justifyContent: 'center', alignItems: 'center' },
  ocupadoIcon:   { fontSize: 22 },
});

export default function SeleccionLiderScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const { seleccionarLider, sessionId } = useLiderPerfil();

  const [lideres,   setLideres]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [claiming,  setClaiming]  = useState(null);

  const CARD_W = (width - 48) / COLS;
  const AVATAR = CARD_W - 24;

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await uphService.getLideresLista();
    if (r.success) setLideres(r.data.lideres || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSelect = async (lider) => {
    if (lider.ocupado && lider.session_id !== sessionId) {
      showAlert('Perfil ocupado', 'Este perfil ya está siendo usado en otro dispositivo.');
      return;
    }
    showAlert(
      '¿Eres tú?',
      `${n2(lider.nombre)}\n${lider.linea}`,
      [
        { text: 'No soy yo', style: 'cancel' },
        {
          text: 'Sí, continuar',
          onPress: async () => {
            setClaiming(lider.num_empleado);
            const r = await seleccionarLider(lider);
            setClaiming(null);
            if (r.success) {
              navigation.replace('LiderTabs');
            } else {
              showAlert('Error', r.error || 'No se pudo seleccionar el perfil');
              cargar();
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const esPropio = item.session_id === sessionId;
    const bloqueado = item.ocupado && !esPropio;
    return (
      <TouchableOpacity
        style={[c.card, { width: CARD_W }, bloqueado && c.cardBloqueada]}
        onPress={() => handleSelect(item)}
        activeOpacity={bloqueado ? 0.5 : 0.75}
        disabled={claiming !== null}
      >
        {claiming === item.num_empleado ? (
          <View style={[av.wrap, { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
                        borderColor: '#2196F3', borderWidth: 2, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator color="#2196F3" />
          </View>
        ) : (
          <AvatarCard lider={item} size={AVATAR} ocupado={bloqueado} />
        )}
        <Text style={[c.nombre, bloqueado && c.nombreBloqueado]} numberOfLines={2}>
          {n2(item.nombre)}
        </Text>
        {esPropio && <Text style={c.tuBadge}>✓ Tú</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={c.container}>
      <LinearGradient colors={['#050E1A', '#0A0A0A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={c.safe} edges={['top', 'bottom']}>

        <View style={c.header}>
          <Text style={c.titulo}>¿Quién eres?</Text>
          <Text style={c.subtitulo}>Selecciona tu perfil para continuar</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={lideres}
            keyExtractor={i => i.num_empleado}
            numColumns={COLS}
            contentContainerStyle={c.grid}
            columnWrapperStyle={c.row}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const c = StyleSheet.create({
  container: { flex: 1 },
  safe:      { flex: 1 },

  header:    { alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
  titulo:    { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitulo: { color: '#546E7A', fontSize: 13, marginTop: 4 },

  grid: { paddingHorizontal: 16, paddingBottom: 40 },
  row:  { justifyContent: 'space-between', marginBottom: 8 },

  card: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4,
    borderRadius: 14, marginBottom: 4,
  },
  cardBloqueada: { opacity: 0.45 },

  nombre:         { color: '#cfd8e3', fontSize: 11, fontWeight: '700', marginTop: 8,
                    textAlign: 'center', lineHeight: 14 },
  nombreBloqueado:{ color: '#37474F' },
  linea:          { color: '#42A5F5', fontSize: 10, marginTop: 3, fontWeight: '600' },
  tuBadge:        { color: '#4CAF50', fontSize: 10, fontWeight: '800', marginTop: 3 },
});
