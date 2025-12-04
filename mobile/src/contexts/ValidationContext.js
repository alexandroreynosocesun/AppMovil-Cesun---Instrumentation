import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

const ValidationContext = createContext();

export const useValidation = () => {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidation debe ser usado dentro de ValidationProvider');
  }
  return context;
};

export const ValidationProvider = ({ children }) => {
  const [validations, setValidations] = useState([]);
  const [currentModel, setCurrentModel] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [lineaPorModelo, setLineaPorModelo] = useState({}); // Guardar línea por modelo
  
  // Cargar validaciones guardadas al inicializar
  useEffect(() => {
    loadValidations();
  }, []);
  
  // Guardar validaciones cuando cambien
  useEffect(() => {
    saveValidations();
  }, [validations]);
  
  const loadValidations = async () => {
    try {
      const savedValidations = await AsyncStorage.getItem('validations');
      if (savedValidations) {
        const parsed = JSON.parse(savedValidations);
        logger.info('📥 Cargando validaciones guardadas:', parsed.length);
        setValidations(parsed);
      }
    } catch (error) {
      logger.error('Error cargando validaciones:', error);
    }
  };
  
  const saveValidations = async () => {
    try {
      await AsyncStorage.setItem('validations', JSON.stringify(validations));
      logger.info('💾 Guardando validaciones:', validations.length);
    } catch (error) {
      logger.error('Error guardando validaciones:', error);
    }
  };
  
  // Debug: Log cuando cambie el estado de validaciones
  logger.info('🔄 ValidationContext - Estado actual:', {
    validationsCount: validations.length,
    currentModel: currentModel,
    validations: validations.map(v => ({ 
      modelo: v.modelo_actual, 
      jig: v.jig?.numero_jig,
      estado: v.estado 
    }))
  });

  const addValidation = useCallback((validationData) => {
    logger.info('➕ addValidation - Agregando validación:', {
      modelo_actual: validationData.modelo_actual,
      jig: validationData.jig?.numero_jig,
      estado: validationData.estado,
      linea: validationData.linea
    });
    
    setValidations(prev => {
      const newValidations = [...prev, validationData];
      logger.info('➕ addValidation - Total validaciones después de agregar:', newValidations.length);
      
      // Agrupar por modelo para verificar si se completó
      const modelGroups = newValidations.reduce((groups, validation) => {
        const model = validation.modelo_actual;
        if (!groups[model]) {
          groups[model] = [];
        }
        groups[model].push(validation);
        return groups;
      }, {});
      
      logger.info('➕ addValidation - Grupos por modelo:', modelGroups);
      
      // Verificar si algún modelo tiene 14 validaciones
      Object.keys(modelGroups).forEach(model => {
        if (modelGroups[model].length >= 14) {
          logger.info('✅ Modelo completado:', model, 'con', modelGroups[model].length, 'validaciones');
          setCurrentModel(model);
        }
      });
      
      return newValidations;
    });
  }, []);

  const setLineaForModel = useCallback((modelo, linea) => {
    logger.info('📝 setLineaForModel - Guardando línea para modelo:', modelo, 'línea:', linea);
    setLineaPorModelo(prev => ({
      ...prev,
      [modelo]: linea
    }));
  }, []);

  const getLineaForModel = useCallback((modelo) => {
    return lineaPorModelo[modelo] || '';
  }, [lineaPorModelo]);

  const clearValidations = useCallback(async () => {
    logger.info('🗑️ clearValidations - Limpiando todas las validaciones');
    setValidations([]);
    setCurrentModel(null);
    setLineaPorModelo({}); // Limpiar también las líneas guardadas
    try {
      await AsyncStorage.removeItem('validations');
      logger.info('🗑️ Validaciones eliminadas del almacenamiento');
    } catch (error) {
      logger.error('Error limpiando validaciones del almacenamiento:', error);
    }
  }, []);

  const getValidationsByModel = useCallback((model) => {
    logger.info('🔍 getValidationsByModel - Modelo solicitado:', model);
    logger.info('🔍 getValidationsByModel - Total validaciones:', validations.length);
    logger.info('🔍 getValidationsByModel - Validaciones disponibles:', validations.map(v => ({ 
      modelo_actual: v.modelo_actual, 
      jig: v.jig?.numero_jig,
      estado: v.estado 
    })));
    
    const filtered = validations.filter(v => v.modelo_actual === model);
    logger.info('🔍 getValidationsByModel - Validaciones filtradas:', filtered.length);
    
    return filtered;
  }, [validations]);

  const getCompletedModels = useCallback(() => {
    const modelGroups = validations.reduce((groups, validation) => {
      const model = validation.modelo_actual;
      if (!groups[model]) {
        groups[model] = [];
      }
      groups[model].push(validation);
      return groups;
    }, {});
    
    return Object.keys(modelGroups).filter(model => 
      modelGroups[model].length >= 14
    );
  }, [validations]);

  const value = {
    validations,
    currentModel,
    isGeneratingReport,
    addValidation,
    clearValidations,
    getValidationsByModel,
    getCompletedModels,
    setIsGeneratingReport,
    setLineaForModel,
    getLineaForModel
  };

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
};
