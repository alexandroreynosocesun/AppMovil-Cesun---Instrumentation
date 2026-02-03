import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Title,
  Paragraph,
  TextInput,
  ActivityIndicator,
  Divider,
  Chip,
  Button
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { adaptadorService } from '../services/AdaptadorService';
import logger from '../utils/logger';

export default function SearchMainboardScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    // Limpiar timeout anterior cuando cambia el query
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    let timeout = null;
    if (searchQuery.trim().length >= 1) {
      // Esperar 300ms antes de buscar para evitar demasiadas llamadas
      timeout = setTimeout(() => {
        loadSuggestions(searchQuery);
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery]);

  const loadSuggestions = async (query) => {
    try {
      setLoading(true);
      const result = await adaptadorService.searchMainboardModels(query);
      if (result.success) {
        setSuggestions(result.data || []);
      } else {
        logger.error('Error cargando sugerencias:', result.error);
        setSuggestions([]);
      }
    } catch (error) {
      logger.error('Error en loadSuggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = async (modeloMainboard) => {
    setSearchQuery(modeloMainboard);
    setSuggestions([]);
    setSelectedModel(null);
    setLoadingDetails(true);

    try {
      const result = await adaptadorService.getMainboardDetails(modeloMainboard);
      if (result.success) {
        setSelectedModel(result.data);
      } else {
        logger.error('Error cargando detalles:', result.error);
      }
    } catch (error) {
      logger.error('Error en handleSelectModel:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleSelectModel(item)}
      activeOpacity={0.7}
    >
      <Card style={styles.suggestionCard}>
        <Card.Content>
          <Paragraph style={styles.suggestionText}>{item}</Paragraph>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isWeb && webStyles.container]}>
      <LinearGradient
        colors={['#0F0F0F', '#1A1A1A', '#2D2D2D']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isWeb && { maxWidth: maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Title style={styles.mainTitle}>Buscar Modelo Mainboard</Title>
              <Paragraph style={styles.subtitle}>
                Escribe el modelo de mainboard para buscar información
              </Paragraph>
            </View>

            <TextInput
              ref={searchInputRef}
              label="Buscar modelo de mainboard"
              value={searchQuery}
              onChangeText={setSearchQuery}
              mode="outlined"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Ej: 10939, 11493, 11477..."
              right={
                loading ? (
                  <TextInput.Icon icon={() => <ActivityIndicator size="small" color="#2196F3" />} />
                ) : searchQuery.length > 0 ? (
                  <TextInput.Icon
                    icon="close-circle"
                    onPress={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                      setSelectedModel(null);
                    }}
                  />
                ) : null
              }
              theme={{
                colors: {
                  primary: '#2196F3',
                  background: 'transparent',
                  surface: '#1E1E1E',
                  text: '#F5F5F5',
                  placeholder: '#666666',
                  onSurface: '#FFFFFF',
                }
              }}
              outlineColor="#333333"
              activeOutlineColor="#2196F3"
              textColor="#F5F5F5"
            />

            {/* Sugerencias */}
            {suggestions.length > 0 && !selectedModel && (
              <View style={styles.suggestionsContainer}>
                <Paragraph style={styles.suggestionsTitle}>
                  Sugerencias ({suggestions.length})
                </Paragraph>
                <FlatList
                  data={suggestions}
                  renderItem={renderSuggestion}
                  keyExtractor={(item, index) => `${item}-${index}`}
                  scrollEnabled={false}
                />
              </View>
            )}

            {/* Detalles del modelo seleccionado */}
            {loadingDetails ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Paragraph style={styles.loadingText}>Cargando detalles...</Paragraph>
              </View>
            ) : selectedModel ? (
              <View style={styles.detailsContainer}>
                <Card style={styles.detailsCard}>
                  <Card.Content>
                    <Title style={styles.detailsTitle}>
                      Modelo Mainboard: {selectedModel.modelo_mainboard}
                    </Title>
                    <Divider style={styles.divider} />

                    {selectedModel.conectores && selectedModel.conectores.length > 0 ? (
                      selectedModel.conectores.map((conector, index) => (
                        <View key={index} style={styles.conectorSection}>
                          <View style={styles.conectorHeader}>
                            <Chip
                              icon="cable-data"
                              style={styles.conectorChip}
                              textStyle={styles.chipText}
                            >
                              {conector.nombre_conector}
                            </Chip>
                          </View>

                          {/* Modelos internos - PRIMERO */}
                          {conector.modelos_internos && conector.modelos_internos.length > 0 ? (
                            <View style={styles.infoSection}>
                              <Paragraph style={styles.infoLabel}>
                                Modelos Internos ({conector.modelos_internos.length}):
                              </Paragraph>
                              <View style={styles.modelosInternosContainer}>
                                {conector.modelos_internos.map((modelo, i) => (
                                  <Paragraph key={i} style={styles.modeloInterno}>
                                    • {modelo}
                                  </Paragraph>
                                ))}
                              </View>
                            </View>
                          ) : (
                            <View style={styles.infoSection}>
                              <Paragraph style={styles.emptyInfoText}>
                                No hay modelos internos registrados
                              </Paragraph>
                            </View>
                          )}

                          {/* Modelos de adaptador */}
                          {conector.modelos_adaptador && conector.modelos_adaptador.filter(m => m !== 'MODELO_1' && m !== 'MODELO_2').length > 0 && (
                            <View style={styles.infoSection}>
                              <Paragraph style={styles.infoLabel}>Modelo de Adaptador:</Paragraph>
                              <View style={styles.chipsContainer}>
                                {conector.modelos_adaptador
                                  .filter(modelo => modelo !== 'MODELO_1' && modelo !== 'MODELO_2')
                                  .map((modelo, i) => (
                                    <Chip
                                      key={i}
                                      style={[
                                        styles.modeloChip,
                                        (modelo === 'ADA20100_01' || modelo === 'ADA20100_02') 
                                          ? styles.adaptadorChip 
                                          : styles.convertidorChip
                                      ]}
                                      textStyle={styles.chipText}
                                    >
                                      {modelo}
                                    </Chip>
                                  ))}
                              </View>
                            </View>
                          )}

                          {/* Tool SW */}
                          {conector.tool_sw && conector.tool_sw.length > 0 && (
                            <View style={styles.infoSection}>
                              <Paragraph style={styles.infoLabel}>
                                Tool SW ({conector.tool_sw.length}):
                              </Paragraph>
                              <View style={styles.chipsContainer}>
                                {conector.tool_sw.map((tool, i) => (
                                  <Chip
                                    key={i}
                                    style={styles.toolChip}
                                    textStyle={styles.chipText}
                                  >
                                    {tool}
                                  </Chip>
                                ))}
                              </View>
                            </View>
                          )}

                          {index < selectedModel.conectores.length - 1 && (
                            <Divider style={styles.conectorDivider} />
                          )}
                        </View>
                      ))
                    ) : (
                      <Paragraph style={styles.emptyText}>
                        No se encontró información para este modelo de mainboard.
                      </Paragraph>
                    )}
                  </Card.Content>
                </Card>
              </View>
            ) : searchQuery.trim().length >= 1 && suggestions.length === 0 && !loading ? (
              <Card style={styles.emptyCard}>
                <Card.Content>
                  <Paragraph style={styles.emptyText}>
                    No se encontraron modelos que coincidan con "{searchQuery}"
                  </Paragraph>
                </Card.Content>
              </Card>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  searchInput: {
    marginBottom: 20,
    backgroundColor: '#1E1E1E',
  },
  suggestionsContainer: {
    marginBottom: 20,
  },
  suggestionsTitle: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  suggestionCard: {
    backgroundColor: '#2A2A2A',
    marginBottom: 8,
    borderRadius: 8,
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#B0B0B0',
    marginTop: 12,
  },
  detailsContainer: {
    marginTop: 20,
  },
  detailsCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  divider: {
    backgroundColor: '#444444',
    marginVertical: 16,
  },
  conectorSection: {
    marginBottom: 20,
  },
  conectorHeader: {
    marginBottom: 16,
  },
  conectorChip: {
    backgroundColor: '#2196F3',
    alignSelf: 'flex-start',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeloChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  adaptadorChip: {
    backgroundColor: '#2196F3',
  },
  convertidorChip: {
    backgroundColor: '#FF9800',
  },
  toolChip: {
    backgroundColor: '#4CAF50',
    marginRight: 8,
    marginBottom: 8,
  },
  modelosInternosContainer: {
    marginLeft: 8,
  },
  modeloInterno: {
    color: '#E0E0E0',
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  conectorDivider: {
    backgroundColor: '#444444',
    marginTop: 20,
  },
  emptyCard: {
    backgroundColor: '#2A2A2A',
    marginTop: 20,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    fontSize: 16,
  },
});
