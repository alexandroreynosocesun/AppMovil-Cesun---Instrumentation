import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { hstvtService } from '../services/HStVtService';

const IS_WEB = Platform.OS === 'web';

const OPCIONES = [
  {
    id: 'cambios',
    title: 'Cambios de Hoy',
    subtitle: 'Sube una foto del MES y la IA extrae el plan de produccion completo',
    icon: 'image-search',
    colors: ['#1565C0', '#0A3880'],
    accent: '#4FC3F7',
    badge: 'IA',
    route: 'CambiosHoy',
  },
  {
    id: 'search',
    title: 'Search Model',
    subtitle: 'Busca informacion de HS / VT por modelo o numero de parte',
    icon: 'magnify',
    colors: ['#00695C', '#004D40'],
    accent: '#80CBC4',
    badge: null,
    route: 'SearchHStVt',
  },
  {
    id: 'change',
    title: 'Change Model',
    subtitle: 'Consulta y cambia el mainboard segun el modelo',
    icon: 'swap-horizontal-bold',
    colors: ['#6A1B9A', '#38006B'],
    accent: '#CE93D8',
    badge: null,
    route: 'SearchMainboard',
  },
];

export default function PlanProduccionHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [newScriptsCount, setNewScriptsCount] = useState(0);

  const esIngeniero = user?.tipo_usuario === 'ingeniero' || user?.tipo_usuario === 'admin' || user?.tipo_usuario === 'superadmin';

  useEffect(() => {
    if (!esIngeniero) return;
    checkNewScripts();
  }, []);

  const checkNewScripts = async () => {
    try {
      const lastSeen = await AsyncStorage.getItem('hstvt_last_seen');
      const result = await hstvtService.getScripts();
      if (!result.success) return;

      const lista = result.data.scripts || [];
      if (!lastSeen) {
        // Primera vez — no mostrar badge, solo registrar
        return;
      }

      const lastSeenDate = new Date(lastSeen);
      const nuevos = lista.filter((item) => {
        if (typeof item === 'object' && item.fecha) {
          return new Date(item.fecha) > lastSeenDate;
        }
        return false;
      });
      setNewScriptsCount(nuevos.length);
    } catch {
      // silencioso
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#080810', '#0F0F1A', '#141420']} style={s.bg} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {IS_WEB && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
            <Text style={s.backTxt}>Atras</Text>
          </TouchableOpacity>
        )}

        <View style={s.header}>
          <View style={s.headerIconWrap}>
            <IconButton icon="factory" size={30} iconColor="#4FC3F7" style={{ margin: 0 }} />
          </View>
          <Text style={s.titulo}>Plan Produccion</Text>
          <Text style={s.subtitulo}>Herramientas de linea para tecnicos e ingenieros</Text>
        </View>

        {OPCIONES.map((op) => {
          const notifCount = op.id === 'search' && esIngeniero ? newScriptsCount : 0;
          return (
            <TouchableOpacity
              key={op.id}
              activeOpacity={0.82}
              onPress={() => navigation.navigate(op.route)}
              style={s.cardWrap}
            >
              <LinearGradient colors={op.colors} style={s.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={[s.decorCircle, { borderColor: op.accent + '30' }]} />

                <View style={[s.iconWrap, { backgroundColor: op.accent + '25' }]}>
                  <IconButton icon={op.icon} size={40} iconColor={op.accent} style={{ margin: 0 }} />
                  {/* Badge de notificación */}
                  {notifCount > 0 && (
                    <View style={s.notifBadge}>
                      <Text style={s.notifTxt}>{notifCount > 99 ? '99+' : notifCount}</Text>
                    </View>
                  )}
                </View>

                <View style={s.cardBody}>
                  <View style={s.cardTitleRow}>
                    <Text style={s.cardTitle}>{op.title}</Text>
                    {op.badge && (
                      <View style={[s.badge, { backgroundColor: op.accent }]}>
                        <Text style={s.badgeTxt}>{op.badge}</Text>
                      </View>
                    )}
                    {notifCount > 0 && (
                      <View style={s.newTag}>
                        <Text style={s.newTagTxt}>+{notifCount} nuevos</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.cardSub}>{op.subtitle}</Text>
                </View>

                <IconButton icon="chevron-right" size={26} iconColor={op.accent} style={{ margin: 0 }} />
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  bg: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  scroll: { padding: 20, paddingTop: 20, paddingBottom: 50 },

  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, alignSelf: 'flex-start' },
  backArrow: { fontSize: 22, color: '#4FC3F7', marginRight: 6 },
  backTxt: { fontSize: 15, color: '#4FC3F7' },

  header: { marginBottom: 28 },
  headerIconWrap: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: '#4FC3F715',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: '#4FC3F730',
  },
  titulo: { fontSize: 30, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#666', lineHeight: 20 },

  cardWrap: { marginBottom: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  decorCircle: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 36, top: -60, right: -40, opacity: 0.4,
  },
  iconWrap: {
    width: 66, height: 66, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' },
  cardTitle: { fontSize: 19, fontWeight: 'bold', color: '#fff' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, fontWeight: 'bold', color: '#000' },

  /* Badge de notificación rojo sobre el ícono */
  notifBadge: {
    position: 'absolute',
    top: -4, right: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#080810',
  },
  notifTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  /* Tag "+X nuevos" en el título */
  newTag: {
    backgroundColor: '#F4433620',
    borderRadius: 6, borderWidth: 1, borderColor: '#F44336',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  newTagTxt: { fontSize: 10, color: '#F44336', fontWeight: 'bold' },
});
