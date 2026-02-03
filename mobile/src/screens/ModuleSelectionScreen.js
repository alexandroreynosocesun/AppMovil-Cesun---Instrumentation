import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Title,
  Paragraph,
  Text
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlatform } from '../hooks/usePlatform';
import { webStyles } from '../utils/webStyles';
import { useLanguage } from '../contexts/LanguageContext';

const { width, height } = Dimensions.get('window');

export default function ModuleSelectionScreen({ navigation }) {
  const { isWeb, maxWidth, containerPadding } = usePlatform();
  const { t } = useLanguage();

  const modules = [
    {
      id: 'jigs',
      title: t('moduleJigs'),
      description: t('moduleJigsDesc'),
      icon: '⚙️',
      color: ['#2196F3', '#1976D2'],
      route: 'Home'
    },
    {
      id: 'adaptadores',
      title: t('moduleAdaptadores'),
      description: t('moduleAdaptadoresDesc'),
      icon: '🔌',
      color: ['#4CAF50', '#388E3C'],
      route: 'AdaptadoresHome'
    },
    {
      id: 'vbyone',
      title: t('moduleVByOne'),
      description: t('moduleVByOneDesc'),
      icon: '📡',
      color: ['#FF9800', '#F57C00'],
      route: 'VByOneHome'
    }
  ];

  const handleModulePress = (module) => {
    if (module.id === 'jigs') {
      navigation.navigate('Home');
    } else if (module.id === 'adaptadores') {
      navigation.navigate('AdaptadoresHome');
    } else if (module.id === 'vbyone') {
      navigation.navigate('VByOneHome');
    } else {
      // Por ahora, mostrar mensaje de "próximamente" para los otros módulos
      alert(t('comingSoon', { module: module.title }));
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
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWeb && { maxWidth: maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: containerPadding }
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Title style={styles.mainTitle}>{t('selectModule')}</Title>
            <Paragraph style={styles.subtitle}>
              {t('selectModuleSubtitle')}
            </Paragraph>
          </View>

          <View style={styles.modulesContainer}>
            {modules.map((module, index) => (
              <TouchableOpacity
                key={module.id}
                activeOpacity={0.8}
                onPress={() => handleModulePress(module)}
                style={styles.moduleCardContainer}
              >
                <Card style={styles.moduleCard}>
                  <LinearGradient
                    colors={module.color}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.moduleIcon}>{module.icon}</Text>
                      <Title style={styles.moduleTitle}>{module.title}</Title>
                      <Paragraph style={styles.moduleDescription}>
                        {module.description}
                      </Paragraph>
                      <View style={styles.arrowContainer}>
                        <Text style={styles.arrow}>→</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Card>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <Paragraph style={styles.footerText}>
              {t('selectModuleToStart')}
            </Paragraph>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
      height: '100%',
    }),
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
    paddingBottom: 40,
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
    }),
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 32,
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
  modulesContainer: {
    gap: 20,
    marginBottom: 30,
  },
  moduleCardContainer: {
    marginBottom: 10,
  },
  moduleCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: 24,
    minHeight: 180,
    justifyContent: 'center',
  },
  cardContent: {
    alignItems: 'center',
  },
  moduleIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  moduleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  moduleDescription: {
    fontSize: 15,
    color: '#F5F5F5',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    opacity: 0.95,
  },
  arrowContainer: {
    marginTop: 8,
  },
  arrow: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
});

