import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/AuthService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar si hay un usuario guardado al iniciar la app
    checkStoredUser();
  }, []);

  const checkStoredUser = async () => {
    try {
      // Cargar datos sensibles desde SecureStore
      const storedUser = await SecureStore.getItemAsync('user_data');
      const storedToken = await SecureStore.getItemAsync('auth_token');
      
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        console.log('✅ Datos de autenticación cargados desde almacenamiento seguro');
      }
    } catch (error) {
      console.error('Error verificando usuario guardado:', error);
      // Fallback a AsyncStorage para migración
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('token');
        
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
          console.log('⚠️ Datos cargados desde AsyncStorage (migración)');
          
          // Migrar a SecureStore
          await SecureStore.setItemAsync('user_data', storedUser);
          await SecureStore.setItemAsync('auth_token', storedToken);
          console.log('✅ Datos migrados a SecureStore');
          
          // Sincronizar token para compatibilidad
          await authService.syncTokenToAsyncStorage();
        }
      } catch (fallbackError) {
        console.error('Error en fallback:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (usuario, password) => {
    try {
      setLoading(true);
      const response = await authService.login(usuario, password);
      
      if (response.success) {
        const { tecnico, access_token } = response.data;
        
        // Guardar datos sensibles en SecureStore
        await SecureStore.setItemAsync('user_data', JSON.stringify(tecnico));
        await SecureStore.setItemAsync('auth_token', access_token);
        
        // Sincronizar token a AsyncStorage para compatibilidad
        await authService.syncTokenToAsyncStorage();
        
        setUser(tecnico);
        setIsAuthenticated(true);
        
        console.log('✅ Datos de autenticación guardados de forma segura');
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: 'Error de conexión' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Eliminar datos sensibles de SecureStore
      await SecureStore.deleteItemAsync('user_data');
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_signature');
      
      // Limpiar también AsyncStorage por compatibilidad
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('✅ Datos de autenticación eliminados de forma segura');
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  const updateProfile = async (updateData) => {
    try {
      console.log('AuthContext - Actualizando perfil con:', updateData);
      const response = await authService.updateProfile(updateData);
      if (response.success) {
        // Aplicar los cambios directamente al usuario actual
        const updatedUser = { ...user, ...updateData };
        console.log('AuthContext - Usuario actualizado:', updatedUser);
        setUser(updatedUser);
        
        // Actualizar datos en SecureStore
        await SecureStore.setItemAsync('user_data', JSON.stringify(updatedUser));
        console.log('✅ Perfil actualizado en almacenamiento seguro');
        
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await authService.getProfile();
      if (response.success) {
        setUser(response.data);
        
        // Actualizar datos en SecureStore
        await SecureStore.setItemAsync('user_data', JSON.stringify(response.data));
        console.log('✅ Perfil refrescado en almacenamiento seguro');
        
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      console.error('Error refrescando perfil:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
