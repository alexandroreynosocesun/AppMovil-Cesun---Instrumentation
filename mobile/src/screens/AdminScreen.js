import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl
} from 'react-native';
import {
  Button,
  Card,
  Title,
  Paragraph,
  List,
  IconButton,
  FAB,
  Dialog,
  Portal,
  TextInput,
  RadioButton,
  ActivityIndicator,
  Chip
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import AdminService from '../services/AdminService';
import logger from '../utils/logger';

export default function AdminScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Estados para el diálogo de usuario
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    usuario: '',
    nombre: '',
    password: '',
    numero_empleado: ''
  });

  // Cargar datos cuando la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResult, statsResult] = await Promise.all([
        AdminService.getUsers(),
        AdminService.getStats()
      ]);

      if (usersResult.success) {
        // El endpoint devuelve una respuesta paginada con estructura { items, total, page, ... }
        // O puede devolver un array directo (compatibilidad)
        const responseData = usersResult.data;
        let usersData = [];
        
        if (responseData) {
          // Si tiene estructura paginada
          if (responseData.items && Array.isArray(responseData.items)) {
            usersData = responseData.items;
          } 
          // Si es un array directo
          else if (Array.isArray(responseData)) {
            usersData = responseData;
          }
        }
        
        setUsers(usersData);
      } else {
        // Si falla, asegurar que users sea un array vacío
        setUsers([]);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      logger.error('Error cargando datos:', error);
      Alert.alert('Error', 'Error cargando datos');
      // Asegurar que users sea un array vacío en caso de error
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowPassword(false);
    setUserForm({ 
      usuario: '', 
      nombre: '', 
      password: '', 
      numero_empleado: ''
    });
    setShowUserDialog(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowPassword(false);
    setUserForm({
      usuario: user.usuario,
      nombre: user.nombre,
      password: '',
      numero_empleado: user.numero_empleado || ''
    });
    setShowUserDialog(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.usuario || !userForm.nombre || !userForm.numero_empleado) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    if (!editingUser && !userForm.password) {
      Alert.alert('Error', 'La contraseña es requerida para nuevos usuarios');
      return;
    }

    try {
      let result;
      if (editingUser) {
        result = await AdminService.updateUser(editingUser.id, userForm);
      } else {
        result = await AdminService.createUser(userForm);
      }

      if (result.success) {
        Alert.alert(
          'Éxito', 
          editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente',
          [{ text: 'OK', onPress: () => {
            setShowUserDialog(false);
            loadData();
          }}]
        );
        setShowUserDialog(false);
        // Recargar datos inmediatamente
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Error guardando usuario');
      }
    } catch (error) {
      logger.error('Error guardando usuario:', error);
      Alert.alert('Error', error?.response?.data?.detail || error?.message || 'Error guardando usuario');
    }
  };

  const handleDeleteUser = (user) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que quieres eliminar al usuario "${user.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await AdminService.deleteUser(user.id);
              if (result.success) {
                Alert.alert(
                  'Éxito', 
                  'Usuario eliminado correctamente',
                  [{ text: 'OK', onPress: () => loadData() }]
                );
                // Recargar datos inmediatamente
                loadData();
              } else {
                Alert.alert('Error', result.error || 'Error eliminando usuario');
              }
            } catch (error) {
              logger.error('Error eliminando usuario:', error);
              const errorMessage = error?.response?.data?.detail || error?.message || 'Error eliminando usuario';
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Paragraph>Cargando usuarios...</Paragraph>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Estadísticas */}
        {stats && (
          <Card style={styles.statsCard}>
            <Card.Content>
              <Title>Estadísticas del Sistema</Title>
              <View style={styles.statsRow}>
                <Chip icon="account" mode="outlined">
                  Total: {stats.total_users} usuarios
                </Chip>
                <Chip icon="shield-account" mode="outlined">
                  Admins: {stats.admin_users}
                </Chip>
                {stats.pending_requests > 0 && (
                  <Chip icon="account-clock" mode="outlined" style={styles.pendingChip}>
                    {stats.pending_requests} solicitudes pendientes
                  </Chip>
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Botón para gestionar solicitudes */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Title>Gestión de Solicitudes</Title>
            <Button
              mode="contained"
              icon="account-clock"
              onPress={() => navigation.navigate('AdminSolicitudes')}
              style={styles.actionButton}
            >
              Ver Solicitudes de Registro
            </Button>
          </Card.Content>
        </Card>

        {/* Lista de usuarios */}
        <Card style={styles.usersCard}>
          <Card.Content>
            <Title>Usuarios Registrados</Title>
            {!users || users.length === 0 ? (
              <Paragraph>No hay usuarios registrados</Paragraph>
            ) : (
              (Array.isArray(users) ? users : []).map((user) => (
                <List.Item
                  key={user.id}
                  title={user.nombre}
                  description={
                    <View>
                      <Paragraph style={styles.userDescription}>
                        Usuario: {user.usuario} | Empleado: {user.numero_empleado || 'N/A'}
                      </Paragraph>
                      <Paragraph style={styles.userRole}>
                        Rol: {(['admin', 'superadmin'].includes(user.usuario?.toLowerCase())) ? 'admin' : (user.tipo_usuario || 'N/A')}
                      </Paragraph>
                    </View>
                  }
                  left={(props) => <List.Icon {...props} icon="account" />}
                  right={(props) => (
                    <View style={styles.userActions}>
                      <IconButton
                        icon="pencil"
                        size={20}
                        onPress={() => handleEditUser(user)}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => handleDeleteUser(user)}
                      />
                    </View>
                  )}
                />
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Botón flotante para agregar usuario */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleCreateUser}
      />

      {/* Diálogo para crear/editar usuario */}
      <Portal>
        <Dialog visible={showUserDialog} onDismiss={() => setShowUserDialog(false)}>
          <Dialog.Title>
            {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Usuario *"
              value={userForm.usuario}
              onChangeText={(text) => setUserForm({...userForm, usuario: text})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Nombre Completo *"
              value={userForm.nombre}
              onChangeText={(text) => setUserForm({...userForm, nombre: text})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Número de Empleado *"
              value={userForm.numero_empleado}
              onChangeText={(text) => setUserForm({...userForm, numero_empleado: text})}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label={editingUser ? "Nueva Contraseña (opcional)" : "Contraseña *"}
              value={userForm.password}
              onChangeText={(text) => setUserForm({...userForm, password: text})}
              style={styles.input}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowUserDialog(false)}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={handleSaveUser}>
              {editingUser ? 'Actualizar' : 'Crear'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsCard: {
    margin: 20,
    marginBottom: 12,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap'
  },
  pendingChip: {
    backgroundColor: '#FFA500'
  },
  actionsCard: {
    margin: 20,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  actionButton: {
    marginTop: 12,
    borderRadius: 12,
  },
  usersCard: {
    margin: 20,
    marginTop: 12,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  userActions: {
    flexDirection: 'row'
  },
  userDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  input: {
    marginBottom: 20,
    borderRadius: 12,
  }
});
