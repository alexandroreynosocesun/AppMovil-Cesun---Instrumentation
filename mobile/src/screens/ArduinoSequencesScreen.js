import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Text,
  TouchableOpacity
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  TextInput,
  Button,
  ActivityIndicator,
  IconButton,
  Chip,
  Dialog,
  Portal
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { arduinoSequenceService } from '../services/ArduinoSequenceService';
import logger from '../utils/logger';

export default function ArduinoSequencesScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [searchModelo, setSearchModelo] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedInterno, setSelectedInterno] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    comando: '',
    destino: '',
    pais: '',
    modelo: '',
    modelo_interno: ''
  });

  const canEdit = user?.tipo_usuario === 'admin' || user?.tipo_usuario === 'ingeniero';

  const loadSequences = async () => {
    if (!searchModelo.trim()) {
      setItems([]);
      setHasSearched(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const params = {};
      if (searchModelo.trim()) {
        params.modelo = searchModelo.trim();
      }
      const result = await arduinoSequenceService.getSequences(params);
      if (result.success) {
        const data = result.data?.items || result.data || [];
        setItems(Array.isArray(data) ? data : []);
        setSelectedInterno(null);
      } else {
        Alert.alert('Error', result.error || 'Error cargando secuencias');
        setItems([]);
      }
    } catch (error) {
      logger.error('Error cargando secuencias:', error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (!hasSearched) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    loadSequences();
  };

  const handleSave = async () => {
    if (!formData.modelo || !formData.modelo_interno || !formData.destino || !formData.comando) {
      Alert.alert('Error', 'Completa modelo, modelo interno, destino y comando.');
      return;
    }
    const payload = {
      comando: formData.comando.trim(),
      destino: formData.destino.trim(),
      pais: formData.pais.trim(),
      modelo: formData.modelo.trim(),
      modelo_interno: formData.modelo_interno.trim()
    };
    const result = await arduinoSequenceService.createSequence(payload);
    if (result.success) {
      setShowDialog(false);
      setFormData({ comando: '', destino: '', pais: '', modelo: '', modelo_interno: '' });
      loadSequences();
    } else {
      Alert.alert('Error', result.error || 'No se pudo guardar');
    }
  };

  const handleDelete = async (sequenceId) => {
    Alert.alert(
      'Eliminar registro',
      '¿Seguro que quieres eliminar esta secuencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await arduinoSequenceService.deleteSequence(sequenceId);
            if (result.success) {
              if (hasSearched) {
                loadSequences();
              }
            } else {
              Alert.alert('Error', result.error || 'No se pudo eliminar');
            }
          }
        }
      ]
    );
  };

  const internalOptions = Array.from(
    new Set(items.map(item => item.modelo_interno).filter(Boolean))
  );

  const filteredItems = selectedInterno
    ? items.filter(item => item.modelo_interno === selectedInterno)
    : items;

  const getCountryTags = (destino, pais) => {
    const tags = [];
    const upperDestino = (destino || '').toUpperCase();
    ['COL', 'MEX', 'GUA', 'US'].forEach(tag => {
      if (upperDestino.includes(`_${tag}`) || upperDestino.includes(`${tag}_`)) {
        tags.push(tag);
      }
    });
    if (pais) {
      const paisTokens = pais
        .toUpperCase()
        .split(/[,\s]+/)
        .map(token => token.trim())
        .filter(Boolean);
      tags.push(...paisTokens);
    }
    return Array.from(new Set(tags));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={[styles.card, styles.headerCard]}>
          <Card.Content>
            <Title style={styles.title}>Arduino</Title>
            <Paragraph style={styles.subtitle}>Busca por modelo y consulta comando/destino</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.card, styles.searchCard]}>
          <Card.Content>
            <TextInput
              label="Modelo"
              value={searchModelo}
              onChangeText={setSearchModelo}
              mode="outlined"
              style={styles.input}
              dense
              textColor={styles.inputText.color}
              outlineColor={styles.inputOutline.color}
              activeOutlineColor={styles.inputOutlineActive.color}
            />
            <Button
              mode="contained"
              onPress={loadSequences}
              style={styles.searchButton}
              contentStyle={styles.searchButtonContent}
              buttonColor={styles.primaryButton.backgroundColor}
              textColor={styles.primaryButtonText.color}
            >
              Buscar
            </Button>
          </Card.Content>
        </Card>

        {canEdit && (
          <Card style={[styles.card, styles.actionsCard]}>
            <Card.Content>
              <Button
                mode="contained"
                onPress={() => setShowDialog(true)}
                contentStyle={styles.actionButtonContent}
                buttonColor={styles.primaryButton.backgroundColor}
                textColor={styles.primaryButtonText.color}
              >
                Agregar Secuencia
              </Button>
            </Card.Content>
          </Card>
        )}

        {hasSearched && items.length > 0 && (
          <Card style={[styles.card, styles.filterCard]}>
            <Card.Content>
              <Paragraph style={styles.sectionTitle}>Modelo interno</Paragraph>
              <ScrollView style={styles.optionsList} nestedScrollEnabled>
                <TouchableOpacity
                  style={[
                    styles.optionRow,
                    !selectedInterno ? styles.optionRowActive : null
                  ]}
                  onPress={() => setSelectedInterno(null)}
                >
                  <Text style={styles.optionText}>Todos</Text>
                </TouchableOpacity>
                {internalOptions.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionRow,
                      selectedInterno === option ? styles.optionRowActive : null
                    ]}
                    onPress={() => setSelectedInterno(option)}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Card.Content>
          </Card>
        )}

        {!hasSearched && (
          <Card style={[styles.card, styles.infoCard]}>
            <Card.Content>
              <Paragraph style={styles.bodyText}>
                Escribe un modelo y presiona Buscar para ver resultados.
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Paragraph>Cargando...</Paragraph>
          </View>
        ) : hasSearched ? (
          filteredItems.map(item => (
            <Card key={item.id} style={[styles.card, styles.itemCard]}>
              <Card.Content>
                <View style={styles.row}>
                  <Title style={styles.itemTitle}>{item.modelo}</Title>
                  <View style={styles.chipRow}>
                    {getCountryTags(item.destino, item.pais).map(tag => (
                      <Chip key={`${item.id}-${tag}`} style={styles.paisChip} textStyle={styles.paisChipText}>
                        {tag}
                      </Chip>
                    ))}
                  </View>
                </View>
                <Paragraph style={styles.bodyText}>Modelo interno: {item.modelo_interno}</Paragraph>
                <Paragraph style={styles.bodyText}>Destino: {item.destino}</Paragraph>
                <Paragraph style={styles.bodyText}>Comando: {item.comando}</Paragraph>
                {canEdit && (
                  <View style={styles.itemActions}>
                    <Button
                      mode="text"
                      onPress={() => handleDelete(item.id)}
                      textColor={styles.deleteText.color}
                    >
                      Eliminar
                    </Button>
                    <IconButton
                      icon="delete-outline"
                      size={18}
                      iconColor={styles.deleteText.color}
                      onPress={() => handleDelete(item.id)}
                    />
                  </View>
                )}
              </Card.Content>
            </Card>
          ))
        ) : null}

        {!loading && hasSearched && items.length === 0 && (
          <Card style={[styles.card, styles.infoCard]}>
            <Card.Content>
              <Paragraph style={styles.bodyText}>Sin resultados para ese modelo.</Paragraph>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <Portal>
          <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)} style={styles.dialog}>
          <Dialog.Title>Agregar Secuencia</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Modelo"
              value={formData.modelo}
              onChangeText={(text) => setFormData(prev => ({ ...prev, modelo: text }))}
              mode="outlined"
              style={styles.input}
                dense
                textColor={styles.inputText.color}
                outlineColor={styles.inputOutline.color}
                activeOutlineColor={styles.inputOutlineActive.color}
            />
            <TextInput
              label="Modelo interno"
              value={formData.modelo_interno}
              onChangeText={(text) => setFormData(prev => ({ ...prev, modelo_interno: text }))}
              mode="outlined"
              style={styles.input}
                dense
                textColor={styles.inputText.color}
                outlineColor={styles.inputOutline.color}
                activeOutlineColor={styles.inputOutlineActive.color}
            />
            <TextInput
              label="Destino"
              value={formData.destino}
              onChangeText={(text) => setFormData(prev => ({ ...prev, destino: text }))}
              mode="outlined"
              style={styles.input}
                dense
                textColor={styles.inputText.color}
                outlineColor={styles.inputOutline.color}
                activeOutlineColor={styles.inputOutlineActive.color}
            />
            <TextInput
              label="Comando"
              value={formData.comando}
              onChangeText={(text) => setFormData(prev => ({ ...prev, comando: text }))}
              mode="outlined"
              style={styles.input}
                dense
                textColor={styles.inputText.color}
                outlineColor={styles.inputOutline.color}
                activeOutlineColor={styles.inputOutlineActive.color}
            />
            <TextInput
                label="País(es) (COL/MEX/GUA/US)"
              value={formData.pais}
              onChangeText={(text) => setFormData(prev => ({ ...prev, pais: text }))}
              mode="outlined"
              style={styles.input}
                dense
                textColor={styles.inputText.color}
                outlineColor={styles.inputOutline.color}
                activeOutlineColor={styles.inputOutlineActive.color}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancelar</Button>
            <Button mode="contained" onPress={handleSave}>Guardar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121316',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1A1D22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2F38',
    elevation: 2,
  },
  headerCard: {
    marginBottom: 14,
  },
  searchCard: {
    marginBottom: 14,
  },
  actionsCard: {
    marginBottom: 14,
  },
  input: {
    marginBottom: 10,
    backgroundColor: '#15181D',
  },
  inputText: {
    color: '#E7EAF0',
  },
  inputOutline: {
    color: '#3A4250',
  },
  inputOutlineActive: {
    color: '#2D7FF9',
  },
  searchButton: {
    marginTop: 6,
  },
  searchButtonContent: {
    paddingVertical: 6,
  },
  actionButtonContent: {
    paddingVertical: 6,
  },
  primaryButton: {
    backgroundColor: '#2D7FF9',
  },
  primaryButtonText: {
    color: '#F8FBFF',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  itemCard: {
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F2F4F8',
  },
  title: {
    color: '#F2F4F8',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#C7CDD6',
  },
  bodyText: {
    color: '#C7CDD6',
  },
  infoCard: {
    marginBottom: 12,
  },
  filterCard: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F2F4F8',
    fontWeight: '700',
    marginBottom: 8,
  },
  optionsList: {
    maxHeight: 160,
  },
  optionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2F38',
    marginBottom: 8,
    backgroundColor: '#15181D',
  },
  optionRowActive: {
    borderColor: '#2D7FF9',
    backgroundColor: '#1B2A44',
  },
  optionText: {
    color: '#E7EAF0',
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  deleteText: {
    color: '#E5484D',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  }
  ,
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  paisChip: {
    backgroundColor: '#2C3140',
  },
  paisChipText: {
    color: '#E7EAF0',
    fontWeight: '600',
  },
  dialog: {
    borderRadius: 12,
    backgroundColor: '#1A1D22',
  },
});
