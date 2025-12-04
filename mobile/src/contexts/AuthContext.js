import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/AuthService';
import logger from '../utils/logger';

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
        logger.info('✅ Datos de autenticación cargados desde almacenamiento seguro');

        // Asegurar que el token también esté disponible en AsyncStorage
        // para servicios que leen de allí (por ejemplo, AdminService)
        try {
          await AsyncStorage.setItem('token', storedToken);
          logger.info('✅ Token sincronizado a AsyncStorage al iniciar la app');
        } catch (syncError) {
          logger.error('Error sincronizando token a AsyncStorage al iniciar:', syncError);
        }
      }
    } catch (error) {
      logger.error('Error verificando usuario guardado:', error);
      // Fallback a AsyncStorage para migración
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('token');
        
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
          logger.info('⚠️ Datos cargados desde AsyncStorage (migración)');
          
          // Migrar a SecureStore (asegurar que sean strings)
          await SecureStore.setItemAsync('user_data', typeof storedUser === 'string' ? storedUser : JSON.stringify(storedUser));
          await SecureStore.setItemAsync('auth_token', typeof storedToken === 'string' ? storedToken : String(storedToken));
          logger.info('✅ Datos migrados a SecureStore');
          
          // Sincronizar token para compatibilidad
          await authService.syncTokenToAsyncStorage();
        }
      } catch (fallbackError) {
        logger.error('Error en fallback:', fallbackError);
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
        logger.info('🔍 Estructura de response.data:', JSON.stringify(response.data, null, 2));
        logger.info('🔍 Tipo de response.data:', typeof response.data);
        logger.info('🔍 Keys de response.data:', Object.keys(response.data || {}));
        
        const { tecnico, access_token } = response.data;
        
        logger.info('🔍 tecnico:', typeof tecnico, tecnico ? 'existe' : 'null/undefined');
        logger.info('🔍 access_token:', typeof access_token, access_token ? 'existe' : 'null/undefined');
        
        // Validar y convertir datos antes de guardar
        if (!tecnico) {
          logger.error('❌ Error: tecnico es null o undefined');
          return { success: false, error: 'Datos de usuario inválidos' };
        }
        
        if (!access_token) {
          logger.error('❌ Error: access_token es null o undefined');
          return { success: false, error: 'Token de acceso inválido' };
        }
        
        // Convertir tecnico a string JSON de forma segura
        let userDataString;
        try {
          if (typeof tecnico === 'string') {
            userDataString = tecnico;
          } else if (tecnico && typeof tecnico === 'object') {
            // Asegurar que todos los valores sean serializables
            const sanitizedTecnico = JSON.parse(JSON.stringify(tecnico));
            userDataString = JSON.stringify(sanitizedTecnico);
          } else {
            throw new Error('tecnico no es un objeto válido');
          }
        } catch (jsonError) {
          logger.error('❌ Error serializando tecnico:', jsonError);
          return { success: false, error: 'Error procesando datos de usuario' };
        }
        
        // Convertir access_token a string
        const tokenString = typeof access_token === 'string' ? access_token : String(access_token);
        
        // Validar que los strings no estén vacíos
        if (!userDataString || userDataString === 'null' || userDataString === 'undefined') {
          logger.error('❌ Error: user_data no es válido');
          return { success: false, error: 'Datos de usuario inválidos' };
        }
        
        if (!tokenString || tokenString === 'null' || tokenString === 'undefined') {
          logger.error('❌ Error: auth_token no es válido');
          return { success: false, error: 'Token de acceso inválido' };
        }
        
        // Guardar datos sensibles en SecureStore (asegurar que sean strings)
        await SecureStore.setItemAsync('user_data', userDataString);
        await SecureStore.setItemAsync('auth_token', tokenString);
        
        // Sincronizar token a AsyncStorage para compatibilidad
        await authService.syncTokenToAsyncStorage();
        
        logger.info('🔍 Usuario logueado - tipo_usuario:', tecnico.tipo_usuario);
        setUser(tecnico);
        setIsAuthenticated(true);
        
        logger.info('✅ Datos de autenticación guardados de forma segura');
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      logger.error('Error en login:', error);
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
      
      logger.info('✅ Datos de autenticación eliminados de forma segura');
    } catch (error) {
      logger.error('Error en logout:', error);
    }
  };

  const updateProfile = async (updateData) => {
    try {
      logger.info('AuthContext - Actualizando perfil con:', updateData);
      const response = await authService.updateProfile(updateData);
      if (response.success) {
        // Aplicar los cambios directamente al usuario actual
        const updatedUser = { ...user, ...updateData };
        logger.info('AuthContext - Usuario actualizado:', updatedUser);
        setUser(updatedUser);
        
        // Actualizar datos en SecureStore
        await SecureStore.setItemAsync('user_data', JSON.stringify(updatedUser));
        logger.info('✅ Perfil actualizado en almacenamiento seguro');
        
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      logger.error('Error actualizando perfil:', error);
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
        logger.info('✅ Perfil refrescado en almacenamiento seguro');
        
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      logger.error('Error refrescando perfil:', error);
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
