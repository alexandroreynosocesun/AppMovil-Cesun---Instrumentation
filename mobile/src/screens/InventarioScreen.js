import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Title,
  Text,
  Button,
  DataTable,
  Chip,
  IconButton,
  TextInput,
  Divider,
  Surface,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext';
import { inventarioService } from '../services/InventarioService';
import logger from '../utils/logger';

export default function InventarioScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [inventario, setInventario] = useState(null);
  const [nombreInventario, setNombreInventario] = useState('Inventario General');

  useEffect(() => {
    cargarResumen();
  }, []);

  const cargarResumen = async () => {
    setLoading(true);
    try {
      const result = await inventarioService.getResumen();
      if (result.success) {
        setInventario(result.data);
        logger.info('Resumen de inventario cargado:', result.data);
      } else {
        Alert.alert('Error', result.error || 'Error cargando inventario');
      }
    } catch (error) {
      logger.error('Error cargando resumen:', error);
      Alert.alert('Error', 'No se pudo cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  const generarPDF = async () => {
    setLoadingPDF(true);
    try {
      const result = await inventarioService.generarPDF(nombreInventario);
      if (result.success) {
        if (Platform.OS === 'web') {
          // En web, descargar el blob directamente
          const blob = result.data;
          const filename = `inventario_${new Date().toISOString().split('T')[0]}.pdf`;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          Alert.alert('Éxito', 'PDF descargado correctamente');
        } else {
          // En mobile, ya tenemos el URI del archivo descargado
          const fileUri = result.data;

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Compartir Inventario PDF',
            });
          } else {
            Alert.alert('PDF guardado', 'Archivo guardado correctamente');
          }
        }
      } else {
        Alert.alert('Error', result.error || 'Error generando PDF');
      }
    } catch (error) {
      logger.error('Error generando PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF');
    } finally {
      setLoadingPDF(false);
    }
  };

  const getEstadoColor = (ok, ng) => {
    if (ng === 0) return '#4CAF50'; // Verde - todo OK
    if (ng > ok) return '#F44336'; // Rojo - mayoría NG
    return '#FF9800'; // Naranja - algunos NG
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <LinearGradient
        colors={['#1A1A1A', '#2C2C2C', '#1A1A1A']}
        style={styles.gradientBackground}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header con nombre del inventario */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerRow}>
              <IconButton icon="clipboard-list" size={32} iconColor="#00BCD4" />
              <Title style={styles.headerTitle}>Generar Inventario</Title>
            </View>
            <Text style={styles.headerSubtitle}>
              Genera un PDF con el inventario completo de herramientas
            </Text>

            <TextInput
              label="Nombre del Inventario"
              value={nombreInventario}
              onChangeText={setNombreInventario}
              style={styles.input}
              mode="outlined"
              outlineColor="#3C3C3C"
              activeOutlineColor="#00BCD4"
              textColor="#FFFFFF"
              theme={{ colors: { onSurfaceVariant: '#B0B0B0' } }}
            />

            <Button
              mode="contained"
              onPress={generarPDF}
              loading={loadingPDF}
              disabled={loadingPDF || loading}
              style={styles.generateButton}
              icon="file-pdf-box"
              buttonColor="#00BCD4"
            >
              {loadingPDF ? 'Generando...' : 'Generar PDF'}
            </Button>
          </Card.Content>
        </Card>

        {/* Resumen del inventario */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <IconButton icon="chart-bar" size={24} iconColor="#2196F3" />
              <Title style={styles.sectionTitle}>Resumen de Inventario</Title>
              <IconButton
                icon="refresh"
                size={20}
                iconColor="#B0B0B0"
                onPress={cargarResumen}
                disabled={loading}
              />
            </View>
            <Divider style={styles.divider} />

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00BCD4" />
                <Text style={styles.loadingText}>Cargando inventario...</Text>
              </View>
            ) : inventario ? (
              <>
                {/* Totales */}
                <View style={styles.totalesContainer}>
                  <Surface style={[styles.totalCard, { backgroundColor: '#2196F3' }]}>
                    <Text style={styles.totalNumber}>{inventario.total?.qty || 0}</Text>
                    <Text style={styles.totalLabel}>Total</Text>
                  </Surface>
                  <Surface style={[styles.totalCard, { backgroundColor: '#4CAF50' }]}>
                    <Text style={styles.totalNumber}>{inventario.total?.ok || 0}</Text>
                    <Text style={styles.totalLabel}>OK</Text>
                  </Surface>
                  <Surface style={[styles.totalCard, { backgroundColor: '#F44336' }]}>
                    <Text style={styles.totalNumber}>{inventario.total?.ng || 0}</Text>
                    <Text style={styles.totalLabel}>NG</Text>
                  </Surface>
                </View>

                {/* Tabla de herramientas */}
                <DataTable style={styles.dataTable}>
                  <DataTable.Header style={styles.tableHeader}>
                    <DataTable.Title textStyle={styles.headerText}>Herramienta</DataTable.Title>
                    <DataTable.Title numeric textStyle={styles.headerText}>Qty</DataTable.Title>
                    <DataTable.Title numeric textStyle={styles.headerText}>OK</DataTable.Title>
                    <DataTable.Title numeric textStyle={styles.headerText}>NG</DataTable.Title>
                  </DataTable.Header>

                  {inventario.items?.map((item, index) => (
                    <DataTable.Row
                      key={index}
                      style={[
                        styles.tableRow,
                        item.ng > 0 && styles.tableRowNG
                      ]}
                    >
                      <DataTable.Cell textStyle={styles.cellText}>
                        <View style={styles.toolCell}>
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: getEstadoColor(item.ok, item.ng) }
                            ]}
                          />
                          <Text style={styles.cellText} numberOfLines={1}>
                            {item.tool}
                          </Text>
                        </View>
                      </DataTable.Cell>
                      <DataTable.Cell numeric textStyle={styles.cellText}>
                        {item.qty}
                      </DataTable.Cell>
                      <DataTable.Cell numeric textStyle={[styles.cellText, { color: '#4CAF50' }]}>
                        {item.ok}
                      </DataTable.Cell>
                      <DataTable.Cell numeric textStyle={[styles.cellText, item.ng > 0 && { color: '#F44336' }]}>
                        {item.ng}
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}

                  {/* Fila de totales */}
                  <DataTable.Row style={styles.totalRow}>
                    <DataTable.Cell textStyle={styles.totalRowText}>TOTAL</DataTable.Cell>
                    <DataTable.Cell numeric textStyle={styles.totalRowText}>
                      {inventario.total?.qty || 0}
                    </DataTable.Cell>
                    <DataTable.Cell numeric textStyle={[styles.totalRowText, { color: '#4CAF50' }]}>
                      {inventario.total?.ok || 0}
                    </DataTable.Cell>
                    <DataTable.Cell numeric textStyle={[styles.totalRowText, { color: '#F44336' }]}>
                      {inventario.total?.ng || 0}
                    </DataTable.Cell>
                  </DataTable.Row>
                </DataTable>

                {/* Detalles de NG si hay */}
                {inventario.items?.some(item => item.ng_detalles?.length > 0) && (
                  <View style={styles.ngDetailsSection}>
                    <View style={styles.sectionHeader}>
                      <IconButton icon="alert-circle" size={20} iconColor="#F44336" />
                      <Text style={styles.ngDetailsTitle}>Detalles de NG</Text>
                    </View>
                    {inventario.items
                      .filter(item => item.ng_detalles?.length > 0)
                      .map((item, idx) => (
                        <View key={idx} style={styles.ngDetailItem}>
                          <Chip
                            style={styles.ngChip}
                            textStyle={{ color: '#F44336', fontSize: 12 }}
                          >
                            {item.tool}
                          </Chip>
                          {item.ng_detalles.slice(0, 3).map((detalle, dIdx) => (
                            <Text key={dIdx} style={styles.ngDetailText}>
                              - {detalle.adaptador}: {detalle.conector}
                              {detalle.comentario ? ` (${detalle.comentario})` : ''}
                            </Text>
                          ))}
                          {item.ng_detalles.length > 3 && (
                            <Text style={styles.ngDetailMore}>
                              ... y {item.ng_detalles.length - 3} más
                            </Text>
                          )}
                        </View>
                      ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>No hay datos de inventario</Text>
            )}
          </Card.Content>
        </Card>

        {/* Información */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoRow}>
              <IconButton icon="information" size={20} iconColor="#2196F3" />
              <Text style={styles.infoText}>
                El PDF incluye todas las herramientas activas: adaptadores, convertidores, VByOne, Mini LVDS y 2K LVDS.
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#00BCD4',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#3C3C3C',
    marginBottom: 16,
  },
  generateButton: {
    borderRadius: 8,
    paddingVertical: 4,
  },
  card: {
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    flex: 1,
  },
  divider: {
    backgroundColor: '#3C3C3C',
    marginVertical: 12,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    color: '#B0B0B0',
    marginTop: 12,
  },
  totalesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  totalCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
    elevation: 4,
  },
  totalNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },
  dataTable: {
    backgroundColor: '#3C3C3C',
    borderRadius: 8,
  },
  tableHeader: {
    backgroundColor: '#2196F3',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#4C4C4C',
  },
  tableRowNG: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  cellText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  toolCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  totalRow: {
    backgroundColor: '#2C2C2C',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  totalRowText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  ngDetailsSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  ngDetailsTitle: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  ngDetailItem: {
    marginTop: 8,
    paddingLeft: 8,
  },
  ngChip: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  ngDetailText: {
    color: '#B0B0B0',
    fontSize: 12,
    marginLeft: 8,
    marginTop: 2,
  },
  ngDetailMore: {
    color: '#F44336',
    fontSize: 12,
    marginLeft: 8,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: '#B0B0B0',
    fontSize: 13,
    flex: 1,
  },
});
