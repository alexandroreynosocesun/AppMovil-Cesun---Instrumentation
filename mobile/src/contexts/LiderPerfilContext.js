import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uphService } from '../services/UPHService';

function genSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const LiderPerfilContext = createContext(null);

const SESSION_KEY = 'lider_session_id';
const PERFIL_KEY  = 'lider_perfil';

export function LiderPerfilProvider({ children }) {
  const [sessionId,   setSessionId]   = useState(null);
  const [perfil,      setPerfil]      = useState(null);  // { num_empleado, nombre, linea, foto_url }
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  // Inicializar sesión y perfil guardado
  useEffect(() => {
    (async () => {
      let sid = await AsyncStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = genSessionId();
        await AsyncStorage.setItem(SESSION_KEY, sid);
      }
      setSessionId(sid);

      // Verificar con el backend que el perfil sigue válido
      const cached = await AsyncStorage.getItem(PERFIL_KEY);
      if (cached) {
        try {
          const p = JSON.parse(cached);
          const r = await uphService.getSesionLider(sid);
          if (r.success && r.data?.lider?.num_empleado === p.num_empleado) {
            setPerfil(p);
          } else {
            await AsyncStorage.removeItem(PERFIL_KEY);
          }
        } catch {
          await AsyncStorage.removeItem(PERFIL_KEY);
        }
      }
      setLoadingPerfil(false);
    })();
  }, []);

  const seleccionarLider = useCallback(async (lider) => {
    if (!sessionId) return { success: false, error: 'Sin sesión' };
    const r = await uphService.claimLider(lider.num_empleado, sessionId);
    if (r.success) {
      const p = { ...lider, ...r.data };
      setPerfil(p);
      await AsyncStorage.setItem(PERFIL_KEY, JSON.stringify(p));
    }
    return r;
  }, [sessionId]);

  const liberarPerfil = useCallback(async () => {
    if (!perfil || !sessionId) return;
    await uphService.releaseLider(perfil.num_empleado, sessionId);
    setPerfil(null);
    await AsyncStorage.removeItem(PERFIL_KEY);
  }, [perfil, sessionId]);

  return (
    <LiderPerfilContext.Provider value={{ perfil, sessionId, loadingPerfil, seleccionarLider, liberarPerfil }}>
      {children}
    </LiderPerfilContext.Provider>
  );
}

export function useLiderPerfil() {
  return useContext(LiderPerfilContext);
}
