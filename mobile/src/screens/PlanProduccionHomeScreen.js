import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

const OPCIONES = [
  {
    id: 'cambios',
    title: 'Cambios de Hoy',
    subtitle: 'Analiza el plan de produccion con IA',
    icon: 'image-search',
    colors: ['#1565C0', '#0D47A1'],
    route: 'CambiosHoy',
  },
  {
    id: 'search',
    title: 'Search Model',
    subtitle: 'Busca HS/VT por modelo o numero de parte',
    icon: 'magnify',
    colors: ['#00838F', '#006064'],
    route: 'SearchHStVt',
  },
  {
    id: 'change',
    title: 'Change Model',
    subtitle: 'Busca y cambia mainboard del modelo',
    icon: 'swap-horizontal',
    colors: ['#6A1B9A', '#4A148C'],
    route: 'SearchMainboard',
  },
];

export default function PlanProduccionHomeScreen({ navigation }) {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#0D0D0D', '#1A1A1A']} style={s.bg} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.titulo}>Plan Produccion</Text>
        <Text style={s.subtitulo}>Selecciona una herramienta</Text>

        {OPCIONES.map((op) => (
          <TouchableOpacity
            key={op.id}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(op.route)}
            style={s.cardWrap}
          >
            <LinearGradient colors={op.colors} style={s.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <IconButton icon={op.icon} size={40} iconColor="#fff" style={s.cardIcon} />
              <View style={s.cardText}>
                <Text style={s.cardTitle}>{op.title}</Text>
                <Text style={s.cardSub}>{op.subtitle}</Text>
              </View>
              <IconButton icon="chevron-right" size={24} iconColor="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  bg: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  scroll: { padding: 20, paddingTop: 30, paddingBottom: 40 },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitulo: { fontSize: 15, color: '#888', marginBottom: 32 },
  cardWrap: { marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 8,
    paddingRight: 8,
    elevation: 6,
  },
  cardIcon: { margin: 0 },
  cardText: { flex: 1, paddingLeft: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
});
