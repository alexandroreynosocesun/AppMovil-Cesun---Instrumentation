// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Guardar el resolver original
const originalResolveRequest = config.resolver.resolveRequest;

// Configuración para excluir módulos problemáticos en web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Excluir módulos problemáticos en web
  if (platform === 'web') {
    // Excluir expo-sqlite completamente en web
    if (moduleName === 'expo-sqlite') {
      return {
        type: 'empty',
      };
    }
    
    // Excluir jimp-compact y cualquier módulo relacionado con jimp
    if (moduleName === 'jimp-compact' || 
        moduleName === 'jimp' ||
        (moduleName && typeof moduleName === 'string' && (
          moduleName.includes('jimp') || 
          moduleName.includes('/jimp/')
        ))) {
      return {
        type: 'empty',
      };
    }
  }
  
  // También excluir jimp durante el bundling del servidor si es necesario
  if (moduleName && typeof moduleName === 'string' && moduleName.includes('jimp-compact')) {
    // Silenciar el error pero retornar un módulo vacío
    try {
      return originalResolveRequest ? originalResolveRequest(context, moduleName, platform) : null;
    } catch (e) {
      return { type: 'empty' };
    }
  }
  
  // Usar el resolver original para otros casos
  if (originalResolveRequest) {
    try {
      return originalResolveRequest(context, moduleName, platform);
    } catch (error) {
      // Si hay error con jimp, retornar módulo vacío
      if (error.message && error.message.includes('jimp')) {
        return { type: 'empty' };
      }
      throw error;
    }
  }
  
  // Fallback al resolver por defecto
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

