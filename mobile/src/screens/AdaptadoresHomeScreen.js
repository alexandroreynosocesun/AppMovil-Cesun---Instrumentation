import React from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Title, Paragraph, Button, IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { useAuth } from '../contexts/AuthContext';

export default function AdaptadoresHomeScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { logout } = useAuth();

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        logout();
      }
    } else {
      Alert.alert(
        'Cerrar Sesión',
        '¿Estás seguro de que quieres cerrar sesión?',
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Cerrar Sesión',
            onPress: logout,
            style: 'destructive'
          }
        ]
      );
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
            <Title style={styles.mainTitle}>Adaptadores y Convertidores</Title>
            <Paragraph style={styles.subtitle}>
              Gestión de adaptadores y convertidores
            </Paragraph>
          </View>

          <Button
            mode="contained"
            icon="qrcode-scan"
            onPress={() => navigation.navigate('QRScannerAdaptadores')}
            style={styles.scanButton}
            contentStyle={styles.scanButtonContent}
            labelStyle={styles.scanButtonLabel}
          >
            Escanear QR
          </Button>

          <View style={styles.buttonsContainer}>
            <Button
              mode="contained"
              icon="cable-data"
              onPress={() => navigation.navigate('ListAdaptadores')}
              style={styles.categoryButton}
              contentStyle={styles.categoryButtonContent}
              labelStyle={styles.categoryButtonLabel}
              buttonColor="#2196F3"
            >
              Adaptadores
            </Button>

            <Button
              mode="contained"
              icon="flash"
              onPress={() => navigation.navigate('ListConvertidores')}
              style={styles.categoryButton}
              contentStyle={styles.categoryButtonContent}
              labelStyle={styles.categoryButtonLabel}
              buttonColor="#FF9800"
            >
              Convertidores
            </Button>

            <Button
              mode="contained"
              icon="magnify"
              onPress={() => navigation.navigate('SearchMainboard')}
              style={styles.categoryButton}
              contentStyle={styles.categoryButtonContent}
              labelStyle={styles.categoryButtonLabel}
              buttonColor="#9C27B0"
            >
              Buscar
            </Button>

            <Button
              mode="contained"
              icon="microchip"
              onPress={() => navigation.navigate('ArduinoSequences')}
              style={styles.categoryButton}
              contentStyle={styles.categoryButtonContent}
              labelStyle={styles.categoryButtonLabel}
              buttonColor="#FF5722"
            >
              Arduino
            </Button>
          </View>
        </ScrollView>
        
        {/* Botón de cerrar sesión en esquina inferior derecha */}
        <TouchableOpacity 
          style={styles.logoutButtonBottomRight}
          onPress={handleLogout}
        >
          <IconButton icon="logout" size={20} iconColor="#F44336" />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
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
  logoutButtonBottomRight: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  logoutButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  scanButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    elevation: 4,
  },
  scanButtonContent: {
    paddingVertical: 16,
  },
  scanButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonsContainer: {
    marginTop: 20,
    gap: 12,
  },
  categoryButton: {
    borderRadius: 12,
    elevation: 4,
  },
  categoryButtonContent: {
    paddingVertical: 16,
  },
  categoryButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

