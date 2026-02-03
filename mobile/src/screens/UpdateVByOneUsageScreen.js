import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Chip, Paragraph, TextInput, Title } from 'react-native-paper';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { adaptadorService } from '../services/AdaptadorService';
import { useAuth } from '../contexts/AuthContext';

export default function UpdateVByOneUsageScreen({ route, navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { user } = useAuth();
  const items = route?.params?.items || [];
  const conectorIds = useMemo(() => items.map(item => item.conectorId).filter(Boolean), [items]);

  const [linea, setLinea] = useState('');
  const [turno, setTurno] = useState(user?.turno_actual || 'A');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!conectorIds.length) {
      Alert.alert('Sin selección', 'No hay Mini LVDS seleccionadas.');
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

    // Calcular el offset de zona horaria (ej: -08:00 para Tijuana)
    const timezoneOffset = -now.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0');
    const offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0');
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    const timezoneString = `${offsetSign}${offsetHours}:${offsetMinutes}`;

    const localISOTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${timezoneString}`;

    const result = await adaptadorService.bulkUpdateConectoresUso(conectorIds, {
      fecha_ok: localISOTime,
      linea: trimmedLinea,
      turno: trimmedTurno
    });
    setSaving(false);

    if (result.success) {
      Alert.alert('Actualizado', 'Se actualizó la fecha de OK, línea y turno.');
      navigation.goBack();
    } else {
      Alert.alert('Error', 'No se pudo actualizar la información.');
    }
  };

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
            <Title style={styles.mainTitle}>Actualizar uso</Title>
            <Paragraph style={styles.subtitle}>
              Elementos seleccionados: {conectorIds.length}
            </Paragraph>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Seleccionadas</Title>
              <View style={styles.chipContainer}>
                {items.map(item => (
                  <Chip key={`${item.conectorId}-${item.numero_adaptador}`} style={styles.itemChip}>
                    #{item.numero_adaptador}
                  </Chip>
                ))}
              </View>
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
            disabled={saving || !conectorIds.length}
            style={styles.saveButton}
            buttonColor="#4CAF50"
          >
            Guardar actualización
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
    fontSize: 26,
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
    fontSize: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemChip: {
    backgroundColor: '#424242',
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
