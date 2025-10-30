import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        console.log('📥 Cargando validaciones guardadas:', parsed.length);
        setValidations(parsed);
      }
    } catch (error) {
      console.error('Error cargando validaciones:', error);
    }
  };
  
  const saveValidations = async () => {
    try {
      await AsyncStorage.setItem('validations', JSON.stringify(validations));
      console.log('💾 Guardando validaciones:', validations.length);
    } catch (error) {
      console.error('Error guardando validaciones:', error);
    }
  };
  
  // Debug: Log cuando cambie el estado de validaciones
  console.log('🔄 ValidationContext - Estado actual:', {
    validationsCount: validations.length,
    currentModel: currentModel,
    validations: validations.map(v => ({ 
      modelo: v.modelo_actual, 
      jig: v.jig?.numero_jig,
      estado: v.estado 
    }))
  });

  const addValidation = useCallback((validationData) => {
    console.log('➕ addValidation - Agregando validación:', {
      modelo_actual: validationData.modelo_actual,
      jig: validationData.jig?.numero_jig,
      estado: validationData.estado
    });
    
    setValidations(prev => {
      const newValidations = [...prev, validationData];
      console.log('➕ addValidation - Total validaciones después de agregar:', newValidations.length);
      
      // Agrupar por modelo para verificar si se completó
      const modelGroups = newValidations.reduce((groups, validation) => {
        const model = validation.modelo_actual;
        if (!groups[model]) {
          groups[model] = [];
        }
        groups[model].push(validation);
        return groups;
      }, {});
      
      console.log('➕ addValidation - Grupos por modelo:', modelGroups);
      
      // Verificar si algún modelo tiene 14 validaciones
      Object.keys(modelGroups).forEach(model => {
        if (modelGroups[model].length >= 14) {
          console.log('✅ Modelo completado:', model, 'con', modelGroups[model].length, 'validaciones');
          setCurrentModel(model);
        }
      });
      
      return newValidations;
    });
  }, []);

  const clearValidations = useCallback(async () => {
    console.log('🗑️ clearValidations - Limpiando todas las validaciones');
    setValidations([]);
    setCurrentModel(null);
    try {
      await AsyncStorage.removeItem('validations');
      console.log('🗑️ Validaciones eliminadas del almacenamiento');
    } catch (error) {
      console.error('Error limpiando validaciones del almacenamiento:', error);
    }
  }, []);

  const getValidationsByModel = useCallback((model) => {
    console.log('🔍 getValidationsByModel - Modelo solicitado:', model);
    console.log('🔍 getValidationsByModel - Total validaciones:', validations.length);
    console.log('🔍 getValidationsByModel - Validaciones disponibles:', validations.map(v => ({ 
      modelo_actual: v.modelo_actual, 
      jig: v.jig?.numero_jig,
      estado: v.estado 
    })));
    
    const filtered = validations.filter(v => v.modelo_actual === model);
    console.log('🔍 getValidationsByModel - Validaciones filtradas:', filtered.length);
    
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
    setIsGeneratingReport
  };

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
};
