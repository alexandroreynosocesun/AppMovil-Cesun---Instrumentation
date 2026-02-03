import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  TouchableOpacity,
  Text,
  Switch,
  Modal
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
  Chip,
  Searchbar
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { validationService } from '../services/ValidationService';
import adminService from '../services/AdminService';
import { jigService } from '../services/JigService';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';
import { showAlert } from '../utils/alertUtils';

const { width, height } = Dimensions.get('window');

export default function AssignValidationScreen({ navigation, route }) {
  const { user } = useAuth();
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showConvertidores, setShowConvertidores] = useState(false);
  const [showTecnicoModal, setShowTecnicoModal] = useState(false);
  const [showModeloModal, setShowModeloModal] = useState(false);
  const [showLineaModal, setShowLineaModal] = useState(false);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [modelosConTipos, setModelosConTipos] = useState({}); // Diccionario: {modelo: [tipos]}
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [searchModelo, setSearchModelo] = useState('');
  
  // Líneas disponibles (1 al 6)
  const lineasDisponibles = ['1', '2', '3', '4', '5', '6'];
  
  // Mapeo de tipos a nombres de visualización
  const tipoDisplayNames = {
    'manual': 'Manual',
    'semiautomatico': 'Semiautomático',
    'nuevo_semiautomatico': 'Nuevo Semiautomático',
    'new_semiautomatico': 'Nuevo Semiautomático'
  };
  
  // Crear lista de combinaciones modelo+tipo para el selector
  const modelosConTiposList = Object.keys(modelosConTipos).flatMap(modelo => {
    const tipos = modelosConTipos[modelo] || [];
    return tipos.map(tipo => ({
      modelo,
      tipo,
      displayText: `${modelo} (${tipoDisplayNames[tipo] || tipo})`
    }));
  });

  // Filtrar modelos basado en la búsqueda (buscar en el texto completo incluyendo tipo)
  const modelosFiltrados = modelosConTiposList.filter(item => 
    item.displayText.toLowerCase().includes(searchModelo.toLowerCase())
  );
  
  // Formulario de creación
  const [formData, setFormData] = useState({
    tecnico_id: '',
    modelo: '',
    tipo_jig: '',
    linea: '',
    turno: user?.turno_actual || 'A',
    tools: {
      vbyone: { enabled: false, qty: '0' },
      miniLvds: { enabled: false, qty: '0' },
      lvds2k: { enabled: false, qty: '0' },
      modulos: { enabled: false, qty: '0' }
    },
    convertidores: {
      conv11477: { enabled: false, qty: '0' },
      conv11479: { enabled: false, qty: '0' }
    },
    adaptadores: {
      adapt51: { enabled: false, qty: '0' },
      adapt60_1_1: { enabled: false, qty: '0' },
      adapt60_1_2: { enabled: false, qty: '0' },
      adapt68: { enabled: false, qty: '0' },
      adapt68_1_2: { enabled: false, qty: '0' }
    }
  });
  
  // Obtener tipos disponibles para el modelo seleccionado (después de declarar formData)
  const tiposDisponibles = formData.modelo ? (modelosConTipos[formData.modelo] || []) : [];

  useEffect(() => {
    loadData();
    loadModelos();
  }, []);

  const loadModelos = async () => {
    try {
      setLoadingModelos(true);
      logger.info('🔄 Cargando modelos con tipos disponibles...');
      const result = await jigService.getModelosConTipos();
      if (result.success) {
        const modelosTipos = result.data || {};
        // Extraer lista de modelos para el selector
        const modelosList = Object.keys(modelosTipos);
        setModelos(modelosList);
        setModelosConTipos(modelosTipos);
        logger.info(`✅ Modelos con tipos cargados: ${modelosList.length}`);
        logger.info('📋 Tipos por modelo:', modelosTipos);
      } else {
        logger.error('❌ Error cargando modelos con tipos:', result.error);
        // Fallback al método antiguo si falla
        const fallbackResult = await jigService.getModelos();
        if (fallbackResult.success) {
          setModelos(fallbackResult.data || []);
          logger.warn('⚠️ Usando método antiguo de carga de modelos (sin tipos)');
        } else {
          Alert.alert('Error', `No se pudieron cargar los modelos: ${result.error}`);
        }
      }
    } catch (error) {
      logger.error('❌ Excepción cargando modelos:', error);
      Alert.alert('Error', 'Error al cargar los modelos disponibles');
    } finally {
      setLoadingModelos(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar lista de técnicos usando el endpoint específico
      logger.info('🔄 [loadData] Iniciando carga de técnicos...');
      logger.info('🔄 [loadData] Usuario actual:', user?.usuario, 'tipo:', user?.tipo_usuario);
      
      logger.info('🔄 [loadData] Llamando a adminService.getTecnicos()...');
      const tecnicosResult = await adminService.getTecnicos();
      
      logger.info('✅ [loadData] Respuesta recibida de getTecnicos');
      try {
        logger.info('📡 [loadData] Respuesta completa:', JSON.stringify(tecnicosResult, null, 2));
      } catch (e) {
        logger.info('📡 [loadData] Respuesta (sin serializar):', tecnicosResult);
      }
    
      if (tecnicosResult.success) {
        // El servidor devuelve una respuesta paginada con { items: [...], total: N, ... }
        // o puede devolver directamente un array
        let tecnicosList = [];
        
        if (Array.isArray(tecnicosResult.data)) {
          // Si data es directamente un array
          tecnicosList = tecnicosResult.data;
          logger.info('✅ [loadData] Data es un array directo');
        } else if (tecnicosResult.data?.items && Array.isArray(tecnicosResult.data.items)) {
          // Si data es un objeto paginado con items
          tecnicosList = tecnicosResult.data.items;
          logger.info('✅ [loadData] Data es un objeto paginado, extrayendo items');
        } else {
          // Fallback: intentar usar data como está o array vacío
          tecnicosList = [];
          logger.warn('⚠️ [loadData] Formato de respuesta inesperado:', tecnicosResult.data);
        }
        
        logger.info(`✅ [loadData] Técnicos recibidos del servidor (antes de filtrar): ${tecnicosList.length}`);
        
        // Log de todos los técnicos recibidos con sus tipos
        logger.info('📋 [loadData] Todos los técnicos recibidos:');
        tecnicosList.forEach(t => {
          logger.info(`  - ${t.nombre} (${t.usuario}): tipo_usuario="${t.tipo_usuario}", tipo_tecnico="${t.tipo_tecnico}"`);
        });
        
        // Filtrar solo técnicos con tipo_usuario "tecnico" o "validacion" (sin 's')
        // Excluir explícitamente: ingeniero, asignaciones, admin, gestion, etc.
        // También excluir usuarios específicos aunque tengan tipo_usuario="tecnico"
        const rolesPermitidos = ['tecnico', 'validacion'];
        const rolesExcluidos = ['ingeniero', 'asignaciones', 'admin', 'gestion', 'superadmin', 'inventario'];
        const usuariosExcluidos = ['admin', 'superadmin', 'adminalex', 'inge']; // Usuarios específicos a excluir (case insensitive)
        
        logger.info('🔍 [loadData] Configuración de filtros:');
        logger.info(`  - Roles permitidos: ${rolesPermitidos.join(', ')}`);
        logger.info(`  - Roles excluidos: ${rolesExcluidos.join(', ')}`);
        logger.info(`  - Usuarios excluidos: ${usuariosExcluidos.join(', ')}`);
        
        const tecnicosFiltrados = tecnicosList.filter(t => {
          const tipo = (t.tipo_usuario || '').toLowerCase().trim();
          const usuario = (t.usuario || '').toLowerCase().trim();
          
          // Excluir usuarios específicos (admin, superadmin, etc.) aunque tengan tipo_usuario="tecnico"
          if (usuariosExcluidos.includes(usuario)) {
            logger.info(`❌ [loadData] Excluyendo ${t.nombre} (${t.usuario}) - usuario excluido: "${usuario}"`);
            return false;
          }
          
          // Verificar que NO esté en la lista de roles excluidos (incluye asignaciones)
          if (rolesExcluidos.includes(tipo)) {
            logger.info(`❌ [loadData] Excluyendo ${t.nombre} (${t.usuario}) - tipo excluido: "${tipo}"`);
            return false;
          }
          
          // Verificar que esté en la lista de permitidos
          const permitido = rolesPermitidos.includes(tipo);
          if (permitido) {
            logger.info(`✅ [loadData] Incluyendo ${t.nombre} (${t.usuario}) - tipo: "${tipo}"`);
          } else {
            logger.warn(`⚠️ [loadData] Tipo desconocido para ${t.nombre} (${t.usuario}) - tipo: "${tipo}" - EXCLUYENDO`);
          }
          
          return permitido;
        });
        
        logger.info(`✅ [loadData] Técnicos filtrados (tecnico/validacion): ${tecnicosFiltrados.length}`);
        
        if (tecnicosFiltrados.length > 0) {
          logger.info('👥 [loadData] Lista de técnicos filtrados:');
          tecnicosFiltrados.forEach(t => {
            logger.info(`  ✅ ${t.nombre} (${t.usuario}) - tipo: ${t.tipo_usuario}`);
          });
        } else {
          logger.warn('⚠️ [loadData] No hay técnicos con rol "tecnico" o "validacion"');
        }
        
        setTecnicos(tecnicosFiltrados);
        
        if (tecnicosFiltrados.length === 0) {
          logger.warn('⚠️ [loadData] No hay técnicos disponibles con rol "tecnico" o "validacion"');
          Alert.alert(
            'Información',
            'No hay técnicos disponibles con rol "tecnico" o "validacion" en la base de datos.\n\nSolo se muestran usuarios con estos roles para asignar validaciones.'
          );
        }
      } else {
        logger.error('❌ [loadData] Error cargando técnicos:', tecnicosResult.error);
        logger.error('❌ [loadData] Detalles del error:', JSON.stringify(tecnicosResult, null, 2));
        Alert.alert(
          'Error', 
          `No se pudieron cargar los técnicos.\n\nError: ${tecnicosResult.error}\n\nVerifica que tengas permisos de "asignaciones" y que el servidor esté funcionando.`
        );
      }
    } catch (error) {
      logger.error('❌ [loadData] Excepción al cargar técnicos:', error);
      logger.error('❌ [loadData] Error message:', error.message);
      logger.error('❌ [loadData] Error stack:', error.stack);
      Alert.alert(
        'Error', 
        `Error al cargar técnicos: ${error.message || 'Error desconocido'}\n\nVerifica tu conexión y que el servidor esté funcionando.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleToolsToggle = (tool) => {
    setFormData(prev => ({
      ...prev,
      tools: {
        ...prev.tools,
        [tool]: {
          ...prev.tools[tool],
          enabled: !prev.tools[tool].enabled,
          qty: !prev.tools[tool].enabled ? '1' : '0'
        }
      }
    }));
  };

  const handleToolsQtyChange = (tool, qty) => {
    setFormData(prev => ({
      ...prev,
      tools: {
        ...prev.tools,
        [tool]: {
          ...prev.tools[tool],
          qty: qty
        }
      }
    }));
  };

  const handleConvertidoresToggle = (conv) => {
    setFormData(prev => ({
      ...prev,
      convertidores: {
        ...prev.convertidores,
        [conv]: {
          ...prev.convertidores[conv],
          enabled: !prev.convertidores[conv].enabled,
          qty: !prev.convertidores[conv].enabled ? '1' : '0'
        }
      }
    }));
  };

  const handleConvertidoresQtyChange = (conv, qty) => {
    setFormData(prev => ({
      ...prev,
      convertidores: {
        ...prev.convertidores,
        [conv]: {
          ...prev.convertidores[conv],
          qty: qty
        }
      }
    }));
  };

  const handleAdaptadoresToggle = (adapt) => {
    setFormData(prev => ({
      ...prev,
      adaptadores: {
        ...prev.adaptadores,
        [adapt]: {
          ...prev.adaptadores[adapt],
          enabled: !prev.adaptadores[adapt].enabled,
          qty: !prev.adaptadores[adapt].enabled ? '1' : '0'
        }
      }
    }));
  };

  const handleAdaptadoresQtyChange = (adapt, qty) => {
    setFormData(prev => ({
      ...prev,
      adaptadores: {
        ...prev.adaptadores,
        [adapt]: {
          ...prev.adaptadores[adapt],
          qty: qty
        }
      }
    }));
  };

  const getSelectedTecnico = () => {
    return tecnicos.find(t => t.id.toString() === formData.tecnico_id.toString());
  };

  const validateForm = () => {
    if (!formData.tecnico_id) {
      Alert.alert('Error', 'Selecciona un técnico');
      return false;
    }
    if (!formData.modelo.trim()) {
      Alert.alert('Error', 'Ingresa el modelo');
      return false;
    }
    // Validar tipo - siempre es requerido ahora porque se selecciona junto con el modelo
    const tipos = modelosConTipos[formData.modelo] || [];
    if (tipos.length > 0 && !formData.tipo_jig) {
      Alert.alert('Error', 'Selecciona el tipo de jig');
      return false;
    }
    if (!formData.linea.trim()) {
      Alert.alert('Error', 'Ingresa la línea');
      return false;
    }
    return true;
  };

  const handleCreateValidation = async () => {
    if (!validateForm()) return;

    try {
      setCreating(true);
      
      const selectedTecnico = getSelectedTecnico();
      
      // Construir texto de tools (mostrar "Qty" en lugar de "x10")
      const toolsList = [];
      if (formData.tools.vbyone.enabled && parseInt(formData.tools.vbyone.qty) > 0) {
        toolsList.push(`VbyOne Qty ${formData.tools.vbyone.qty}`);
      }
      if (formData.tools.miniLvds.enabled && parseInt(formData.tools.miniLvds.qty) > 0) {
        toolsList.push(`Mini LVDS Qty ${formData.tools.miniLvds.qty}`);
      }
      if (formData.tools.lvds2k.enabled && parseInt(formData.tools.lvds2k.qty) > 0) {
        toolsList.push(`LVDS 2K Qty ${formData.tools.lvds2k.qty}`);
      }
      if (formData.tools.modulos.enabled && parseInt(formData.tools.modulos.qty) > 0) {
        toolsList.push(`Módulos Qty ${formData.tools.modulos.qty}`);
      }

      // Convertidores
      const convertidoresList = [];
      if (formData.convertidores.conv11477.enabled && parseInt(formData.convertidores.conv11477.qty) > 0) {
        convertidoresList.push(`Convertidor 11477 Qty ${formData.convertidores.conv11477.qty}`);
      }
      if (formData.convertidores.conv11479.enabled && parseInt(formData.convertidores.conv11479.qty) > 0) {
        convertidoresList.push(`Convertidor 11479 Qty ${formData.convertidores.conv11479.qty}`);
      }

      // Adaptadores
      const adaptadoresList = [];
      if (formData.adaptadores.adapt51.enabled && parseInt(formData.adaptadores.adapt51.qty) > 0) {
        adaptadoresList.push(`Adaptador 51 pines Qty ${formData.adaptadores.adapt51.qty}`);
      }
      if (formData.adaptadores.adapt60_1_1.enabled && parseInt(formData.adaptadores.adapt60_1_1.qty) > 0) {
        adaptadoresList.push(`Adaptador 60 pines 1_1 Qty ${formData.adaptadores.adapt60_1_1.qty}`);
      }
      if (formData.adaptadores.adapt60_1_2.enabled && parseInt(formData.adaptadores.adapt60_1_2.qty) > 0) {
        adaptadoresList.push(`Adaptador 60 pines 1_2 Qty ${formData.adaptadores.adapt60_1_2.qty}`);
      }
      if (formData.adaptadores.adapt68.enabled && parseInt(formData.adaptadores.adapt68.qty) > 0) {
        adaptadoresList.push(`Adaptador 68 pines Qty ${formData.adaptadores.adapt68.qty}`);
      }
      if (formData.adaptadores.adapt68_1_2.enabled && parseInt(formData.adaptadores.adapt68_1_2.qty) > 0) {
        adaptadoresList.push(`Adaptador 68 pines 1_2 Qty ${formData.adaptadores.adapt68_1_2.qty}`);
      }

      // Comentario incluye Modelo, Tipo (si existe) y Línea para poder verlo en el estatus
      const partesComentario = [
        `Modelo: ${formData.modelo.trim()}${formData.tipo_jig ? ` (${tipoDisplayNames[formData.tipo_jig] || formData.tipo_jig})` : ''}`,
        `Línea: ${formData.linea}`
      ];
      if (toolsList.length > 0) {
        partesComentario.push(`Emulador de Panel: ${toolsList.join(', ')}`);
      }
      if (convertidoresList.length > 0) {
        partesComentario.push(`Convertidores: ${convertidoresList.join(', ')}`);
      }
      if (adaptadoresList.length > 0) {
        partesComentario.push(`Adaptadores: ${adaptadoresList.join(', ')}`);
      }

      const comentario = partesComentario.join(' | ');

      // Obtener fecha UTC actual desde el cliente
      const fechaActualUTC = new Date().toISOString();
      
      const validationData = {
        // jig_id es null porque no se escanea un jig específico en asignaciones
        jig_id: null,
        turno: formData.turno,
        estado: 'OK',
        comentario: comentario,
        cantidad: 1,
        tecnico_asignado_id: parseInt(formData.tecnico_id),
        modelo_actual: formData.modelo.trim(),
        fecha: fechaActualUTC  // Enviar fecha UTC desde el cliente
      };

      const result = await validationService.createValidation(validationData);
      
      if (result.success) {
        // Las validaciones creadas aparecerán en "Estatus de Validaciones", no aquí
        
        // Resetear formulario (pero mantener técnico seleccionado si se quiere crear otra)
        setFormData({
          tecnico_id: '', // Opcional: mantener el técnico si quieres crear otra para el mismo
          modelo: '',
          tipo_jig: '',
          linea: '',
          turno: user?.turno_actual || 'A',
          tools: {
            vbyone: { enabled: false, qty: '0' },
            miniLvds: { enabled: false, qty: '0' },
            lvds2k: { enabled: false, qty: '0' },
            modulos: { enabled: false, qty: '0' }
          },
          convertidores: {
            conv11477: { enabled: false, qty: '0' },
            conv11479: { enabled: false, qty: '0' }
          },
          adaptadores: {
            adapt51: { enabled: false, qty: '0' },
            adapt60_1_1: { enabled: false, qty: '0' },
            adapt60_1_2: { enabled: false, qty: '0' },
            adapt68: { enabled: false, qty: '0' },
            adapt68_1_2: { enabled: false, qty: '0' }
          }
        });
        setShowTools(false);
        setShowConvertidores(false);
        
        showAlert(
          'Éxito',
          `Validación asignada correctamente al técnico ${selectedTecnico?.nombre}`
        );
      } else {
        Alert.alert('Error', result.error || 'Error creando validación');
      }
    } catch (error) {
      Alert.alert('Error', 'Error creando validación');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const selectedTecnico = getSelectedTecnico();
  const fechaActual = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A1A1A', '#2C2C2C', '#3C3C3C']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Title style={styles.title}>Asignar Validaciones</Title>
            <Paragraph style={styles.subtitle}>
              Crea nuevas validaciones o asigna existentes a técnicos
            </Paragraph>
          </Card.Content>
        </Card>

        {/* Sección: Crear Nueva Validación */}
        <Card style={styles.formCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Crear Nueva Validación</Title>
            <Divider style={styles.divider} />

        {/* Información del Usuario que Asigna */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Asignado por:</Text>
              <Text style={styles.infoValue}>{user?.nombre || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha:</Text>
              <Text style={styles.infoValue}>{fechaActual}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Turno:</Text>
              <View style={styles.turnoChips}>
                {['A', 'B', 'C'].map((turno) => (
                  <Chip
                    key={turno}
                    selected={formData.turno === turno}
                    onPress={() => handleInputChange('turno', turno)}
                    style={styles.turnoChip}
                    selectedColor="#2196F3"
                  >
                    {turno}
                  </Chip>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Formulario de Validación */}
        <Card style={styles.formCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Datos de la Validación</Title>
            <Divider style={styles.divider} />

            {/* Seleccionar Técnico */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.label}>Asignar a Técnico *</Text>
              {tecnicos.length === 0 ? (
                <View style={styles.noTecnicosContainer}>
                  <Text style={styles.noTecnicosText}>
                    No hay técnicos disponibles con rol "validaciones". Verifica que existan usuarios registrados con ese rol.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity 
                  onPress={() => setShowTecnicoModal(true)}
                  activeOpacity={0.7}
                >
                  <View pointerEvents="none">
                    <TextInput
                      label="Seleccionar Técnico"
                      value={formData.tecnico_id ? `${getSelectedTecnico()?.nombre} - #${getSelectedTecnico()?.numero_empleado}` : ''}
                      mode="outlined"
                      style={styles.input}
                      editable={false}
                      theme={{
                        colors: {
                          primary: '#2196F3',
                          background: 'transparent',
                          surface: '#1A1A1A',
                          text: '#FFFFFF',
                          placeholder: '#B0B0B0',
                          onSurface: '#FFFFFF',
                        }
                      }}
                      outlineColor="#3C3C3C"
                      activeOutlineColor="#2196F3"
                      textColor="#FFFFFF"
                      right={<TextInput.Icon icon="chevron-down" color="#888888" />}
                      placeholder="Toca para seleccionar un técnico"
                    />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Modelo con Tipo */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.label}>Modelo *</Text>
              {Object.keys(modelosConTipos).length === 0 && !loadingModelos ? (
                <View style={styles.noTecnicosContainer}>
                  <Text style={styles.noTecnicosText}>
                    No hay modelos disponibles. Verifica que existan jigs registrados con modelos.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity 
                  onPress={() => setShowModeloModal(true)}
                  activeOpacity={0.7}
                >
                  <View pointerEvents="none">
                    <TextInput
                      label="Seleccionar Modelo"
                      value={formData.modelo && formData.tipo_jig 
                        ? `${formData.modelo} (${tipoDisplayNames[formData.tipo_jig] || formData.tipo_jig})`
                        : formData.modelo || ''}
                      mode="outlined"
                      style={styles.input}
                      editable={false}
                      theme={{
                        colors: {
                          primary: '#2196F3',
                          background: 'transparent',
                          surface: '#1A1A1A',
                          text: '#FFFFFF',
                          placeholder: '#B0B0B0',
                          onSurface: '#FFFFFF',
                        }
                      }}
                      outlineColor="#3C3C3C"
                      activeOutlineColor="#2196F3"
                      textColor="#FFFFFF"
                      right={<TextInput.Icon icon="chevron-down" color="#888888" />}
                      placeholder="Toca para seleccionar un modelo"
                    />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Línea */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.label}>Línea *</Text>
              <TouchableOpacity 
                onPress={() => setShowLineaModal(true)}
                activeOpacity={0.7}
              >
                <View pointerEvents="none">
                  <TextInput
                    label="Seleccionar Línea"
                    value={formData.linea}
                    mode="outlined"
                    style={styles.input}
                    editable={false}
                    theme={{
                      colors: {
                        primary: '#2196F3',
                        background: 'transparent',
                        surface: '#1A1A1A',
                        text: '#FFFFFF',
                        placeholder: '#B0B0B0',
                        onSurface: '#FFFFFF',
                      }
                    }}
                    outlineColor="#3C3C3C"
                    activeOutlineColor="#2196F3"
                    textColor="#FFFFFF"
                    right={<TextInput.Icon icon="chevron-down" color="#888888" />}
                    placeholder="Toca para seleccionar una línea (1-6)"
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Toggle para Tools */}
            <View style={styles.toolsToggleContainer}>
              <Text style={styles.label}>Agregar Emulador de Panel</Text>
              <Switch
                value={showTools}
                onValueChange={setShowTools}
                trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                thumbColor={showTools ? '#FFFFFF' : '#B0B0B0'}
              />
            </View>

            {/* Campos de Tools (solo si está activado) */}
            {showTools && (
              <View style={styles.toolsContainer}>
                {/* VbyOne */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.tools.vbyone.enabled}
                      onValueChange={() => handleToolsToggle('vbyone')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.tools.vbyone.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>VbyOne</Text>
                  </View>
                  {formData.tools.vbyone.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.vbyone.qty) || 0;
                            if (currentQty > 0) {
                              handleToolsQtyChange('vbyone', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.tools.vbyone.qty}
                          onChangeText={(text) => handleToolsQtyChange('vbyone', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.vbyone.qty) || 0;
                            handleToolsQtyChange('vbyone', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Mini LVDS */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.tools.miniLvds.enabled}
                      onValueChange={() => handleToolsToggle('miniLvds')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.tools.miniLvds.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>Mini LVDS</Text>
                  </View>
                  {formData.tools.miniLvds.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.miniLvds.qty) || 0;
                            if (currentQty > 0) {
                              handleToolsQtyChange('miniLvds', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.tools.miniLvds.qty}
                          onChangeText={(text) => handleToolsQtyChange('miniLvds', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.miniLvds.qty) || 0;
                            handleToolsQtyChange('miniLvds', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* LVDS 2K */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.tools.lvds2k.enabled}
                      onValueChange={() => handleToolsToggle('lvds2k')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.tools.lvds2k.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>LVDS 2K</Text>
                  </View>
                  {formData.tools.lvds2k.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.lvds2k.qty) || 0;
                            if (currentQty > 0) {
                              handleToolsQtyChange('lvds2k', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.tools.lvds2k.qty}
                          onChangeText={(text) => handleToolsQtyChange('lvds2k', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.lvds2k.qty) || 0;
                            handleToolsQtyChange('lvds2k', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Modulos */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.tools.modulos.enabled}
                      onValueChange={() => handleToolsToggle('modulos')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.tools.modulos.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>Modulos</Text>
                  </View>
                  {formData.tools.modulos.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.modulos.qty) || 0;
                            if (currentQty > 0) {
                              handleToolsQtyChange('modulos', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.tools.modulos.qty}
                          onChangeText={(text) => handleToolsQtyChange('modulos', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.tools.modulos.qty) || 0;
                            handleToolsQtyChange('modulos', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Toggle para Convertidores y Adaptadores */}
            <View style={styles.toolsToggleContainer}>
              <Text style={styles.label}>Agregar Convertidores y Adaptadores</Text>
              <Switch
                value={showConvertidores}
                onValueChange={setShowConvertidores}
                trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                thumbColor={showConvertidores ? '#FFFFFF' : '#B0B0B0'}
              />
            </View>

            {/* Campos de Convertidores y Adaptadores (solo si está activado) */}
            {showConvertidores && (
              <View style={styles.toolsContainer}>
                {/* Convertidores */}
                <Text style={styles.subsectionTitle}>Convertidores</Text>
                
                {/* Convertidor 11477 */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.convertidores.conv11477.enabled}
                      onValueChange={() => handleConvertidoresToggle('conv11477')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.convertidores.conv11477.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>Convertidor 11477</Text>
                  </View>
                  {formData.convertidores.conv11477.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.convertidores.conv11477.qty) || 0;
                            if (currentQty > 0) {
                              handleConvertidoresQtyChange('conv11477', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.convertidores.conv11477.qty}
                          onChangeText={(text) => handleConvertidoresQtyChange('conv11477', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.convertidores.conv11477.qty) || 0;
                            handleConvertidoresQtyChange('conv11477', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Convertidor 11479 */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.convertidores.conv11479.enabled}
                      onValueChange={() => handleConvertidoresToggle('conv11479')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.convertidores.conv11479.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>Convertidor 11479</Text>
                  </View>
                  {formData.convertidores.conv11479.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.convertidores.conv11479.qty) || 0;
                            if (currentQty > 0) {
                              handleConvertidoresQtyChange('conv11479', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.convertidores.conv11479.qty}
                          onChangeText={(text) => handleConvertidoresQtyChange('conv11479', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.convertidores.conv11479.qty) || 0;
                            handleConvertidoresQtyChange('conv11479', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <Divider style={styles.divider} />

                {/* Adaptadores */}
                <Text style={styles.subsectionTitle}>Adaptadores</Text>

                {/* Adaptador 51 pines */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.adaptadores.adapt51.enabled}
                      onValueChange={() => handleAdaptadoresToggle('adapt51')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.adaptadores.adapt51.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>51 pines</Text>
                  </View>
                  {formData.adaptadores.adapt51.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt51.qty) || 0;
                            if (currentQty > 0) {
                              handleAdaptadoresQtyChange('adapt51', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.adaptadores.adapt51.qty}
                          onChangeText={(text) => handleAdaptadoresQtyChange('adapt51', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt51.qty) || 0;
                            handleAdaptadoresQtyChange('adapt51', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Adaptador 60 pines 1_1 */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.adaptadores.adapt60_1_1.enabled}
                      onValueChange={() => handleAdaptadoresToggle('adapt60_1_1')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.adaptadores.adapt60_1_1.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>60 pines 1_1</Text>
                  </View>
                  {formData.adaptadores.adapt60_1_1.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt60_1_1.qty) || 0;
                            if (currentQty > 0) {
                              handleAdaptadoresQtyChange('adapt60_1_1', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.adaptadores.adapt60_1_1.qty}
                          onChangeText={(text) => handleAdaptadoresQtyChange('adapt60_1_1', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt60_1_1.qty) || 0;
                            handleAdaptadoresQtyChange('adapt60_1_1', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Adaptador 60 pines 1_2 */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.adaptadores.adapt60_1_2.enabled}
                      onValueChange={() => handleAdaptadoresToggle('adapt60_1_2')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.adaptadores.adapt60_1_2.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>60 pines 1_2</Text>
                  </View>
                  {formData.adaptadores.adapt60_1_2.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt60_1_2.qty) || 0;
                            if (currentQty > 0) {
                              handleAdaptadoresQtyChange('adapt60_1_2', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.adaptadores.adapt60_1_2.qty}
                          onChangeText={(text) => handleAdaptadoresQtyChange('adapt60_1_2', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt60_1_2.qty) || 0;
                            handleAdaptadoresQtyChange('adapt60_1_2', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Adaptador 68 pines */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.adaptadores.adapt68.enabled}
                      onValueChange={() => handleAdaptadoresToggle('adapt68')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.adaptadores.adapt68.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>68 pines</Text>
                  </View>
                  {formData.adaptadores.adapt68.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt68.qty) || 0;
                            if (currentQty > 0) {
                              handleAdaptadoresQtyChange('adapt68', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.adaptadores.adapt68.qty}
                          onChangeText={(text) => handleAdaptadoresQtyChange('adapt68', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt68.qty) || 0;
                            handleAdaptadoresQtyChange('adapt68', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Adaptador 68 pines 1_2 */}
                <View style={styles.toolRow}>
                  <View style={styles.toolLeft}>
                    <Switch
                      value={formData.adaptadores.adapt68_1_2.enabled}
                      onValueChange={() => handleAdaptadoresToggle('adapt68_1_2')}
                      trackColor={{ false: '#3C3C3C', true: '#2196F3' }}
                      thumbColor={formData.adaptadores.adapt68_1_2.enabled ? '#FFFFFF' : '#B0B0B0'}
                    />
                    <Text style={styles.toolLabel}>68 pines 1_2</Text>
                  </View>
                  {formData.adaptadores.adapt68_1_2.enabled && (
                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyLabel}>Qty:</Text>
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt68_1_2.qty) || 0;
                            if (currentQty > 0) {
                              handleAdaptadoresQtyChange('adapt68_1_2', (currentQty - 1).toString());
                            }
                          }}
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={formData.adaptadores.adapt68_1_2.qty}
                          onChangeText={(text) => handleAdaptadoresQtyChange('adapt68_1_2', text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          style={styles.qtyInput}
                          theme={{
                            colors: {
                              text: '#FFFFFF',
                            }
                          }}
                          contentStyle={{ color: '#FFFFFF', textAlign: 'center' }}
                        />
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => {
                            const currentQty = parseInt(formData.adaptadores.adapt68_1_2.qty) || 0;
                            handleAdaptadoresQtyChange('adapt68_1_2', (currentQty + 1).toString());
                          }}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Botón Crear */}
            <Button
              mode="contained"
              onPress={handleCreateValidation}
              loading={creating}
              disabled={creating}
              style={styles.createButton}
              buttonColor="#2196F3"
            >
              Crear y Asignar Validación
            </Button>
          </Card.Content>
        </Card>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Modal para seleccionar técnico */}
      <Modal
        visible={showTecnicoModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowTecnicoModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView 
              style={styles.modalScrollContainer}
              contentContainerStyle={styles.modalListContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {loading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color="#2196F3" size="small" />
                  <Text style={styles.emptyStateText}>Cargando técnicos...</Text>
                </View>
              ) : tecnicos.length > 0 ? (
                tecnicos.map((tecnico, index) => {
                  const isSelected = formData.tecnico_id === tecnico.id.toString();
                  return (
                    <TouchableOpacity
                      key={`tecnico-${tecnico.id}-${index}`}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                        if (isSelected) {
                          handleInputChange('tecnico_id', '');
                        } else {
                          handleInputChange('tecnico_id', tecnico.id.toString());
                        }
                        setShowTecnicoModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalItemContent}>
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                          {tecnico.nombre}
                        </Text>
                        <Text style={[styles.modalItemSubtext, isSelected && styles.modalItemSubtextSelected]}>
                          #{tecnico.numero_empleado || 'N/A'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No hay técnicos disponibles</Text>
                </View>
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowTecnicoModal(false);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar modelo */}
      <Modal
        visible={showModeloModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowModeloModal(false);
          setSearchModelo('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Buscador de modelos */}
            <View style={styles.modalSearchContainer}>
              <Searchbar
                placeholder="Buscar modelo..."
                onChangeText={setSearchModelo}
                value={searchModelo}
                style={styles.modalSearchbar}
                inputStyle={styles.modalSearchbarInput}
                iconColor="#888888"
                theme={{
                  colors: {
                    primary: '#2196F3',
                    background: '#1A1A1A',
                    surface: '#2C2C2C',
                    text: '#FFFFFF',
                    placeholder: '#B0B0B0',
                    onSurface: '#FFFFFF',
                  }
                }}
              />
            </View>
            
            <ScrollView 
              style={styles.modalScrollContainer}
              contentContainerStyle={styles.modalListContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {loadingModelos ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color="#2196F3" size="small" />
                  <Text style={styles.emptyStateText}>Cargando modelos...</Text>
                </View>
              ) : !searchModelo.trim() ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    Escribe en el buscador para buscar modelos
                  </Text>
                </View>
              ) : modelosFiltrados.length > 0 ? (
                modelosFiltrados.map((item, index) => {
                  const isSelected = formData.modelo === item.modelo && formData.tipo_jig === item.tipo;
                  return (
                    <TouchableOpacity
                      key={`modelo-tipo-${item.modelo}-${item.tipo}-${index}`}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        // Al seleccionar una combinación modelo+tipo, asignar ambos directamente
                        if (!isSelected) {
                          handleInputChange('modelo', item.modelo);
                          handleInputChange('tipo_jig', item.tipo);
                          setShowModeloModal(false);
                          setSearchModelo('');
                        } else {
                          // Deseleccionar
                          handleInputChange('modelo', '');
                          handleInputChange('tipo_jig', '');
                          setShowModeloModal(false);
                          setSearchModelo('');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalItemContent}>
                        <Text style={[styles.modalItemTextSmall, isSelected && styles.modalItemTextSelected]}>
                          {item.displayText}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No se encontraron modelos
                  </Text>
                </View>
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowModeloModal(false);
                setSearchModelo('');
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar tipo de jig */}
      <Modal
        visible={showTipoModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowTipoModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <View style={styles.modalGridContainer}>
              {tiposDisponibles.map((tipo, index) => {
                const isSelected = formData.tipo_jig === tipo;
                return (
                  <TouchableOpacity
                    key={`tipo-${tipo}-${index}`}
                    style={[styles.modalGridItem, isSelected && styles.modalGridItemSelected]}
                    onPress={() => {
                      // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                      if (isSelected) {
                        handleInputChange('tipo_jig', '');
                      } else {
                        handleInputChange('tipo_jig', tipo);
                      }
                      setShowTipoModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalGridItemText, isSelected && styles.modalGridItemTextSelected]}>
                      {tipoDisplayNames[tipo] || tipo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowTipoModal(false);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar línea */}
      <Modal
        visible={showLineaModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowLineaModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <View style={styles.modalGridContainer}>
              {lineasDisponibles.map((linea, index) => {
                const isSelected = formData.linea === linea;
                return (
                  <TouchableOpacity
                    key={`linea-${linea}-${index}`}
                    style={[styles.modalGridItem, isSelected && styles.modalGridItemSelected]}
                    onPress={() => {
                      // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                      if (isSelected) {
                        handleInputChange('linea', '');
                      } else {
                        handleInputChange('linea', linea);
                      }
                      setShowLineaModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalGridItemText, isSelected && styles.modalGridItemTextSelected]}>
                      {linea}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowLineaModal(false);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3C',
  },
  infoLabel: {
    color: '#B0B0B0',
    fontSize: 16,
    fontWeight: '600',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  turnoChips: {
    flexDirection: 'row',
    gap: 8,
  },
  turnoChip: {
    backgroundColor: '#3C3C3C',
  },
  formCard: {
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  divider: {
    backgroundColor: '#3C3C3C',
    marginBottom: 20,
  },
  dropdownContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdown: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3C3C3C',
    maxHeight: 200,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3C',
  },
  dropdownOptionSelected: {
    backgroundColor: '#3C3C3C',
  },
  dropdownOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  checkmark: {
    color: '#2196F3',
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#1A1A1A',
    marginBottom: 16,
    color: '#FFFFFF',
  },
  toolsToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  toolsContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3C',
  },
  toolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toolLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  qtyButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3C3C3C',
  },
  qtyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  qtyInput: {
    width: 50,
    height: 36,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 0,
  },
  subsectionTitle: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 12,
  },
  createButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  validationItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  validationInfo: {
    marginBottom: 12,
  },
  validationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  validationSubtext: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 4,
  },
  validationDate: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  assignForm: {
    marginTop: 12,
  },
  assignButton: {
    flex: 1,
  },
  cancelButton: {
    flex: 1,
  },
  selectButton: {
    marginTop: 8,
  },
  noTecnicosText: {
    color: '#FF9800',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
    padding: 12,
  },
  noTecnicosContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
    padding: 16,
    marginTop: 8,
  },
  selectedTecnicoText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    textAlign: 'center',
  },
  asignacionItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  asignacionInfo: {
    flex: 1,
  },
  asignacionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  asignacionLeft: {
    flex: 1,
    marginRight: 12,
  },
  asignacionTecnico: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  asignacionModelo: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 4,
  },
  asignacionFecha: {
    color: '#888888',
    fontSize: 12,
  },
  completadaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3C3C3C',
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completadaButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  checkmarkGreen: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  checkmarkEmpty: {
    color: '#3C3C3C',
    fontSize: 24,
    fontWeight: 'bold',
  },
  completadaBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completadaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    width: '100%',
    maxWidth: 520,
    height: '80%',
    maxHeight: 650,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  modalScrollContainer: {
    flex: 1,
  },
  modalListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#0F0F0F',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  modalItemSelected: {
    backgroundColor: '#1E3A5F',
    borderColor: '#2196F3',
    borderWidth: 2.5,
    elevation: 6,
    shadowColor: '#2196F3',
    shadowOpacity: 0.4,
  },
  modalItemContent: {
    flexDirection: 'column',
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E8E8E8',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  modalItemTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E8E8E8',
    letterSpacing: 0.2,
  },
  modalItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalItemSubtext: {
    fontSize: 13,
    color: '#888888',
    letterSpacing: 0.1,
  },
  modalItemSubtextSelected: {
    color: '#B0D4FF',
  },
  modalCloseButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1.5,
    borderTopColor: '#2A2A2A',
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#888888',
    marginTop: 12,
    textAlign: 'center',
  },
  modalContentSmall: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  modalGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  modalGridItem: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#0F0F0F',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalGridItemSelected: {
    backgroundColor: '#1E3A5F',
    borderColor: '#2196F3',
    borderWidth: 2.5,
    elevation: 6,
    shadowColor: '#2196F3',
    shadowOpacity: 0.4,
  },
  modalGridItemText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8E8E8',
    letterSpacing: 0.2,
  },
  modalGridItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalSearchContainer: {
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalSearchbar: {
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    elevation: 2,
  },
  modalSearchbarInput: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
