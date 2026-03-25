import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const OPCIONES = [
  {
    id: 'cambios',
    title: 'Cambios de Hoy',
    subtitle: 'Sube una foto del MES y la IA extrae el plan de produccion completo',
    icon: 'image-search-outline',
    colors: ['#1565C0', '#0A3880'],
    accentColor: '#4FC3F7',
    route: 'CambiosHoy',
    badge: 'IA',
  },
  {
    id: 'search',
    title: 'Search Model',
    subtitle: 'Busca informacion de HS / VT por modelo o numero de parte',
    icon: 'magnify',
    colors: ['#00695C', '#004D40'],
    accentColor: '#80CBC4',
    route: 'SearchHStVt',
    badge: null,
  },
  {
    id: 'change',
    title: 'Change Model',
    subtitle: 'Consulta y cambia el mainboard segun el modelo',
    icon: 'swap-horizontal-bold',
    colors: ['#6A1B9A', '#38006B'],
    accentColor: '#CE93D8',
    route: 'SearchMainboard',
    badge: null,
  },
];

export default function PlanProduccionHomeScreen({ navigation }) {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#080810', '#0F0F1A', '#141420']} style={s.bg} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <MaterialCommunityIcons name="factory" size={32} color="#4FC3F7" />
          </View>
          <Text style={s.titulo}>Plan Produccion</Text>
          <Text style={s.subtitulo}>Herramientas de linea para tecnicos e ingenieros</Text>
        </View>

        {/* Cards */}
        {OPCIONES.map((op) => (
          <TouchableOpacity
            key={op.id}
            activeOpacity={0.82}
            onPress={() => navigation.navigate(op.route)}
            style={s.cardWrap}
          >
            <LinearGradient
              colors={op.colors}
              style={s.card}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Circulo decorativo de fondo */}
              <View style={[s.decorCircle, { borderColor: op.accentColor + '30' }]} />

              {/* Icono grande */}
              <View style={[s.iconWrap, { backgroundColor: op.accentColor + '25' }]}>
                <MaterialCommunityIcons name={op.icon} size={48} color={op.accentColor} />
              </View>

              {/* Texto */}
              <View style={s.cardBody}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardTitle}>{op.title}</Text>
                  {op.badge && (
                    <View style={[s.badge, { backgroundColor: op.accentColor }]}>
                      <Text style={s.badgeTxt}>{op.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardSub}>{op.subtitle}</Text>
              </View>

              {/* Flecha */}
              <View style={s.arrowWrap}>
                <MaterialCommunityIcons name="chevron-right" size={28} color={op.accentColor} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  bg: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  scroll: { padding: 20, paddingTop: 24, paddingBottom: 50 },

  header: { marginBottom: 32, alignItems: 'flex-start' },
  headerIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#4FC3F715',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1, borderColor: '#4FC3F730',
  },
  titulo: { fontSize: 30, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#666', lineHeight: 20 },

  cardWrap: { marginBottom: 16 },
  card: {
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 110,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  decorCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 40,
    top: -60,
    right: -40,
    opacity: 0.4,
  },
  iconWrap: {
    width: 72, height: 72,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
  badge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeTxt: { fontSize: 10, fontWeight: 'bold', color: '#000' },
  arrowWrap: { paddingLeft: 8 },
});
