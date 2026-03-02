import React, { useState, useEffect, useRef } from 'react';
import { showAlert } from '../utils/alertUtils';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Title,
  Paragraph,
  TextInput,
  ActivityIndicator,
  Divider,
  Chip,
  Button,
  IconButton
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { useAuth } from '../contexts/AuthContext';
import { adaptadorService } from '../services/AdaptadorService';
import { arduinoSequenceService } from '../services/ArduinoSequenceService';
import { modeloObservacionService } from '../services/ModeloObservacionService';
import logger from '../utils/logger';

export default function SearchMainboardScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const searchInputRef = useRef(null);

  // Filtro de conectores (PCB info)
  const [selectedConectorInterno, setSelectedConectorInterno] = useState(null);
  const [showConectorFilterModal, setShowConectorFilterModal] = useState(false);

  // Filtro de Arduino (MiniSOP)
  const [selectedArduinoInterno, setSelectedArduinoInterno] = useState(null);
  const [showArduinoFilterModal, setShowArduinoFilterModal] = useState(false);

  // Arduino dialog
  const [showArduinoDialog, setShowArduinoDialog] = useState(false);
  const [arduinoForm, setArduinoForm] = useState({
    comando: '', destino: '', pais: '', modelo: '', modelo_interno: ''
  });

  // Historial
  const [observaciones, setObservaciones] = useState([]);
  const [loadingObs, setLoadingObs] = useState(false);
  const [newObsText, setNewObsText] = useState('');
  const [newObsFoto, setNewObsFoto] = useState(null);
  const [showObsDialog, setShowObsDialog] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [showFotoViewModal, setShowFotoViewModal] = useState(false);
  const [fotoViewUri, setFotoViewUri] = useState(null);

  const canEditArduino = user?.tipo_usuario === 'admin' || user?.tipo_usuario === 'superadmin' || user?.tipo_usuario === 'ingeniero';
  const canDeleteObs = user?.tipo_usuario === 'admin' || user?.tipo_usuario === 'superadmin' || user?.tipo_usuario === 'ingeniero';

  // Opciones de filtro para conectores (PCB info)
  const conectorModelosInternos = selectedModel
    ? [...new Set((selectedModel.conectores || []).flatMap(c => c.modelos_internos || []))].sort()
    : [];

  // Opciones de filtro para Arduino (MiniSOP)
  const arduinoModelosInternos = selectedModel
    ? [...new Set((selectedModel.arduino_sequences || []).map(s => s.modelo_interno).filter(Boolean))].sort()
    : [];

  // Datos filtrados
  const filteredConectores = selectedModel?.conectores
    ? (selectedConectorInterno
        ? selectedModel.conectores.filter(c => c.modelos_internos?.includes(selectedConectorInterno))
        : selectedModel.conectores)
    : [];

  const filteredArduino = selectedModel?.arduino_sequences
    ? (selectedArduinoInterno
        ? selectedModel.arduino_sequences.filter(s => s.modelo_interno === selectedArduinoInterno)
        : selectedModel.arduino_sequences)
    : [];

  const loadObservaciones = async (modelo_mainboard) => {
    setLoadingObs(true);
    try {
      const result = await modeloObservacionService.getObservaciones(modelo_mainboard);
      if (result.success) setObservaciones(result.data || []);
    } catch (e) {
      logger.error('Error cargando observaciones:', e);
    } finally {
      setLoadingObs(false);
    }
  };

  const handleTakeObsFoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permisos requeridos', 'Necesitamos acceso a la cámara.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        base64: false,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) {
        const ctx = ImageManipulator.manipulate(result.assets[0].uri);
        ctx.resize({ width: 800 });
        const imageRef = await ctx.renderAsync();
        const manipulated = await imageRef.saveAsync({ format: SaveFormat.JPEG, compress: 0.3, base64: true });
        ctx.release();
        imageRef.release();
        setNewObsFoto(`data:image/jpeg;base64,${manipulated.base64}`);
      }
    } catch (error) {
      showAlert('Error', 'No se pudo tomar la foto.');
    }
  };

  const handleSaveObs = async () => {
    if (!newObsText.trim()) return;
    setSavingObs(true);
    const result = await modeloObservacionService.createObservacion(
      selectedModel.modelo_mainboard, newObsText.trim(), newObsFoto || null
    );
    setSavingObs(false);
    if (result.success) {
      setObservaciones(prev => [result.data, ...prev]);
      setNewObsText('');
      setNewObsFoto(null);
      setShowObsDialog(false);
    } else {
      showAlert('Error', result.error || 'No se pudo guardar');
    }
  };

  const handleDeleteObs = (obsId) => {
    showAlert('Eliminar observación', '¿Seguro que quieres eliminar esta observación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const result = await modeloObservacionService.deleteObservacion(obsId);
          if (result.success) {
            setObservaciones(prev => prev.filter(o => o.id !== obsId));
          } else {
            showAlert('Error', result.error || 'No se pudo eliminar');
          }
        }
      }
    ]);
  };

  const handleSaveArduino = async () => {
    if (!arduinoForm.modelo_interno || !arduinoForm.destino || !arduinoForm.comando) {
      showAlert('Error', 'Completa modelo interno, destino y comando.');
      return;
    }
    const payload = {
      comando: arduinoForm.comando.trim(),
      destino: arduinoForm.destino.trim(),
      pais: arduinoForm.pais.trim(),
      modelo: selectedModel?.modelo_mainboard || arduinoForm.modelo.trim(),
      modelo_interno: arduinoForm.modelo_interno.trim()
    };
    const result = await arduinoSequenceService.createSequence(payload);
    if (result.success) {
      setShowArduinoDialog(false);
      setArduinoForm({ comando: '', destino: '', pais: '', modelo: '', modelo_interno: '' });
      if (selectedModel?.modelo_mainboard) handleSelectModel(selectedModel.modelo_mainboard);
    } else {
      showAlert('Error', result.error || 'No se pudo guardar');
    }
  };

  const handleDeleteArduino = (sequenceId) => {
    showAlert('Eliminar secuencia', '¿Seguro que quieres eliminar esta secuencia Arduino?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const result = await arduinoSequenceService.deleteSequence(sequenceId);
          if (result.success) {
            if (selectedModel?.modelo_mainboard) handleSelectModel(selectedModel.modelo_mainboard);
          } else {
            showAlert('Error', result.error || 'No se pudo eliminar');
          }
        }
      }
    ]);
  };

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    let timeout = null;
    if (searchQuery.trim().length >= 1) {
      timeout = setTimeout(() => { loadSuggestions(searchQuery); }, 300);
      setSearchTimeout(timeout);
    } else {
      setSuggestions([]);
    }
    return () => { if (timeout) clearTimeout(timeout); };
  }, [searchQuery]);

  const loadSuggestions = async (query) => {
    try {
      setLoading(true);
      const result = await adaptadorService.searchMainboardModels(query);
      if (result.success) setSuggestions(result.data || []);
      else { logger.error('Error cargando sugerencias:', result.error); setSuggestions([]); }
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
    setSelectedConectorInterno(null);
    setSelectedArduinoInterno(null);
    setObservaciones([]);
    setLoadingDetails(true);
    try {
      const result = await adaptadorService.getMainboardDetails(modeloMainboard);
      if (result.success) {
        setSelectedModel(result.data);
        loadObservaciones(modeloMainboard);
      } else {
        logger.error('Error cargando detalles:', result.error);
      }
    } catch (error) {
      logger.error('Error en handleSelectModel:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity onPress={() => handleSelectModel(item)} activeOpacity={0.7}>
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
              <Title style={styles.mainTitle}>Cambio de Modelo</Title>
              <Paragraph style={styles.subtitle}>
                Busca el modelo de mainboard para ver conectores, secuencias e historial
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

            {/* Detalles del modelo */}
            {loadingDetails ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Paragraph style={styles.loadingText}>Cargando detalles...</Paragraph>
              </View>
            ) : selectedModel ? (
              <View style={styles.detailsContainer}>
                <Card style={styles.detailsCard}>
                  <Card.Content>

                    {/* Header conectores: chip modelo + filtro */}
                    <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                      <Chip icon="developer-board" style={styles.mainboardChip} textStyle={styles.mainboardChipText}>
                        {selectedModel.modelo_mainboard}
                      </Chip>
                      {conectorModelosInternos.length > 0 && (
                        <Button
                          mode="outlined"
                          compact
                          icon="filter-variant"
                          onPress={() => setShowConectorFilterModal(true)}
                          textColor="#B0B0B0"
                          style={styles.filterButton}
                        >
                          {selectedConectorInterno || 'Filtrar'}
                        </Button>
                      )}
                    </View>
                    {selectedConectorInterno && (
                      <View style={styles.activeFilterRow}>
                        <Chip
                          icon="close-circle"
                          style={styles.activeFilterChip}
                          textStyle={styles.activeFilterChipText}
                          onPress={() => setSelectedConectorInterno(null)}
                        >
                          {selectedConectorInterno}
                        </Chip>
                      </View>
                    )}

                    {/* Conectores */}
                    {filteredConectores.length > 0 ? (
                      filteredConectores.map((conector, index) => (
                        <View key={index} style={styles.conectorSection}>
                          <View style={styles.conectorHeader}>
                            <Chip icon="cable-data" style={styles.conectorChip} textStyle={styles.chipText}>
                              {conector.nombre_conector}
                            </Chip>
                          </View>

                          {conector.modelos_internos && conector.modelos_internos.length > 0 ? (
                            <View style={styles.infoSection}>
                              <Paragraph style={styles.infoLabel}>
                                Modelos Internos ({conector.modelos_internos.length}):
                              </Paragraph>
                              <View style={styles.modelosInternosContainer}>
                                {conector.modelos_internos.map((modelo, i) => (
                                  <Paragraph key={i} style={styles.modeloInterno}>• {modelo}</Paragraph>
                                ))}
                              </View>
                            </View>
                          ) : (
                            <View style={styles.infoSection}>
                              <Paragraph style={styles.emptyInfoText}>No hay modelos internos registrados</Paragraph>
                            </View>
                          )}

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

                          {conector.tool_sw && conector.tool_sw.length > 0 && (
                            <View style={styles.infoSection}>
                              <Paragraph style={styles.infoLabel}>
                                Tool SW ({conector.tool_sw.length}):
                              </Paragraph>
                              <View style={styles.chipsContainer}>
                                {conector.tool_sw.map((tool, i) => (
                                  <Chip key={i} style={styles.toolChip} textStyle={styles.chipText}>{tool}</Chip>
                                ))}
                              </View>
                            </View>
                          )}

                          {index < filteredConectores.length - 1 && (
                            <Divider style={styles.conectorDivider} />
                          )}
                        </View>
                      ))
                    ) : (
                      <Paragraph style={styles.emptyText}>
                        {selectedConectorInterno
                          ? `No hay conectores para "${selectedConectorInterno}"`
                          : 'No se encontró información para este modelo de mainboard.'}
                      </Paragraph>
                    )}

                    {/* Seccion Arduino */}
                    <Divider style={styles.divider} />
                    <View style={styles.arduinoSection}>
                      <View style={styles.arduinoHeader}>
                        <Chip icon="memory" style={styles.arduinoChip} textStyle={styles.chipText}>
                          Arduino
                        </Chip>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {arduinoModelosInternos.length > 0 && (
                            <Button
                              mode="outlined"
                              compact
                              icon="filter-variant"
                              onPress={() => setShowArduinoFilterModal(true)}
                              textColor="#B0B0B0"
                              style={styles.filterButton}
                            >
                              {selectedArduinoInterno || 'Filtrar'}
                            </Button>
                          )}
                          {canEditArduino && (
                            <Button
                              mode="contained"
                              compact
                              onPress={() => {
                                setArduinoForm(prev => ({ ...prev, modelo: selectedModel?.modelo_mainboard || '' }));
                                setShowArduinoDialog(true);
                              }}
                              buttonColor="#37474F"
                              textColor="#FFFFFF"
                              style={styles.addArduinoButton}
                            >
                              Agregar
                            </Button>
                          )}
                        </View>
                      </View>
                      {selectedArduinoInterno && (
                        <View style={styles.activeFilterRow}>
                          <Chip
                            icon="close-circle"
                            style={styles.activeFilterChip}
                            textStyle={styles.activeFilterChipText}
                            onPress={() => setSelectedArduinoInterno(null)}
                          >
                            {selectedArduinoInterno}
                          </Chip>
                        </View>
                      )}
                      {filteredArduino.length > 0 ? (
                        filteredArduino.map((seq, i, arr) => (
                          <View key={seq.id || i} style={styles.arduinoItem}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1 }}>
                                <Paragraph style={styles.arduinoField}>
                                  Modelo interno: <Paragraph style={styles.arduinoValue}>{seq.modelo_interno}</Paragraph>
                                </Paragraph>
                                <Paragraph style={styles.arduinoField}>
                                  Destino: <Paragraph style={styles.arduinoValue}>{seq.destino}</Paragraph>
                                </Paragraph>
                                <Paragraph style={styles.arduinoField}>
                                  Comando: <Paragraph style={styles.arduinoValue}>{seq.comando}</Paragraph>
                                </Paragraph>
                              </View>
                              {canEditArduino && seq.id && (
                                <IconButton
                                  icon="delete-outline"
                                  iconColor="#EF5350"
                                  size={20}
                                  onPress={() => handleDeleteArduino(seq.id)}
                                  style={{ margin: -4 }}
                                />
                              )}
                            </View>
                            {seq.pais ? (
                              <View style={styles.chipsContainer}>
                                {seq.pais.split(',').map((p, j) => (
                                  <Chip key={j} style={styles.paisChip} textStyle={styles.paisChipText}>{p.trim()}</Chip>
                                ))}
                              </View>
                            ) : null}
                            {i < arr.length - 1 && <Divider style={styles.arduinoDivider} />}
                          </View>
                        ))
                      ) : (
                        <Paragraph style={styles.arduinoNA}>
                          {selectedArduinoInterno
                            ? `Sin secuencias para "${selectedArduinoInterno}"`
                            : 'Sin secuencias Arduino registradas'}
                        </Paragraph>
                      )}
                    </View>

                    {/* Seccion Historial */}
                    <Divider style={styles.divider} />
                    <View style={styles.historialSection}>
                      <View style={styles.historialHeader}>
                        <Chip icon="history" style={styles.historialChip} textStyle={styles.chipText}>
                          Historial
                        </Chip>
                        <Button
                          mode="contained"
                          compact
                          onPress={() => setShowObsDialog(true)}
                          buttonColor="#37474F"
                          textColor="#FFFFFF"
                          style={styles.addObsButton}
                        >
                          + Agregar
                        </Button>
                      </View>
                      {loadingObs ? (
                        <ActivityIndicator size="small" color="#2196F3" style={{ marginTop: 8 }} />
                      ) : observaciones.length > 0 ? (
                        observaciones.map((obs, i, arr) => (
                          <View key={obs.id} style={styles.obsItem}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1 }}>
                                <Paragraph style={styles.obsTexto}>{obs.texto}</Paragraph>
                                <View style={styles.obsMetaRow}>
                                  <Paragraph style={styles.obsMeta}>{obs.tecnico_nombre || 'Usuario'}</Paragraph>
                                  <Paragraph style={styles.obsMetaDot}> · </Paragraph>
                                  <Paragraph style={styles.obsMeta}>{formatDate(obs.created_at)}</Paragraph>
                                </View>
                                {obs.foto && (
                                  <Button
                                    compact
                                    mode="outlined"
                                    icon="image"
                                    onPress={() => { setFotoViewUri(obs.foto); setShowFotoViewModal(true); }}
                                    textColor="#2196F3"
                                    style={styles.verFotoObsBtn}
                                  >
                                    Ver foto
                                  </Button>
                                )}
                              </View>
                              {canDeleteObs && (
                                <IconButton
                                  icon="delete-outline"
                                  iconColor="#EF5350"
                                  size={18}
                                  onPress={() => handleDeleteObs(obs.id)}
                                  style={{ margin: -4 }}
                                />
                              )}
                            </View>
                            {i < arr.length - 1 && <Divider style={styles.arduinoDivider} />}
                          </View>
                        ))
                      ) : (
                        <Paragraph style={styles.arduinoNA}>Sin observaciones registradas</Paragraph>
                      )}
                    </View>

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

      {/* Modal Agregar Secuencia Arduino */}
      <Modal
        visible={showArduinoDialog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowArduinoDialog(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowArduinoDialog(false)}
          />
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Agregar Secuencia Arduino</Title>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TextInput
                label="Modelo Mainboard"
                value={arduinoForm.modelo || selectedModel?.modelo_mainboard || ''}
                mode="outlined"
                style={styles.dialogInput}
                dense
                disabled
                textColor="#AAAAAA"
                outlineColor="#333333"
              />
              <TextInput
                label="Modelo interno"
                value={arduinoForm.modelo_interno}
                onChangeText={(text) => setArduinoForm(prev => ({ ...prev, modelo_interno: text }))}
                mode="outlined"
                style={styles.dialogInput}
                dense
                textColor="#F5F5F5"
                outlineColor="#333333"
                activeOutlineColor="#2196F3"
              />
              <TextInput
                label="Destino"
                value={arduinoForm.destino}
                onChangeText={(text) => setArduinoForm(prev => ({ ...prev, destino: text }))}
                mode="outlined"
                style={styles.dialogInput}
                dense
                textColor="#F5F5F5"
                outlineColor="#333333"
                activeOutlineColor="#2196F3"
              />
              <TextInput
                label="Comando"
                value={arduinoForm.comando}
                onChangeText={(text) => setArduinoForm(prev => ({ ...prev, comando: text }))}
                mode="outlined"
                style={styles.dialogInput}
                dense
                textColor="#F5F5F5"
                outlineColor="#333333"
                activeOutlineColor="#2196F3"
              />
              <TextInput
                label="País(es) (COL/MEX/GUA/US)"
                value={arduinoForm.pais}
                onChangeText={(text) => setArduinoForm(prev => ({ ...prev, pais: text }))}
                mode="outlined"
                style={styles.dialogInput}
                dense
                textColor="#F5F5F5"
                outlineColor="#333333"
                activeOutlineColor="#2196F3"
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button onPress={() => setShowArduinoDialog(false)} textColor="#B0B0B0" style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleSaveArduino} buttonColor="#2196F3" style={{ flex: 1 }}>Guardar</Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Agregar Observación */}
      <Modal
        visible={showObsDialog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowObsDialog(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowObsDialog(false)}
          />
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Agregar Observación</Title>
            <TextInput
              label="Observación"
              value={newObsText}
              onChangeText={setNewObsText}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={[styles.dialogInput, { minHeight: 100 }]}
              textColor="#F5F5F5"
              outlineColor="#333333"
              activeOutlineColor="#2196F3"
              placeholder="Ej: Necesita resistencia 80 ohms, Mini LVDS config diferente..."
            />
            {newObsFoto ? (
              <TouchableOpacity onPress={() => { setFotoViewUri(newObsFoto); setShowFotoViewModal(true); }} style={styles.obsFotoPreview}>
                <Image source={{ uri: newObsFoto }} style={styles.obsThumbnail} resizeMode="cover" />
                <Button compact mode="text" onPress={() => setNewObsFoto(null)} textColor="#EF5350" icon="close">
                  Quitar foto
                </Button>
              </TouchableOpacity>
            ) : (
              <Button
                mode="outlined"
                icon="camera"
                onPress={handleTakeObsFoto}
                textColor="#2196F3"
                style={{ borderColor: '#2196F3', marginBottom: 8 }}
              >
                Tomar foto
              </Button>
            )}
            <View style={styles.modalActions}>
              <Button
                onPress={() => { setShowObsDialog(false); setNewObsText(''); setNewObsFoto(null); }}
                textColor="#B0B0B0"
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveObs}
                buttonColor="#2196F3"
                loading={savingObs}
                disabled={!newObsText.trim() || savingObs}
                style={{ flex: 1 }}
              >
                Guardar
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Foto viewer a pantalla completa */}
      <Modal
        visible={showFotoViewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFotoViewModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFotoViewModal(false)}>
          <View style={styles.fotoViewOverlay}>
            {fotoViewUri && (
              <Image source={{ uri: fotoViewUri }} style={styles.fotoViewImage} resizeMode="contain" />
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Filtro de Conectores (PCB) - bottom sheet */}
      <Modal
        visible={showConectorFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConectorFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowConectorFilterModal(false)}
          />
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Filtrar Modelo Interno</Title>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterModalItem, !selectedConectorInterno && styles.filterModalItemActive]}
                onPress={() => { setSelectedConectorInterno(null); setShowConectorFilterModal(false); }}
              >
                <Paragraph style={[styles.filterModalItemText, !selectedConectorInterno && styles.filterModalItemTextActive]}>
                  Todos
                </Paragraph>
              </TouchableOpacity>
              {conectorModelosInternos.map(interno => (
                <TouchableOpacity
                  key={interno}
                  style={[styles.filterModalItem, selectedConectorInterno === interno && styles.filterModalItemActive]}
                  onPress={() => { setSelectedConectorInterno(interno); setShowConectorFilterModal(false); }}
                >
                  <Paragraph style={[styles.filterModalItemText, selectedConectorInterno === interno && styles.filterModalItemTextActive]}>
                    {interno}
                  </Paragraph>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button onPress={() => setShowConectorFilterModal(false)} textColor="#B0B0B0" style={{ marginTop: 8 }}>Cerrar</Button>
          </View>
        </View>
      </Modal>

      {/* Filtro de Arduino (MiniSOP) - bottom sheet */}
      <Modal
        visible={showArduinoFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowArduinoFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowArduinoFilterModal(false)}
          />
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Filtrar Arduino</Title>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterModalItem, !selectedArduinoInterno && styles.filterModalItemActive]}
                onPress={() => { setSelectedArduinoInterno(null); setShowArduinoFilterModal(false); }}
              >
                <Paragraph style={[styles.filterModalItemText, !selectedArduinoInterno && styles.filterModalItemTextActive]}>
                  Todos
                </Paragraph>
              </TouchableOpacity>
              {arduinoModelosInternos.map(interno => (
                <TouchableOpacity
                  key={interno}
                  style={[styles.filterModalItem, selectedArduinoInterno === interno && styles.filterModalItemActive]}
                  onPress={() => { setSelectedArduinoInterno(interno); setShowArduinoFilterModal(false); }}
                >
                  <Paragraph style={[styles.filterModalItemText, selectedArduinoInterno === interno && styles.filterModalItemTextActive]}>
                    {interno}
                  </Paragraph>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button onPress={() => setShowArduinoFilterModal(false)} textColor="#B0B0B0" style={{ marginTop: 8 }}>Cerrar</Button>
          </View>
        </View>
      </Modal>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionChip: {
    backgroundColor: '#37474F',
    alignSelf: 'flex-start',
  },
  mainboardChip: {
    backgroundColor: '#37474F',
  },
  mainboardChipText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  filterButton: {
    borderColor: '#555555',
    borderRadius: 8,
  },
  activeFilterRow: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  activeFilterChip: {
    backgroundColor: '#37474F',
  },
  activeFilterChipText: {
    color: '#E0E0E0',
    fontSize: 13,
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
  conectorHeaderInner: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  conectorDescText: {
    color: '#888888',
    fontSize: 12,
    marginLeft: 4,
  },
  conectorChip: {
    backgroundColor: '#37474F',
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
    backgroundColor: '#37474F',
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
  emptyInfoText: {
    color: '#888888',
    fontSize: 14,
  },
  arduinoSection: {
    marginTop: 8,
  },
  arduinoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arduinoChip: {
    backgroundColor: '#37474F',
    alignSelf: 'flex-start',
  },
  addArduinoButton: {
    borderRadius: 8,
  },
  filterModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 8,
    backgroundColor: '#2A2A2A',
  },
  filterModalItemActive: {
    borderColor: '#2196F3',
    backgroundColor: '#1B2A44',
  },
  filterModalItemText: {
    color: '#E0E0E0',
    fontSize: 15,
    fontWeight: '600',
  },
  filterModalItemTextActive: {
    color: '#FFFFFF',
  },
  filterModalItemCount: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '600',
  },
  arduinoItem: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  arduinoField: {
    color: '#B0B0B0',
    fontSize: 13,
    marginBottom: 2,
  },
  arduinoValue: {
    color: '#E0E0E0',
    fontWeight: '600',
  },
  arduinoNA: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
  },
  arduinoDivider: {
    backgroundColor: '#444444',
    marginTop: 10,
    marginBottom: 4,
  },
  paisChip: {
    backgroundColor: '#37474F',
    marginRight: 6,
    marginTop: 4,
  },
  paisChipText: {
    color: '#E0E0E0',
    fontSize: 12,
    fontWeight: '600',
  },
  // Historial
  historialSection: {
    marginTop: 8,
  },
  historialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historialChip: {
    backgroundColor: '#37474F',
    alignSelf: 'flex-start',
  },
  addObsButton: {
    borderRadius: 8,
  },
  obsItem: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  obsTexto: {
    color: '#E0E0E0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  obsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  obsMeta: {
    color: '#888888',
    fontSize: 12,
  },
  obsMetaDot: {
    color: '#888888',
    fontSize: 12,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  dialog: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
  },
  dialogTitle: {
    color: '#FFFFFF',
  },
  dialogInput: {
    marginBottom: 10,
    backgroundColor: '#2A2A2A',
  },
  obsFotoPreview: {
    alignItems: 'center',
    marginBottom: 8,
  },
  obsThumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 4,
  },
  verFotoObsBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderColor: '#2196F3',
  },
  fotoViewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoViewImage: {
    width: '100%',
    height: '80%',
  },
});
