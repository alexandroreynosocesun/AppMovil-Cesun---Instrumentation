import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { uphService } from '../services/UPHService';

export default function ModeloLideraScreen() {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [lineas, setLineas] = useState([]);
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [modelos, setModelos] = useState([]);
  const [loadingLineas, setLoadingLineas] = useState(true);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cargarLineas = useCallback(async () => {
    const result = await uphService.getLineas();
    if (result.success) {
      setLineas(result.data);
      if (result.data.length > 0 && !lineaSeleccionada) {
        setLineaSeleccionada(result.data[0]);
      }
    }
    setLoadingLineas(false);
  }, []);

  const cargarModelos = useCallback(async (linea, isRefresh = false) => {
    if (!linea) return;
    if (isRefresh) setRefreshing(true);
    else setLoadingModelos(true);
    const result = await uphService.getModelosPorLinea(linea.nombre);
    if (result.success) setModelos(result.data);
    setLoadingModelos(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargarLineas(); }, [cargarLineas]);

  useEffect(() => {
    if (lineaSeleccionada) cargarModelos(lineaSeleccionada);
  }, [lineaSeleccionada, cargarModelos]);

  if (loadingLineas) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#1A237E', '#0F0F0F']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* Selector de línea */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lineaRow}>
          {lineas.map(l => (
            <TouchableOpacity
              key={l.id}
              style={[styles.lineaChip, lineaSeleccionada?.id === l.id && styles.lineaChipActivo]}
              onPress={() => setLineaSeleccionada(l)}
            >
              <Text style={[styles.lineaChipText, lineaSeleccionada?.id === l.id && styles.lineaChipTextActivo]}>
                {l.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWeb && { maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => cargarModelos(lineaSeleccionada, true)}
              tintColor="#2196F3"
            />
          }
        >
          {lineaSeleccionada && (
            <Text style={styles.lineaTitulo}>
              Modelos disponibles · {lineaSeleccionada.nombre}
            </Text>
          )}

          {loadingModelos ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#2196F3" />
            </View>
          ) : modelos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Sin modelos para esta línea</Text>
              <Text style={styles.emptyHint}>
                Pide al administrador o ingeniero que configure los modelos
              </Text>
            </View>
          ) : (
            modelos.map(m => {
              return (
                <View key={m.id} style={styles.card}>
                  {/* Header del modelo */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.modeloNombre}>{m.nombre}</Text>
                    <View style={styles.lineaBadge}>
                      <Text style={styles.lineaBadgeText}>{m.linea}</Text>
                    </View>
                  </View>

                  {/* Cantidades */}
                  <View style={styles.cantidadesRow}>
                    <View style={styles.cantidadBloque}>
                      <Text style={styles.cantidadLabel}>UPH Línea</Text>
                      <Text style={styles.cantidadValor}>{m.uph_total}</Text>
                      <Text style={styles.cantidadUnidad}>pzs/hr</Text>
                    </View>

                    <View style={styles.cantidadSep} />

                    <View style={styles.cantidadBloque}>
                      <Text style={styles.cantidadLabel}>Por turno (12h)</Text>
                      <Text style={[styles.cantidadValor, { color: '#4CAF50' }]}>
                        {Math.round(m.uph_total * 12)}
                      </Text>
                      <Text style={styles.cantidadUnidad}>pzs</Text>
                    </View>

                    <View style={styles.cantidadSep} />

                    <View style={styles.cantidadBloque}>
                      <Text style={styles.cantidadLabel}>Por hora (est.)</Text>
                      <Text style={[styles.cantidadValor, { color: '#2196F3' }]}>
                        {m.uph_total}
                      </Text>
                      <Text style={styles.cantidadUnidad}>UPH meta</Text>
                    </View>
                  </View>

                  {/* Información adicional */}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTexto}>
                      Meta diaria completa (12h): <Text style={styles.infoValor}>{Math.round(m.uph_total * 12)} piezas</Text>
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Selector de línea
  lineaRow: { paddingHorizontal: 12, paddingVertical: 10, maxHeight: 52 },
  lineaChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', marginRight: 8,
  },
  lineaChipActivo: { backgroundColor: '#1565C0', borderColor: '#2196F3' },
  lineaChipText: { color: '#9E9E9E', fontSize: 14 },
  lineaChipTextActivo: { color: '#FFFFFF', fontWeight: 'bold' },

  scroll: { padding: 14 },
  lineaTitulo: {
    color: '#757575', fontSize: 12, letterSpacing: 1,
    marginBottom: 12, textTransform: 'uppercase',
  },

  // Cards
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#2D2D2D',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#2D2D2D',
  },
  modeloNombre: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  lineaBadge: {
    backgroundColor: '#1565C033', borderWidth: 1, borderColor: '#2196F3',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
  },
  lineaBadgeText: { color: '#2196F3', fontSize: 12, fontWeight: 'bold' },

  // Cantidades
  cantidadesRow: {
    flexDirection: 'row', padding: 16, alignItems: 'center',
  },
  cantidadBloque: { flex: 1, alignItems: 'center' },
  cantidadLabel: { color: '#757575', fontSize: 11, marginBottom: 4, textAlign: 'center' },
  cantidadValor: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  cantidadUnidad: { color: '#616161', fontSize: 10, marginTop: 2 },
  cantidadSep: { width: 1, height: 50, backgroundColor: '#2D2D2D', marginHorizontal: 8 },

  // Info
  infoRow: {
    backgroundColor: '#0F0F0F', paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#2D2D2D',
  },
  infoTexto: { color: '#757575', fontSize: 12 },
  infoValor: { color: '#BDBDBD', fontWeight: 'bold' },

  // Empty
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#9E9E9E', fontSize: 16, marginBottom: 8, textAlign: 'center' },
  emptyHint: { color: '#616161', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
