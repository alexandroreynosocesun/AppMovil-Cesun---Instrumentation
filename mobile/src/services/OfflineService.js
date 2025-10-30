import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';

class OfflineService {
  constructor() {
    this.db = null;
    this.isOnline = true;
    this.initDatabase();
    this.setupNetworkListener();
  }

  async initDatabase() {
    try {
      this.db = await SQLite.openDatabaseAsync('jigs_validation.db');
      
      // Crear tablas si no existen
      await this.createTables();
    } catch (error) {
      console.error('Error inicializando base de datos:', error);
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla de jigs offline
      CREATE TABLE IF NOT EXISTS jigs_offline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_qr TEXT UNIQUE NOT NULL,
        numero_jig TEXT NOT NULL,
        tipo TEXT NOT NULL,
        modelo_actual TEXT,
        estado TEXT DEFAULT 'activo',
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await this.db.execAsync(createTablesSQL);
      console.log('Tablas creadas correctamente');
    } catch (error) {
      console.error('Error creando tablas:', error);
      throw error;
    }
  }

  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
      console.log('Estado de conexión:', state.isConnected ? 'Online' : 'Offline');
      
      // Si se recupera la conexión, sincronizar datos pendientes
      if (state.isConnected && !this.isOnline) {
        this.syncPendingData();
      }
    });
  }

  async saveValidationOffline(validationData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO validations_offline 
        (jig_id, tecnico_id, turno, estado, comentario, cantidad, firma_digital, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        validationData.jig_id,
        validationData.tecnico_id,
        validationData.turno,
        validationData.estado,
        validationData.comentario || null,
        validationData.cantidad || 1,
        validationData.firma_digital || null,
        new Date().toISOString()
      ];

      this.db.transaction(
        (tx) => {
          tx.executeSql(sql, params,
            (_, result) => {
              console.log('Validación guardada offline:', result.insertId);
              resolve(result.insertId);
            },
            (_, error) => {
              console.error('Error guardando validación offline:', error);
              reject(error);
            }
          );
        }
      );
    });
  }

  async saveJigOffline(jigData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO jigs_offline 
        (codigo_qr, numero_jig, tipo, modelo_actual, estado)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const params = [
        jigData.codigo_qr,
        jigData.numero_jig,
        jigData.tipo,
        jigData.modelo_actual || null,
        jigData.estado || 'activo'
      ];

      this.db.transaction(
        (tx) => {
          tx.executeSql(sql, params,
            (_, result) => {
              console.log('Jig guardado offline:', result.insertId);
              resolve(result.insertId);
            },
            (_, error) => {
              console.error('Error guardando jig offline:', error);
              reject(error);
            }
          );
        }
      );
    });
  }

  async getOfflineValidations() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM validations_offline WHERE sincronizado = 0 ORDER BY created_at DESC';
      
      this.db.transaction(
        (tx) => {
          tx.executeSql(sql, [],
            (_, result) => {
              const validations = [];
              for (let i = 0; i < result.rows.length; i++) {
                validations.push(result.rows.item(i));
              }
              resolve(validations);
            },
            (_, error) => {
              console.error('Error obteniendo validaciones offline:', error);
              reject(error);
            }
          );
        }
      );
    });
  }

  async getOfflineJigs() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM jigs_offline ORDER BY created_at DESC';
      
      this.db.transaction(
        (tx) => {
          tx.executeSql(sql, [],
            (_, result) => {
              const jigs = [];
              for (let i = 0; i < result.rows.length; i++) {
                jigs.push(result.rows.item(i));
              }
              resolve(jigs);
            },
            (_, error) => {
              console.error('Error obteniendo jigs offline:', error);
              reject(error);
            }
          );
        }
      );
    });
  }

  async markValidationAsSynced(validationId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE validations_offline SET sincronizado = 1 WHERE id = ?';
      
      this.db.transaction(
        (tx) => {
          tx.executeSql(sql, [validationId],
            (_, result) => {
              console.log('Validación marcada como sincronizada:', validationId);
              resolve();
            },
            (_, error) => {
              console.error('Error marcando validación como sincronizada:', error);
              reject(error);
            }
          );
        }
      );
    });
  }

  async syncPendingData() {
    if (!this.isOnline) {
      console.log('Sin conexión, no se puede sincronizar');
      return;
    }

    try {
      const pendingValidations = await this.getOfflineValidations();
      console.log(`Sincronizando ${pendingValidations.length} validaciones pendientes`);

      for (const validation of pendingValidations) {
        try {
          // Aquí se enviaría la validación al servidor
          // await validationService.createValidation(validation);
          await this.markValidationAsSynced(validation.id);
        } catch (error) {
          console.error('Error sincronizando validación:', error);
        }
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
    }
  }

  isConnected() {
    return this.isOnline;
  }
}

export const offlineService = new OfflineService();
