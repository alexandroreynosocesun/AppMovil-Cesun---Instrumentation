import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Chip, Paragraph, TextInput, Title } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { adaptadorService } from '../services/AdaptadorService';
import { useAuth } from '../contexts/AuthContext';

export default function UpdateAdaptadorConectoresScreen({ route, navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const adaptadores = route?.params?.adaptadores || [];

  // Extraer todos los conectores de los adaptadores
  const allConectores = useMemo(() => {
    const conectores = [];
    adaptadores.forEach(adaptador => {
      if (adaptador.conectores) {
        adaptador.conectores.forEach(conector => {
          conectores.push({
            id: conector.id,
            nombre: conector.nombre_conector,
            estado: conector.estado,
            adaptadorNumero: adaptador.numero_adaptador,
            adaptadorModelo: adaptador.modelo_adaptador
          });
        });
      }
    });
    return conectores;
  }, [adaptadores]);

  // Tipos de conectores disponibles
  const tiposConectores = [
    { id: '51', label: '51', pattern: '-51-' },
    { id: '68', label: '68', pattern: '-68-' },
    { id: '4/2', label: '4/2', patterns: ['HD-4', 'HD-2'] },
    { id: '1/3', label: '1/3', patterns: ['HD-1', 'HD-3'] }
  ];

  const [selectedTipos, setSelectedTipos] = useState({});
  const [linea, setLinea] = useState('');
  const [turno, setTurno] = useState(user?.turno_actual || 'A');
  const [saving, setSaving] = useState(false);

  const toggleTipo = (tipoId) => {
    setSelectedTipos(prev => {
      const next = { ...prev };
      if (next[tipoId]) {
        delete next[tipoId];
      } else {
        next[tipoId] = true;
      }
      return next;
    });
  };

  // Obtener conectores que coinciden con los tipos seleccionados
  const getSelectedConectores = () => {
    const selectedConectorIds = [];
    const selectedTiposList = Object.keys(selectedTipos);

    allConectores.forEach(conector => {
      for (const tipoId of selectedTiposList) {
        const tipo = tiposConectores.find(t => t.id === tipoId);
        if (tipo) {
          if (tipo.pattern && conector.nombre.includes(tipo.pattern)) {
            selectedConectorIds.push(conector.id);
            break;
          } else if (tipo.patterns) {
            // Para tipos 4/2 y 1/3, excluir conectores que tengan -51- o -68-
            if (tipo.id === '4/2' || tipo.id === '1/3') {
              const hasPattern = tipo.patterns.some(p => conector.nombre.includes(p));
              const hasFHD = conector.nombre.includes('-51-') || conector.nombre.includes('-68-');
              if (hasPattern && !hasFHD) {
                selectedConectorIds.push(conector.id);
                break;
              }
            } else if (tipo.patterns.some(p => conector.nombre.includes(p))) {
              selectedConectorIds.push(conector.id);
              break;
            }
          }
        }
      }
    });

    return selectedConectorIds;
  };

  // Contar conectores que coinciden con cada tipo
  const getCountForTipo = (tipo) => {
    if (tipo.id === '4/2' || tipo.id === '1/3') {
      // Para parejas, contar cuántos adaptadores tienen este tipo de conector
      const adaptadoresSet = new Set();
      allConectores.forEach(conector => {
        const hasPattern = tipo.patterns.some(p => conector.nombre.includes(p));
        const hasFHD = conector.nombre.includes('-51-') || conector.nombre.includes('-68-');
        if (hasPattern && !hasFHD) {
          adaptadoresSet.add(conector.adaptadorNumero);
        }
      });
      return adaptadoresSet.size;
    }

    // Para tipos 51 y 68, contar conectores individuales
    return allConectores.filter(conector => {
      if (tipo.pattern) {
        return conector.nombre.includes(tipo.pattern);
      } else if (tipo.patterns) {
        return tipo.patterns.some(p => conector.nombre.includes(p));
      }
      return false;
    }).length;
  };

  const handleSave = async () => {
    const selectedIds = getSelectedConectores();

    if (selectedIds.length === 0) {
      Alert.alert('Sin selección', 'Selecciona al menos un tipo de conector.');
      return;
    }

    const trimmedLinea = String(linea || '').trim();
    const trimmedTurno = String(turno || '').trim().toUpperCase();

    if (!trimmedLinea) {
      Alert.alert('Falta línea', 'Ingresa la línea de salida.');
      return;
    }

    // Validar que la línea sea un número del 1 al 6
    const lineaNum = parseInt(trimmedLinea, 10);
    if (isNaN(lineaNum) || lineaNum < 1 || lineaNum > 6) {
      Alert.alert('Línea inválida', 'La línea debe ser un número del 1 al 6.');
      return;
    }

    if (!trimmedTurno) {
      Alert.alert('Falta turno', 'Selecciona el turno.');
      return;
    }

    setSaving(true);

    // Obtener fecha/hora local en formato ISO con offset de zona horaria
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timezoneOffset = -now.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0');
    const offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0');
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    const timezoneString = `${offsetSign}${offsetHours}:${offsetMinutes}`;

    const localISOTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${timezoneString}`;

    const result = await adaptadorService.bulkUpdateConectoresUso(selectedIds, {
      fecha_ok: localISOTime,
      linea: trimmedLinea,
      turno: trimmedTurno
    });

    setSaving(false);

    if (result.success) {
      Alert.alert('Actualizado', `Se actualizaron ${selectedIds.length} conectores.`);
      navigation.goBack();
    } else {
      Alert.alert('Error', 'No se pudo actualizar la información.');
    }
  };

  const selectedCount = getSelectedConectores().length;

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
            <Title style={styles.mainTitle}>Actualizar conectores</Title>
            <Paragraph style={styles.subtitle}>
              Selecciona los tipos de conectores a actualizar
            </Paragraph>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>
                Tipos de conectores
              </Title>
              <Paragraph style={styles.infoText}>
                Se actualizarán todos los conectores del tipo seleccionado en todos los adaptadores
              </Paragraph>

              <View style={styles.tiposContainer}>
                {tiposConectores.map((tipo) => {
                  const isSelected = selectedTipos[tipo.id];
                  const count = getCountForTipo(tipo);

                  return (
                    <View key={tipo.id} style={styles.tipoWrapper}>
                      <Chip
                        selected={isSelected}
                        onPress={() => toggleTipo(tipo.id)}
                        style={[
                          styles.tipoChip,
                          isSelected && styles.tipoChipSelected
                        ]}
                        textStyle={styles.tipoChipText}
                      >
                        {tipo.label}
                      </Chip>
                      <View style={styles.countBadge}>
                        <Paragraph style={styles.countText}>{count}</Paragraph>
                      </View>
                    </View>
                  );
                })}
              </View>

              {selectedCount > 0 && (
                <View style={styles.selectedInfo}>
                  <Paragraph style={styles.selectedInfoText}>
                    Se actualizarán {selectedCount} conector{selectedCount > 1 ? 'es' : ''}
                  </Paragraph>
                </View>
              )}
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Datos de actualización</Title>
              <TextInput
                label="Línea"
                value={linea}
                onChangeText={setLinea}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
                textColor="#FFFFFF"
                placeholderTextColor="#808080"
                outlineColor="#3A3A3A"
                activeOutlineColor="#4CAF50"
                placeholder="Ingresa del 1 al 6"
                right={<TextInput.Affix text="(1-6)" textStyle={{ color: '#808080' }} />}
                theme={{
                  colors: {
                    primary: '#4CAF50',
                    background: '#1E1E1E',
                    surface: '#1E1E1E',
                    text: '#FFFFFF',
                    placeholder: '#808080',
                  }
                }}
              />

              <View style={styles.turnoContainer}>
                <Paragraph style={styles.turnoLabel}>Turno</Paragraph>
                <View style={styles.turnoChips}>
                  {['A', 'B', 'C'].map(item => (
                    <Chip
                      key={item}
                      selected={turno === item}
                      onPress={() => setTurno(item)}
                      style={[styles.turnoChip, turno === item && styles.turnoChipSelected]}
                      textStyle={styles.turnoChipText}
                    >
                      {item}
                    </Chip>
                  ))}
                </View>
              </View>
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving || selectedCount === 0}
            style={styles.saveButton}
            buttonColor="#4CAF50"
          >
            Guardar actualización ({selectedCount})
          </Button>
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
    paddingTop: 16,
    paddingBottom: 80,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#2A2A2A',
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    marginBottom: 8,
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    color: '#B0B0B0',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  tiposContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  tipoWrapper: {
    position: 'relative',
  },
  tipoChip: {
    backgroundColor: '#1E1E1E',
    minWidth: 80,
    paddingHorizontal: 12,
  },
  tipoChipSelected: {
    backgroundColor: '#4CAF50',
  },
  tipoChipText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  countBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedInfo: {
    backgroundColor: '#1E3A1E',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedInfoText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1E1E1E',
    marginBottom: 16,
  },
  turnoContainer: {
    marginBottom: 16,
  },
  turnoLabel: {
    color: '#B0B0B0',
    marginBottom: 8,
  },
  turnoChips: {
    flexDirection: 'row',
    gap: 8,
  },
  turnoChip: {
    backgroundColor: '#1E1E1E',
  },
  turnoChipSelected: {
    backgroundColor: '#4CAF50',
  },
  turnoChipText: {
    color: '#FFFFFF',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 10,
  },
});
