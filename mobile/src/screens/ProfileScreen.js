import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Text,
  Modal,
  TouchableWithoutFeedback,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getAuthToken } from '../utils/authUtils';
import SignatureScreen from 'react-native-signature-canvas';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  HelperText,
  ActivityIndicator,
  RadioButton,
  Divider
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/AuthService';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const { user, updateProfile, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [signature, setSignature] = useState(user?.firma_digital || '');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [savingSignature, setSavingSignature] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  const [isTestSignature, setIsTestSignature] = useState(false);
  const signatureRef = useRef(null);
  
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    numero_empleado: user?.numero_empleado || '',
    password: '',
    confirmPassword: '',
    turno_actual: user?.turno_actual || 'A'
  });

  // Actualizar formData cuando el usuario cambie
  React.useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || '',
        numero_empleado: user.numero_empleado || '',
        password: '',
        confirmPassword: '',
        turno_actual: user.turno_actual || 'A'
      });
      setSignature(user.firma_digital || '');
      console.log('Usuario actualizado en contexto:', user);
      console.log('Firma del usuario:', user.firma_digital ? 'Presente' : 'Ausente');
      
      // Cargar firma desde almacenamiento seguro
      loadSecureSignature();
    }
  }, [user]);

  const loadSecureSignature = async () => {
    try {
      // Cargar firma desde SecureStore directamente
      const secureSignature = await SecureStore.getItemAsync('user_signature');
      if (secureSignature) {
        setSignature(secureSignature);
        console.log('✅ Firma cargada desde SecureStore');
      }
    } catch (error) {
      console.error('Error cargando firma segura:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return false;
    }
    if (!formData.numero_empleado.trim()) {
      Alert.alert('Error', 'El número de empleado es requerido');
      return false;
    }
    if (formData.password && formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return false;
    }
    if (!signature) {
      Alert.alert('Error', 'Debes crear tu firma digital');
      return false;
    }
    return true;
  };


  const clearSignature = async () => {
    try {
      // Eliminar firma del almacenamiento seguro
      await SecureStore.deleteItemAsync('user_signature');
      console.log('✅ Firma eliminada de SecureStore');
      
      // Limpiar estado local
      setSignature('');
      setSignatureData(null);
      setShowSignatureModal(false);
      
      // Actualizar perfil en el servidor
      const result = await authService.updateProfile({ firma_digital: null });
      if (result.success) {
        updateProfile({ firma_digital: null });
      }
      
      Alert.alert('Éxito', 'Firma eliminada correctamente');
    } catch (error) {
      console.error('Error eliminando firma:', error);
      Alert.alert('Error', 'No se pudo eliminar la firma');
    }
  };

  const openSignatureModal = () => {
    setSignatureData(null); // Empezar con firma vacía
    setIsTestSignature(false); // Resetear estado de prueba al abrir modal
    setShowSignatureModal(true);
  };

  const closeSignatureModal = () => {
    setShowSignatureModal(false);
  };

  const handleSignature = (signature) => {
    console.log('🎯 handleSignature llamado');
    console.log('Firma capturada:', signature);
    console.log('Tipo de firma:', typeof signature);
    console.log('Longitud de firma:', signature ? signature.length : 'null');
    console.log('Contenido de firma:', signature);
    
    // Validación mejorada de la firma
    if (signature && signature.trim() !== '') {
      // Verificar que sea una imagen base64 válida
      const isBase64 = /^data:image\/(png|jpeg|jpg);base64,/.test(signature) || 
                      /^[A-Za-z0-9+/=]+$/.test(signature);
      
      if (isBase64 && signature.length > 100) {
        setSignatureData(signature);
        setIsTestSignature(false); // Es una firma real dibujada
        console.log('✅ Firma real válida guardada en estado');
      } else {
        console.log('❌ Firma inválida - formato o longitud incorrecta');
        Alert.alert(
          'Firma Inválida',
          'La firma debe ser una imagen válida. Por favor, dibuja una firma más completa.',
          [{ text: 'Entendido' }]
        );
        setSignatureData(null);
        setIsTestSignature(false);
      }
    } else {
      console.log('❌ Firma vacía o inválida');
      setSignatureData(null);
      setIsTestSignature(false);
    }
  };

  const handleSignatureChange = (signature) => {
    console.log('🔄 handleSignatureChange llamado');
    console.log('Firma cambiada:', signature);
    console.log('Tipo de firma:', typeof signature);
    console.log('Longitud de firma:', signature ? signature.length : 'null');
    
    // Validación mejorada de la firma
    if (signature && signature.trim() !== '') {
      // Verificar que sea una imagen base64 válida
      const isBase64 = /^data:image\/(png|jpeg|jpg);base64,/.test(signature) || 
                      /^[A-Za-z0-9+/=]+$/.test(signature);
      
      if (isBase64 && signature.length > 100) {
        setSignatureData(signature);
        setIsTestSignature(false); // Es una firma real dibujada
        console.log('✅ Firma real válida actualizada en estado');
        console.log('🔍 isTestSignature establecido a false');
      } else {
        console.log('❌ Firma inválida - formato o longitud incorrecta');
        setSignatureData(null);
        setIsTestSignature(false);
      }
    } else {
      console.log('❌ Firma vacía en onChange');
      setSignatureData(null);
      setIsTestSignature(false);
    }
  };

  const saveSignature = async () => {
    try {
      console.log('🔍 Intentando guardar firma...');
      console.log('signatureData preview:', signatureData?.substring(0, 100) || 'null');
      console.log('Tipo:', typeof signatureData);
      console.log('Longitud:', signatureData ? signatureData.length : 'null');
      
      // Decodificar para verificar el tamaño real
      try {
        const base64Data = signatureData.split(',')[1] || signatureData;
        const binaryString = atob(base64Data);
        console.log('🔍 Tamaño real de la imagen:', binaryString.length, 'bytes');
        console.log('🔍 Preview de datos binarios:', binaryString.substring(0, 50));
      } catch (error) {
        console.error('Error decodificando firma:', error);
      }
      
      // Verificar si hay token válido
      const token = await getAuthToken();
      if (!token) {
        Alert.alert(
          'Sesión Expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          [{ text: 'Entendido', onPress: () => setShowSignatureModal(false) }]
        );
        return;
      }
      
      // Validación mejorada antes de guardar
      if (!signatureData || signatureData.length < 1000) {
        Alert.alert(
          'Firma Inválida',
          'La firma es muy corta o está vacía. Por favor, dibuja una firma más completa.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      // Validación adicional: verificar que no sea una imagen de 1x1 píxel
      try {
        // Decodificar base64 para verificar el tamaño
        const base64Data = signatureData.split(',')[1] || signatureData;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Verificar que no sea una imagen muy pequeña (menos de 200 bytes)
        if (bytes.length < 200) {
          Alert.alert(
            'Firma Inválida',
            'La firma es demasiado pequeña. Por favor, dibuja una firma más grande y clara.',
            [{ text: 'Entendido' }]
          );
          return;
        }
      } catch (error) {
        console.error('Error validando firma:', error);
        Alert.alert(
          'Firma Inválida',
          'No se pudo validar la firma. Por favor, dibuja una nueva firma.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      // Verificar formato base64
      const isBase64 = /^data:image\/(png|jpeg|jpg);base64,/.test(signatureData) || 
                      /^[A-Za-z0-9+/=]+$/.test(signatureData);
      
      if (!isBase64) {
        Alert.alert(
          'Formato Inválido',
          'La firma no tiene un formato válido. Por favor, dibuja una nueva firma.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      console.log('✅ Firma válida - Guardando...');
      setSavingSignature(true);
      setSignature(signatureData);
      
      // Mostrar mensaje de procesamiento
      const message = isTestSignature 
        ? 'La firma de prueba se está procesando y guardando. Esto puede tardar unos segundos...'
        : 'La firma se está procesando y guardando. Esto puede tardar unos segundos...';
        
      Alert.alert(
        'Procesando Firma',
        message,
        [],
        { cancelable: false }
      );
      
      // Guardar la firma de forma segura localmente
      try {
        await SecureStore.setItemAsync('user_signature', signatureData);
        console.log('✅ Firma guardada en SecureStore');
      } catch (error) {
        console.error('Error guardando firma en SecureStore:', error);
        Alert.alert('Error', 'No se pudo guardar la firma de forma segura');
        return;
      }

      // Guardar la firma en el perfil del usuario en el servidor
      const result = await authService.updateProfile({ firma_digital: signatureData });
      if (result.success) {
        updateProfile({ firma_digital: signatureData });
      setShowSignatureModal(false);
        Alert.alert('Éxito', 'Firma guardada correctamente de forma segura');
    } else {
        console.error('Error actualizando perfil:', result.error);
        if (result.error && result.error.includes('401')) {
          Alert.alert(
            'Sesión Expirada',
            'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
            [
              { text: 'Entendido', onPress: () => {
                // Cerrar modal y redirigir al login
                setShowSignatureModal(false);
                // Aquí podrías agregar lógica para cerrar sesión
              }}
            ]
          );
        } else {
          Alert.alert('Error', result.error || 'No se pudo guardar la firma');
        }
      }
      
    } catch (error) {
      console.error('Error al guardar firma:', error);
      if (error.message && error.message.includes('401')) {
        Alert.alert(
          'Sesión Expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          [
            { text: 'Entendido', onPress: () => {
              setShowSignatureModal(false);
            }}
          ]
        );
      } else {
        Alert.alert('Error', 'No se pudo guardar la firma. Verifica tu conexión.');
      }
    } finally {
      setSavingSignature(false);
    }
  };


  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      const updateData = {
        nombre: formData.nombre.trim(),
        numero_empleado: formData.numero_empleado.trim(),
        turno_actual: formData.turno_actual,
        firma_digital: signature
      };

      // Solo incluir password si se proporcionó
      if (formData.password) {
        updateData.password = formData.password;
      }

      console.log('Datos a enviar:', updateData);
      console.log('Turno actual seleccionado:', formData.turno_actual);

      const result = await updateProfile(updateData);
      
      if (result.success) {
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
        setEditing(false);
        // Resetear formulario con los datos actualizados del contexto
        setFormData({
          nombre: user?.nombre || '',
          numero_empleado: user?.numero_empleado || '',
          password: '',
          confirmPassword: '',
          turno_actual: user?.turno_actual || 'A'
        });
        setSignature(user?.firma_digital || '');
      } else {
        Alert.alert('Error', result.error || 'Error al actualizar el perfil');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nombre: user?.nombre || '',
      numero_empleado: user?.numero_empleado || '',
      password: '',
      confirmPassword: '',
      turno_actual: user?.turno_actual || 'A'
    });
    setSignature(user?.firma_digital || '');
    setSignaturePaths([]);
    setEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', onPress: logout }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Información del Usuario */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>👤 Perfil de Usuario</Title>
          
          <View style={styles.userInfo}>
            <View style={styles.userHeader}>
              <Text style={styles.userName}>{user?.nombre || 'Sin nombre'}</Text>
              <Text style={styles.userRole}>{user?.tipo_tecnico || 'Técnico'}</Text>
            </View>
            
            <View style={styles.userDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>👤 Usuario:</Text>
                <Text style={styles.detailValue}>{user?.usuario || 'N/A'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🔢 Empleado:</Text>
                <Text style={styles.detailValue}>{user?.numero_empleado || 'N/A'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>⏰ Turno:</Text>
                <Text style={styles.detailValue}>
                  {user?.turno_actual === 'A' ? 'A - Día (Lun-Jue)' : 
                   user?.turno_actual === 'B' ? 'B - Noche (Lun-Jue)' : 
                   user?.turno_actual === 'C' ? 'C - Fines de semana (Vie-Dom)' : 'N/A'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>✍️ Firma:</Text>
                <Text style={styles.detailValue}>
                  {user?.firma_digital ? '✓ Configurada' : '❌ Sin configurar'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode={editing ? "outlined" : "contained"}
              onPress={() => setEditing(!editing)}
              style={styles.button}
              icon={editing ? "close" : "pencil"}
            >
              {editing ? 'Cancelar Edición' : 'Editar Perfil'}
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleLogout}
              style={[styles.button, styles.logoutButton]}
              textColor="#d32f2f"
              icon="logout"
            >
              Cerrar Sesión
            </Button>
          </View>
        </Card.Content>
      </Card>

      {editing && (
        <>
          {/* Información Personal */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Información Personal</Title>
              
              <TextInput
                label="Nombre Completo *"
                value={formData.nombre}
                onChangeText={(text) => handleInputChange('nombre', text)}
                style={styles.input}
                mode="outlined"
                disabled={loading}
              />
              
              <TextInput
                label="Número de Empleado *"
                value={formData.numero_empleado}
                onChangeText={(text) => handleInputChange('numero_empleado', text)}
                style={styles.input}
                mode="outlined"
                keyboardType="numeric"
                disabled={loading}
              />
            </Card.Content>
          </Card>

          {/* Cambio de Turno */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Turno de Trabajo</Title>
              <Paragraph style={styles.helpText}>
                Selecciona tu turno actual de trabajo según el horario asignado
              </Paragraph>
              
              <View style={styles.radioGroup}>
                <View style={styles.radioItem}>
                  <RadioButton
                    value="A"
                    status={formData.turno_actual === 'A' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'A')}
                    disabled={loading}
                  />
                  <Text style={styles.radioLabel}>Turno A - Día (6:30 AM - 6:30 PM) Lun-Jue</Text>
                </View>
                
                <View style={styles.radioItem}>
                  <RadioButton
                    value="B"
                    status={formData.turno_actual === 'B' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'B')}
                    disabled={loading}
                  />
                  <Text style={styles.radioLabel}>Turno B - Noche (6:30 PM - 6:30 AM) Lun-Jue</Text>
                </View>
                
                <View style={styles.radioItem}>
                  <RadioButton
                    value="C"
                    status={formData.turno_actual === 'C' ? 'checked' : 'unchecked'}
                    onPress={() => handleInputChange('turno_actual', 'C')}
                    disabled={loading}
                  />
                  <Text style={styles.radioLabel}>Turno C - Fines de semana (6:30 AM - 6:30 PM) Vie-Dom</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

          {/* Cambio de Contraseña */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Cambiar Contraseña</Title>
              <Paragraph style={styles.helpText}>
                Deja en blanco si no quieres cambiar la contraseña
              </Paragraph>
              
              <TextInput
                label="Nueva Contraseña"
                value={formData.password}
                onChangeText={(text) => handleInputChange('password', text)}
                style={styles.input}
                mode="outlined"
                secureTextEntry
                disabled={loading}
                placeholder="Mínimo 6 caracteres"
              />
              
              <TextInput
                label="Confirmar Nueva Contraseña"
                value={formData.confirmPassword}
                onChangeText={(text) => handleInputChange('confirmPassword', text)}
                style={styles.input}
                mode="outlined"
                secureTextEntry
                disabled={loading}
                placeholder="Repite la nueva contraseña"
              />
        </Card.Content>
      </Card>

      {/* Firma Digital */}
      <Card style={styles.card}>
        <Card.Content>
              <Title>Firma Digital *</Title>
              <Paragraph style={styles.signatureHelp}>
                Tu firma se usará en todos los reportes PDF generados.
          </Paragraph>
          
              <View style={styles.signaturePreview}>
                {signature ? (
                  <View style={styles.signaturePreviewContent}>
                    <Text style={styles.signaturePreviewText}>✓ Firma capturada</Text>
                    <Text style={styles.signaturePreviewSubtext}>
                      Firma digital configurada
                    </Text>
                    <Button
                      mode="outlined"
                      onPress={() => setShowSignaturePreview(true)}
                      style={styles.viewSignatureButton}
                      icon="eye"
                    >
                      Ver Firma
                    </Button>
            </View>
          ) : (
                  <View style={styles.signaturePreviewContent}>
                    <Text style={styles.signaturePreviewText}>No hay firma</Text>
                    <Text style={styles.signaturePreviewSubtext}>
                      Presiona "Crear Firma" para dibujar
                    </Text>
            </View>
          )}
              </View>
          
              <View style={styles.signatureButtons}>
            <Button
                  mode="contained"
                  onPress={openSignatureModal}
                  style={styles.createSignatureButton}
                  disabled={loading}
                  icon="pencil"
                >
                  {signature ? 'Modificar Firma' : 'Crear Firma'}
            </Button>
                
                {signature && (
            <Button
              mode="outlined"
                    onPress={clearSignature}
                    style={styles.clearSignatureButton}
                    disabled={loading}
                    icon="delete"
                  >
                    Limpiar Firma
            </Button>
                )}
          </View>
        </Card.Content>
      </Card>

          {/* Botones de Acción */}
      <Card style={styles.card}>
        <Card.Content>
              <View style={styles.actionButtons}>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  style={styles.actionSaveButton}
                  disabled={loading}
                  loading={loading}
                >
                  Guardar Cambios
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={styles.actionCancelButton}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </View>
        </Card.Content>
      </Card>
        </>
      )}

      {/* Modal de Firma Digital */}
      <Modal
        visible={showSignatureModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <TouchableWithoutFeedback onPress={closeSignatureModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Title style={styles.modalTitle}>✍️ Crear Firma Digital</Title>
                  <Paragraph style={styles.modalSubtitle}>
                    Dibuja tu firma con trazos continuos y suaves
                  </Paragraph>
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tipText}>💡 Consejo: Dibuja a velocidad normal - los trazos rápidos ahora se capturan como líneas continuas</Text>
                    <Text style={styles.tipText}>⏱️ Nota: El procesamiento de la firma puede tardar unos segundos</Text>
                    <Text style={[styles.tipText, { 
                      color: signatureData?.length >= 100 ? '#4CAF50' : '#FF9800',
                      fontWeight: 'bold'
                    }]}>
                      {!signatureData ? '❌ No hay firma' : 
                       signatureData.length < 100 ? '⚠️ Firma muy corta' : 
                       '✅ Firma lista para guardar'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.modalSignatureContainer}>
                  <SignatureScreen
                    ref={signatureRef}
                    onOK={handleSignature}
                    onChange={handleSignatureChange}
                    onEmpty={() => {
                      console.log('🔄 Firma limpiada');
                      setSignatureData(null);
                      setIsTestSignature(false);
                    }}
                    descriptionText="Dibuja tu firma completa"
                    clearText="Limpiar"
                    confirmText="Guardar"
                    autoClear={false}
                    imageType="image/png"
                    quality={1.0}
                    minWidth={1}
                    maxWidth={3}
                    penColor="#000000"
                    backgroundColor="#ffffff"
                    style={styles.signatureCanvas}
                    webStyle={`
                      .m-signature-pad {
                        border: 2px solid #2196F3;
                        border-radius: 10px;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                      }
                      .m-signature-pad canvas {
                        border-radius: 8px;
                      }
                    `}
                    onBegin={() => {
                      console.log('🖊️ Iniciando dibujo de firma');
                    }}
                    onEnd={() => {
                      console.log('🖊️ Terminando dibujo de firma');
                    }}
                  />
                </View>
                
                <View style={styles.modalButtons}>
          <Button
            mode="outlined"
            onPress={closeSignatureModal}
                    style={styles.modalButton}
            icon="close"
                  >
            Cancelar
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => {
              console.log('🔍 Estado actual de signatureData:', signatureData);
              console.log('🔍 Tipo:', typeof signatureData);
              console.log('🔍 Longitud:', signatureData ? signatureData.length : 'null');
              console.log('🔍 Es firma de prueba:', isTestSignature);
              console.log('🔍 Estado del canvas:', signatureRef.current ? 'Disponible' : 'No disponible');
              Alert.alert(
                'Debug Firma', 
                `Estado: ${signatureData ? 'Capturada' : 'No capturada'}\nTipo: ${typeof signatureData}\nLongitud: ${signatureData ? signatureData.length : 'null'}\nPrueba: ${isTestSignature ? 'Sí' : 'No'}\nCanvas: ${signatureRef.current ? 'Disponible' : 'No disponible'}`
              );
            }}
            style={[styles.modalButton, { backgroundColor: '#FF9800' }]}
            icon="bug"
          >
            Debug Firma
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => {
              const testSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
              setSignatureData(testSignature);
              setIsTestSignature(true); // Marcar como firma de prueba
              console.log('🧪 Firma de prueba establecida');
              Alert.alert(
                'Firma Seleccionada', 
                'Se ha seleccionado una firma de prueba. Ahora puedes guardarla.',
                [{ text: 'OK' }]
              );
            }}
            style={[styles.modalButton, { backgroundColor: '#9C27B0' }]}
            icon="check"
          >
            Seleccionar Firma
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => {
              if (signatureRef.current) {
                signatureRef.current.getData().then((data) => {
                  console.log('🔍 Forzando captura de firma actual:', data);
                  if (data) {
                    handleSignature(data);
                  } else {
                    Alert.alert('Sin Firma', 'No hay firma para capturar');
                  }
                });
              } else {
                Alert.alert('Error', 'Canvas no disponible');
              }
            }}
            style={[styles.modalButton, { backgroundColor: '#FF5722' }]}
            icon="camera"
          >
            Capturar
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => {
              // Limpiar el estado
              setSignatureData(null);
              setIsTestSignature(false);
              console.log('🧹 Firma limpiada del estado');
              
              // Limpiar el canvas del componente SignatureScreen
              if (signatureRef.current) {
                signatureRef.current.clearSignature();
                console.log('🧹 Canvas limpiado');
              }
              
              Alert.alert('Firma Limpiada', 'La firma ha sido eliminada. Puedes dibujar una nueva.');
            }}
            style={[styles.modalButton, { backgroundColor: '#F44336' }]}
            icon="eraser"
          >
            Limpiar Firma
          </Button>
          
          <Button
            mode="contained"
            onPress={() => {
              console.log('🔍 Estado antes de guardar:');
              console.log('🔍 signatureData:', signatureData ? 'Presente' : 'Ausente');
              console.log('🔍 isTestSignature:', isTestSignature);
              console.log('🔍 savingSignature:', savingSignature);
              saveSignature();
            }}
            style={[styles.modalButton, styles.saveButton]}
            icon={savingSignature ? "loading" : "check"}
            disabled={!signatureData || savingSignature || signatureData?.length < 100}
            loading={savingSignature}
          >
            {savingSignature ? 'Procesando...' : signatureData?.length < 100 ? 'Dibuja una firma' : 'Guardar Firma'}
          </Button>
        </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal para Ver Firma Existente */}
      <Modal
        visible={showSignaturePreview}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSignaturePreview(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSignaturePreview(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.signaturePreviewModal}>
                <View style={styles.signaturePreviewHeader}>
                  <Title style={styles.signaturePreviewTitle}>📝 Tu Firma Digital</Title>
                  <Paragraph style={styles.signaturePreviewSubtitle}>
                    Esta es tu firma actual que se usará en los reportes
                  </Paragraph>
                </View>
                
                <View style={styles.signatureImageContainer}>
                  {signature ? (
                    <>
                      <Text style={styles.debugText}>
                        Debug: {signature.substring(0, 50)}...
                      </Text>
                      <Text style={styles.debugText}>
                        Longitud: {signature.length} caracteres
                      </Text>
                      <Text style={styles.debugText}>
                        Formato: {signature.startsWith('data:') ? 'Correcto' : 'Falta prefijo'}
                      </Text>
                      <Text style={[styles.debugText, { color: signature.length < 1000 ? '#F44336' : '#4CAF50' }]}>
                        Estado: {signature.length < 1000 ? '⚠️ Firma muy corta (posiblemente corrupta)' : '✅ Firma válida'}
                      </Text>
                      <Image
                        source={{ uri: signature.startsWith('data:') ? signature : `data:image/png;base64,${signature}` }}
                        style={styles.signatureImage}
                        resizeMode="contain"
                        onLoad={() => console.log('✅ Imagen cargada correctamente')}
                        onError={(error) => {
                          console.log('❌ Error cargando imagen:', error);
                          console.log('URI intentada:', signature.startsWith('data:') ? signature : `data:image/png;base64,${signature}`);
                        }}
                      />
                      <Button
                        mode="outlined"
                        onPress={() => {
                          const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                          setSignature(testImage);
                          Alert.alert('Prueba', 'Imagen de prueba establecida');
                        }}
                        style={styles.testButton}
                        icon="test-tube"
                      >
                        Probar Imagen
                      </Button>
                      
                      <Button
                        mode="outlined"
                        onPress={() => {
                          Alert.alert(
                            'Firma Corrupta',
                            'Tu firma actual parece estar corrupta (muy corta). ¿Quieres crear una nueva firma?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { 
                                text: 'Crear Nueva', 
                                onPress: () => {
                                  setShowSignaturePreview(false);
                                  openSignatureModal();
                                }
                              }
                            ]
                          );
                        }}
                        style={[styles.testButton, { borderColor: '#F44336' }]}
                        icon="alert"
                      >
                        Firma Corrupta - Regenerar
                      </Button>
                    </>
                  ) : (
                    <Text style={styles.noSignatureText}>No hay firma disponible</Text>
                  )}
                </View>
                
                <View style={styles.signaturePreviewButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => setShowSignaturePreview(false)}
                    style={styles.modalButton}
                    icon="close"
                  >
                    Cerrar
          </Button>
          
          <Button
                    mode="contained"
                    onPress={() => {
                      setShowSignaturePreview(false);
                      openSignatureModal();
                    }}
                    style={[styles.modalButton, styles.saveButton]}
                    icon="pencil"
                  >
                    Modificar Firma
          </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  card: {
    marginBottom: 20,
    elevation: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  userInfo: {
    marginBottom: 20,
  },
  userHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  userRole: {
    fontSize: 16,
    color: '#64748B',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  userDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'right',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  logoutButton: {
    borderColor: '#d32f2f',
  },
  input: {
    marginBottom: 20,
    borderRadius: 12,
  },
  helpText: {
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 16,
  },
  signaturePreview: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginVertical: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
    justifyContent: 'center',
  },
  signaturePreviewContent: {
    alignItems: 'center',
    padding: 16,
  },
  signaturePreviewText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0B0B0',
    marginBottom: 4,
  },
  signaturePreviewSubtext: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  signatureHelp: {
    color: '#B0B0B0',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  signatureButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  createSignatureButton: {
    flex: 1,
    marginRight: 8,
  },
  clearSignatureButton: {
    flex: 1,
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: width * 0.9,
    maxHeight: height * 0.8,
    elevation: 10,
  },
  modalHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  tipsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  tipText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalSignatureContainer: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    marginVertical: 16,
    backgroundColor: '#fff',
    height: 250,
  },
  signatureCanvas: {
    flex: 1,
    height: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    // Optimizaciones para trazos rápidos y continuos
    transform: [{ scale: 1 }],
    overflow: 'hidden',
    // Configuraciones de rendimiento para captura rápida
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
    // Mejoras para respuesta táctil
    pointerEvents: 'auto',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionSaveButton: {
    flex: 1,
    marginRight: 8,
  },
  actionCancelButton: {
    flex: 1,
    marginLeft: 8,
  },
  // Estilos para el modal de vista de firma
  signaturePreviewModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: width * 0.9,
    maxHeight: height * 0.7,
    elevation: 10,
  },
  signaturePreviewHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  signaturePreviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1E293B',
  },
  signaturePreviewSubtitle: {
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
  },
  signatureImageContainer: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginVertical: 16,
    backgroundColor: '#F8FAFC',
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  noSignatureText: {
    fontSize: 16,
    color: '#64748B',
    fontStyle: 'italic',
  },
  signaturePreviewButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  viewSignatureButton: {
    marginTop: 8,
    borderColor: '#2196F3',
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  testButton: {
    marginTop: 8,
    borderColor: '#FF9800',
  },
});
