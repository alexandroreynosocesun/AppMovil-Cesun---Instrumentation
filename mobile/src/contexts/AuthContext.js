import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/AuthService';
import { storage } from '../utils/storage';
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
      // Cargar datos sensibles desde almacenamiento (usando módulo unificado)
      const storedUser = await storage.getItem('user_data');
      const storedToken = await storage.getItem('auth_token');
      
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        logger.info('✅ Datos de autenticación cargados desde almacenamiento');

        // Asegurar que el token también esté disponible en AsyncStorage
        // para servicios que leen de allí (por ejemplo, AdminService)
        try {
          await AsyncStorage.setItem('token', storedToken);
          await AsyncStorage.setItem('auth_token', storedToken);
          logger.info('✅ Token sincronizado a AsyncStorage al iniciar la app');
        } catch (syncError) {
          logger.error('Error sincronizando token a AsyncStorage al iniciar:', syncError);
        }
      } else {
        // Fallback a AsyncStorage para migración
        try {
          const storedUserFallback = await AsyncStorage.getItem('user');
          const storedTokenFallback = await AsyncStorage.getItem('token');
          
          if (storedUserFallback && storedTokenFallback) {
            setUser(JSON.parse(storedUserFallback));
            setIsAuthenticated(true);
            logger.info('⚠️ Datos cargados desde AsyncStorage (migración)');
            
            // Migrar al almacenamiento apropiado
            await storage.setItem('user_data', typeof storedUserFallback === 'string' ? storedUserFallback : JSON.stringify(storedUserFallback));
            await storage.setItem('auth_token', typeof storedTokenFallback === 'string' ? storedTokenFallback : String(storedTokenFallback));
            logger.info('✅ Datos migrados');
            
            // Sincronizar token para compatibilidad
            await authService.syncTokenToAsyncStorage();
          }
        } catch (fallbackError) {
          logger.error('Error en fallback:', fallbackError);
        }
      }
    } catch (error) {
      logger.error('Error verificando usuario guardado:', error);
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
        
        const { tecnico, access_token, refresh_token } = response.data;
        
        logger.info('🔍 tecnico:', typeof tecnico, tecnico ? 'existe' : 'null/undefined');
        logger.info('🔍 access_token:', typeof access_token, access_token ? 'existe' : 'null/undefined');
        logger.info('🔍 refresh_token:', typeof refresh_token, refresh_token ? 'existe' : 'null/undefined');
        
        // Validar y convertir datos antes de guardar
        if (!tecnico) {
          logger.error('❌ Error: tecnico es null o undefined');
          return { success: false, error: 'Datos de usuario inválidos' };
        }
        
        if (!access_token) {
          logger.error('❌ Error: access_token es null o undefined');
          return { success: false, error: 'Token de acceso inválido' };
        }
        
        if (!refresh_token) {
          logger.warn('⚠️ Advertencia: refresh_token no recibido');
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
        
        // Convertir access_token y refresh_token a string
        const tokenString = typeof access_token === 'string' ? access_token : String(access_token);
        const refreshTokenString = refresh_token ? (typeof refresh_token === 'string' ? refresh_token : String(refresh_token)) : null;
        
        // Validar que los strings no estén vacíos
        if (!userDataString || userDataString === 'null' || userDataString === 'undefined') {
          logger.error('❌ Error: user_data no es válido');
          return { success: false, error: 'Datos de usuario inválidos' };
        }
        
        if (!tokenString || tokenString === 'null' || tokenString === 'undefined') {
          logger.error('❌ Error: auth_token no es válido');
          return { success: false, error: 'Token de acceso inválido' };
        }
        
        // Guardar datos sensibles usando módulo de storage unificado
        await storage.setItem('user_data', userDataString);
        await storage.setItem('auth_token', tokenString);
        if (refreshTokenString) {
          await storage.setItem('refresh_token', refreshTokenString);
        }
        
        // También guardar en AsyncStorage para compatibilidad
        await AsyncStorage.setItem('user', userDataString);
        await AsyncStorage.setItem('token', tokenString);
        await AsyncStorage.setItem('auth_token', tokenString);
        if (refreshTokenString) {
          await AsyncStorage.setItem('refresh_token', refreshTokenString);
        }
        
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
      // Eliminar datos sensibles del almacenamiento usando módulo unificado
      await storage.removeItem('user_data');
      await storage.removeItem('auth_token');
      await storage.removeItem('refresh_token');
      await storage.removeItem('user_signature');
      
      // Limpiar también AsyncStorage por compatibilidad
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      
      setUser(null);
      setIsAuthenticated(false);
      
      logger.info('✅ Datos de autenticación eliminados');
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
        
        // Actualizar datos en almacenamiento usando módulo unificado
        await storage.setItem('user_data', JSON.stringify(updatedUser));
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
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
        
        // Actualizar datos en almacenamiento usando módulo unificado
        await storage.setItem('user_data', JSON.stringify(response.data));
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
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
