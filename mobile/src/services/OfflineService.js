import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

class OfflineService {
  constructor() {
    this.db = null;
    this.isOnline = true;
    this.syncInProgress = false;
    this.syncQueue = [];
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 segundos
    this.initDatabase();
    this.setupNetworkListener();
  }

  async initDatabase() {
    try {
      this.db = await SQLite.openDatabaseAsync('jigs_validation.db');
      
      // Crear tablas si no existen
      await this.createTables();
      
      // Ejecutar migraciones para actualizar esquema existente
      await this.migrateDatabase();
      
      // Crear índices después de migración (asegura que todas las columnas existan)
      await this.createIndexes();
      
      // Inicializar cola de sincronización
      await this.loadSyncQueue();
    } catch (error) {
      logger.error('Error inicializando base de datos:', error);
    }
  }

  async createTables() {
    const createTablesSQL = `
      -- Tabla de validaciones offline
      CREATE TABLE IF NOT EXISTS validations_offline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jig_id INTEGER NOT NULL,
        tecnico_id INTEGER NOT NULL,
        turno TEXT NOT NULL,
        estado TEXT NOT NULL,
        comentario TEXT,
        cantidad INTEGER DEFAULT 1,
        firma_digital TEXT,
        fecha TEXT NOT NULL,
        sincronizado INTEGER DEFAULT 0,
        intentos_sincronizacion INTEGER DEFAULT 0,
        ultimo_intento TEXT,
        error_sincronizacion TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        data_json TEXT
      );

      -- Tabla de jigs offline
      CREATE TABLE IF NOT EXISTS jigs_offline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_qr TEXT UNIQUE NOT NULL,
        numero_jig TEXT NOT NULL,
        tipo TEXT NOT NULL,
        modelo_actual TEXT,
        estado TEXT DEFAULT 'activo',
        last_synced TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla de reparaciones offline
      CREATE TABLE IF NOT EXISTS reparaciones_offline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jig_id INTEGER NOT NULL,
        tecnico_id INTEGER NOT NULL,
        descripcion TEXT NOT NULL,
        estado_anterior TEXT NOT NULL,
        estado_nuevo TEXT NOT NULL,
        fecha TEXT NOT NULL,
        sincronizado INTEGER DEFAULT 0,
        intentos_sincronizacion INTEGER DEFAULT 0,
        ultimo_intento TEXT,
        error_sincronizacion TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        data_json TEXT
      );

      -- Tabla de cola de sincronización
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        data_json TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        last_attempt TEXT,
        status TEXT DEFAULT 'pending'
      );
    `;

    try {
      await this.db.execAsync(createTablesSQL);
      logger.info('✅ Tablas offline creadas correctamente');
      // No crear índices aquí - se crearán después de la migración
    } catch (error) {
      logger.error('Error creando tablas:', error);
      // No lanzar error, permitir que continúe con migración
    }
  }

  async createIndexes() {
    /**
     * Crear índices para mejorar rendimiento
     * Se ejecuta después de crear tablas y migraciones
     */
    try {
      // Crear índice de sincronización (puede fallar si la columna no existe aún)
      try {
        await this.db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_validations_sync 
          ON validations_offline(sincronizado, intentos_sincronizacion);
        `);
      } catch (err) {
        if (err.message && err.message.includes('no such column')) {
          logger.debug('Índice idx_validations_sync no creado: columna intentos_sincronizacion no existe aún');
        } else {
          throw err;
        }
      }

      // Crear índice de cola de sincronización
      try {
        await this.db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_sync_queue_status 
          ON sync_queue(status, priority);
        `);
      } catch (err) {
        logger.debug('Error creando índice idx_sync_queue_status:', err.message);
      }
    } catch (error) {
      logger.warn('Error creando índices (se reintentará después de migración):', error);
    }
  }

  async migrateDatabase() {
    /**
     * Migrar esquema de base de datos existente
     * Agrega columnas faltantes si la tabla ya existe con esquema antiguo
     */
    try {
      // Intentar agregar columnas faltantes en validations_offline
      // SQLite no soporta IF NOT EXISTS en ALTER TABLE, así que intentamos y capturamos errores
      const migrations = [
        {
          table: 'validations_offline',
          columns: [
            { name: 'intentos_sincronizacion', sql: 'ALTER TABLE validations_offline ADD COLUMN intentos_sincronizacion INTEGER DEFAULT 0;' },
            { name: 'ultimo_intento', sql: 'ALTER TABLE validations_offline ADD COLUMN ultimo_intento TEXT;' },
            { name: 'error_sincronizacion', sql: 'ALTER TABLE validations_offline ADD COLUMN error_sincronizacion TEXT;' }
          ]
        },
        {
          table: 'reparaciones_offline',
          columns: [
            { name: 'intentos_sincronizacion', sql: 'ALTER TABLE reparaciones_offline ADD COLUMN intentos_sincronizacion INTEGER DEFAULT 0;' },
            { name: 'ultimo_intento', sql: 'ALTER TABLE reparaciones_offline ADD COLUMN ultimo_intento TEXT;' },
            { name: 'error_sincronizacion', sql: 'ALTER TABLE reparaciones_offline ADD COLUMN error_sincronizacion TEXT;' }
          ]
        }
      ];

      for (const migration of migrations) {
        for (const column of migration.columns) {
          try {
            await this.db.execAsync(column.sql);
            logger.info(`✅ Migración: columna '${column.name}' agregada a ${migration.table}`);
          } catch (err) {
            // Ignorar errores si la columna ya existe o la tabla no existe
            if (err.message && (
              err.message.includes('duplicate column') ||
              err.message.includes('no such table') ||
              err.message.includes('already exists')
            )) {
              // Columna ya existe o tabla no existe (se creará en createTables)
              logger.debug(`Columna '${column.name}' ya existe en ${migration.table} o tabla no existe aún`);
            } else {
              logger.warn(`Error agregando columna '${column.name}' a ${migration.table}:`, err.message);
            }
          }
        }
      }

      // Recrear índices después de la migración
      await this.createIndexes();
    } catch (error) {
      logger.warn('Error en migración de base de datos (puede ser normal si es primera vez):', error);
      // No lanzar error, permitir que continúe
    }
  }

  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      logger.info(`📡 Estado de conexión: ${this.isOnline ? 'Online' : 'Offline'}`);
      
      // Guardar estado en AsyncStorage para acceso rápido
      AsyncStorage.setItem('network_status', JSON.stringify({
        isOnline: this.isOnline,
        timestamp: new Date().toISOString()
      }));
      
      // Si se recupera la conexión, sincronizar datos pendientes
      if (this.isOnline && wasOffline) {
        logger.info('🔄 Conexión recuperada, iniciando sincronización...');
        this.syncPendingData();
      }
    });
  }

  async saveValidationOffline(validationData) {
    try {
      const dataJson = JSON.stringify(validationData);
      const sql = `
        INSERT INTO validations_offline 
        (jig_id, tecnico_id, turno, estado, comentario, cantidad, fecha, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        validationData.jig_id,
        validationData.tecnico_id,
        validationData.turno,
        validationData.estado,
        validationData.comentario || null,
        validationData.cantidad || 1,
        new Date().toISOString(),
        dataJson
      ];

      const result = await this.db.runAsync(sql, params);
      logger.info('✅ Validación guardada offline:', result.lastInsertRowId);
      
      // Agregar a cola de sincronización
      await this.addToSyncQueue('create', 'validation', result.lastInsertRowId, validationData);
      
      return result.lastInsertRowId;
    } catch (error) {
      logger.error('❌ Error guardando validación offline:', error);
      throw error;
    }
  }

  async saveJigOffline(jigData) {
    try {
      const sql = `
        INSERT OR REPLACE INTO jigs_offline 
        (codigo_qr, numero_jig, tipo, modelo_actual, estado, last_synced)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        jigData.codigo_qr,
        jigData.numero_jig,
        jigData.tipo,
        jigData.modelo_actual || null,
        jigData.estado || 'activo',
        new Date().toISOString()
      ];

      const result = await this.db.runAsync(sql, params);
      logger.info('✅ Jig guardado offline:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      logger.error('❌ Error guardando jig offline:', error);
      throw error;
    }
  }

  async getOfflineValidations() {
    try {
      const sql = 'SELECT * FROM validations_offline WHERE sincronizado = 0 ORDER BY created_at DESC';
      const result = await this.db.getAllAsync(sql);
      return result;
    } catch (error) {
      logger.error('❌ Error obteniendo validaciones offline:', error);
      throw error;
    }
  }

  async getOfflineJigs() {
    try {
      const sql = 'SELECT * FROM jigs_offline ORDER BY created_at DESC';
      const result = await this.db.getAllAsync(sql);
      return result;
    } catch (error) {
      logger.error('❌ Error obteniendo jigs offline:', error);
      throw error;
    }
  }

  async getPendingSyncCount() {
    try {
      const validations = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM validations_offline WHERE sincronizado = 0'
      );
      const reparaciones = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM reparaciones_offline WHERE sincronizado = 0'
      );
      const queue = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?',
        ['pending']
      );
      
      return {
        validations: validations?.count || 0,
        reparaciones: reparaciones?.count || 0,
        queue: queue?.count || 0,
        total: (validations?.count || 0) + (reparaciones?.count || 0) + (queue?.count || 0)
      };
    } catch (error) {
      logger.error('Error obteniendo conteo de sincronización:', error);
      return { validations: 0, reparaciones: 0, queue: 0, total: 0 };
    }
  }

  async markValidationAsSynced(validationId, serverId = null) {
    try {
      const sql = 'UPDATE validations_offline SET sincronizado = 1, intentos_sincronizacion = 0 WHERE id = ?';
      await this.db.runAsync(sql, [validationId]);
      logger.info('✅ Validación marcada como sincronizada:', validationId);
    } catch (error) {
      logger.error('❌ Error marcando validación como sincronizada:', error);
      throw error;
    }
  }

  async markValidationSyncFailed(validationId, error) {
    try {
      const sql = `
        UPDATE validations_offline 
        SET intentos_sincronizacion = intentos_sincronizacion + 1,
            ultimo_intento = ?,
            error_sincronizacion = ?
        WHERE id = ?
      `;
      await this.db.runAsync(sql, [
        new Date().toISOString(),
        error?.message || String(error),
        validationId
      ]);
    } catch (err) {
      logger.error('Error actualizando intento de sincronización:', err);
    }
  }

  async addToSyncQueue(operationType, entityType, entityId, data) {
    try {
      const sql = `
        INSERT INTO sync_queue (operation_type, entity_type, entity_id, data_json, priority)
        VALUES (?, ?, ?, ?, ?)
      `;
      const priority = operationType === 'create' ? 1 : 0; // Crear tiene mayor prioridad
      await this.db.runAsync(sql, [
        operationType,
        entityType,
        entityId,
        JSON.stringify(data),
        priority
      ]);
    } catch (error) {
      logger.error('Error agregando a cola de sincronización:', error);
    }
  }

  async loadSyncQueue() {
    try {
      const sql = 'SELECT * FROM sync_queue WHERE status = ? ORDER BY priority DESC, created_at ASC';
      this.syncQueue = await this.db.getAllAsync(sql, ['pending']);
    } catch (error) {
      logger.error('Error cargando cola de sincronización:', error);
      this.syncQueue = [];
    }
  }

  async syncPendingData() {
    if (!this.isOnline) {
      logger.info('⚠️ Sin conexión, no se puede sincronizar');
      return { success: false, reason: 'offline' };
    }

    if (this.syncInProgress) {
      logger.info('⚠️ Sincronización ya en progreso');
      return { success: false, reason: 'in_progress' };
    }

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      // Sincronizar validaciones pendientes
      const pendingValidations = await this.getOfflineValidations();
      logger.info(`🔄 Sincronizando ${pendingValidations.length} validaciones pendientes`);

      for (const validation of pendingValidations) {
        try {
          // Intentar parsear data_json si existe, sino usar los campos individuales
          let validationData;
          if (validation.data_json) {
            validationData = JSON.parse(validation.data_json);
          } else {
            validationData = {
              jig_id: validation.jig_id,
              tecnico_id: validation.tecnico_id,
              turno: validation.turno,
              estado: validation.estado,
              comentario: validation.comentario,
              cantidad: validation.cantidad
            };
          }

          // Importar dinámicamente para evitar dependencias circulares
          const { validationService } = await import('./ValidationService');
          const result = await validationService.createValidation(validationData);

          if (result.success) {
            await this.markValidationAsSynced(validation.id);
            synced++;
          } else {
            await this.markValidationSyncFailed(validation.id, new Error(result.error));
            failed++;
          }

          // Esperar un poco entre sincronizaciones para no sobrecargar el servidor
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`❌ Error sincronizando validación ${validation.id}:`, error);
          await this.markValidationSyncFailed(validation.id, error);
          failed++;
        }
      }

      logger.info(`✅ Sincronización completada: ${synced} exitosas, ${failed} fallidas`);
      
      // Notificar al usuario si hay cambios
      if (synced > 0 || failed > 0) {
        await AsyncStorage.setItem('last_sync', new Date().toISOString());
      }

      return { success: true, synced, failed };
    } catch (error) {
      logger.error('❌ Error en sincronización:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  async forceSync() {
    logger.info('🔄 Forzando sincronización...');
    return await this.syncPendingData();
  }

  isConnected() {
    return this.isOnline;
  }

  async getNetworkStatus() {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type
    };
  }

  async clearOldSyncedData(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Eliminar validaciones sincronizadas antiguas
      await this.db.runAsync(
        'DELETE FROM validations_offline WHERE sincronizado = 1 AND created_at < ?',
        [cutoffDate.toISOString()]
      );
      
      logger.info(`✅ Datos sincronizados antiguos eliminados (más de ${days} días)`);
    } catch (error) {
      logger.error('Error limpiando datos antiguos:', error);
    }
  }
}

export const offlineService = new OfflineService();

