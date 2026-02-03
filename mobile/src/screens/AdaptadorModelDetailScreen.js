import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Chip, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';

const MODEL_CONNECTORS = {
  ADA20100_01: [
    'ZH-S20/CSTH-100',
    'ZH-MINI-HD-2',
    'ZH-MINI-HD-4',
    'ZH-MINI-FHD-1-68-1',
    'ZH-MINI-HD-1',
    'ZH-MINI-HD-3',
    'ZH-MINI-FHD-1-51-1'
  ],
  ADA20100_02: [
    'ZH-S20/CSTH-100',
    'ZH-MINI-FHD-2-68-1',
    'ZH-MINI-FHD-2-60-1',
    'ZH-MINI-FHD-2-60-1'
  ]
};

export default function AdaptadorModelDetailScreen({ route }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { modelo } = route.params || {};
  const connectors = MODEL_CONNECTORS[modelo] || [];

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWeb && { maxWidth: maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding }
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Title style={styles.mainTitle}>Detalles del Modelo</Title>
            <Paragraph style={styles.subtitle}>
              Conectores para {modelo || 'N/A'}
            </Paragraph>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Conectores</Title>
              <Divider style={styles.divider} />

              {connectors.length === 0 ? (
                <Paragraph style={styles.emptyText}>
                  No hay conectores registrados para este modelo.
                </Paragraph>
              ) : (
                connectors.map((name, index) => (
                  <View key={`${name}-${index}`} style={styles.connectorRow}>
                    <Chip icon="cable-data" style={styles.connectorChip} textStyle={styles.chipText}>
                      {name}
                    </Chip>
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  divider: {
    backgroundColor: '#444444',
    marginVertical: 16,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    fontSize: 16,
  },
  connectorRow: {
    marginBottom: 12,
  },
  connectorChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#2196F3',
  },
  chipText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
