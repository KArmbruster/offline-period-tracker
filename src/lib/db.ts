import type { Cycle, Symptom, CustomSymptomType, OvulationMarker } from '@/types';
import { webDb } from './db-web';

// Check if we're running in a native Capacitor environment
function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for Capacitor native platform
  const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return win.Capacitor?.isNativePlatform?.() ?? false;
}

// Database interface that both implementations satisfy
export interface DatabaseInterface {
  initialize(passphrase: string): Promise<boolean>;
  close(): Promise<void>;
  getAllCycles(): Promise<Cycle[]>;
  getCycleById(id: number): Promise<Cycle | null>;
  addCycle(startDate: string, endDate?: string): Promise<number>;
  updateCycle(id: number, startDate: string, endDate?: string): Promise<void>;
  deleteCycle(id: number): Promise<void>;
  getCycleByDate(date: string): Promise<Cycle | null>;
  getSymptomsByDate(date: string): Promise<Symptom[]>;
  getSymptomsByCycleId(cycleId: number): Promise<Symptom[]>;
  getAllSymptoms(): Promise<Symptom[]>;
  addSymptom(date: string, symptomType: string, cycleId?: number, notes?: string): Promise<number>;
  deleteSymptom(id: number): Promise<void>;
  getAllCustomSymptomTypes(): Promise<CustomSymptomType[]>;
  addCustomSymptomType(name: string): Promise<number>;
  deleteCustomSymptomType(id: number): Promise<void>;
  getOvulationMarkerByCycleId(cycleId: number): Promise<OvulationMarker | null>;
  getAllOvulationMarkers(): Promise<OvulationMarker[]>;
  addOvulationMarker(cycleId: number, date: string, isConfirmed: boolean): Promise<number>;
  updateOvulationMarker(id: number, date: string, isConfirmed: boolean): Promise<void>;
  deleteOvulationMarker(id: number): Promise<void>;
  exportAllData(): Promise<{
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    ovulation_markers: OvulationMarker[];
  }>;
  clearAllData(): Promise<void>;
  importData(data: {
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    ovulation_markers: OvulationMarker[];
  }): Promise<void>;
  isReady(): boolean;
}

const DB_NAME = 'periodtracker';

// Type for SQLite database connection
interface SQLiteDb {
  open(): Promise<void>;
  execute(sql: string): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ values?: unknown[] }>;
  run(sql: string, params?: unknown[]): Promise<{ changes?: { lastId?: number } }>;
}

// Type for SQLite connection manager
interface SQLiteConnectionManager {
  checkConnectionsConsistency(): Promise<{ result: boolean }>;
  isConnection(name: string, readonly: boolean): Promise<{ result: boolean }>;
  retrieveConnection(name: string, readonly: boolean): Promise<SQLiteDb>;
  createConnection(name: string, encrypted: boolean, mode: string, version: number, readonly: boolean): Promise<SQLiteDb>;
  closeConnection(name: string, readonly: boolean): Promise<void>;
}

class NativeDatabaseService implements DatabaseInterface {
  private sqlite: SQLiteConnectionManager | null = null;
  private db: SQLiteDb | null = null;
  private isInitialized = false;

  private async getSQLite(): Promise<SQLiteConnectionManager> {
    if (!this.sqlite) {
      const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
      this.sqlite = new SQLiteConnection(CapacitorSQLite) as unknown as SQLiteConnectionManager;
    }
    return this.sqlite;
  }

  async initialize(passphrase: string): Promise<boolean> {
    try {
      const sqlite = await this.getSQLite();

      // Check if connection exists
      const retCC = (await sqlite.checkConnectionsConsistency()).result;
      const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

      if (retCC && isConn) {
        this.db = await sqlite.retrieveConnection(DB_NAME, false);
      } else {
        this.db = await sqlite.createConnection(
          DB_NAME,
          true, // encrypted
          'secret', // mode
          1, // version
          false // readonly
        );
      }

      await this.db.open();

      // Set encryption key
      await this.db.execute(`PRAGMA key = '${passphrase}'`);

      // Run migrations
      await this.runMigrations();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      return false;
    }
  }

  private getDb(): SQLiteDb {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  private async runMigrations(): Promise<void> {
    const db = this.getDb();

    const migrations = `
      CREATE TABLE IF NOT EXISTS cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_start_date TEXT NOT NULL,
        period_end_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cycles_start_date ON cycles(period_start_date);

      CREATE TABLE IF NOT EXISTS symptoms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_id INTEGER,
        date TEXT NOT NULL,
        symptom_type TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_symptoms_cycle_id ON symptoms(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_symptoms_date ON symptoms(date);

      CREATE TABLE IF NOT EXISTS custom_symptom_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ovulation_markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        is_confirmed INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ovulation_cycle_id ON ovulation_markers(cycle_id);
    `;

    await db.execute(migrations);
  }

  async close(): Promise<void> {
    if (this.db) {
      const sqlite = await this.getSQLite();
      await sqlite.closeConnection(DB_NAME, false);
      this.db = null;
      this.isInitialized = false;
    }
  }

  // Cycles
  async getAllCycles(): Promise<Cycle[]> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM cycles ORDER BY period_start_date DESC');
    return (result.values || []) as Cycle[];
  }

  async getCycleById(id: number): Promise<Cycle | null> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM cycles WHERE id = ?', [id]);
    return (result.values?.[0] as Cycle) || null;
  }

  async addCycle(startDate: string, endDate?: string): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT INTO cycles (period_start_date, period_end_date) VALUES (?, ?)',
      [startDate, endDate || null]
    );
    return result.changes?.lastId || 0;
  }

  async updateCycle(id: number, startDate: string, endDate?: string): Promise<void> {
    const db = this.getDb();
    await db.run(
      'UPDATE cycles SET period_start_date = ?, period_end_date = ? WHERE id = ?',
      [startDate, endDate || null, id]
    );
  }

  async deleteCycle(id: number): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM cycles WHERE id = ?', [id]);
  }

  async getCycleByDate(date: string): Promise<Cycle | null> {
    const db = this.getDb();
    const result = await db.query(
      `SELECT * FROM cycles
       WHERE period_start_date <= ?
       AND (period_end_date >= ? OR period_end_date IS NULL)
       ORDER BY period_start_date DESC LIMIT 1`,
      [date, date]
    );
    return (result.values?.[0] as Cycle) || null;
  }

  // Symptoms
  async getSymptomsByDate(date: string): Promise<Symptom[]> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM symptoms WHERE date = ?', [date]);
    return (result.values || []) as Symptom[];
  }

  async getSymptomsByCycleId(cycleId: number): Promise<Symptom[]> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM symptoms WHERE cycle_id = ?', [cycleId]);
    return (result.values || []) as Symptom[];
  }

  async getAllSymptoms(): Promise<Symptom[]> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM symptoms ORDER BY date DESC');
    return (result.values || []) as Symptom[];
  }

  async addSymptom(date: string, symptomType: string, cycleId?: number, notes?: string): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT INTO symptoms (date, symptom_type, cycle_id, notes) VALUES (?, ?, ?, ?)',
      [date, symptomType, cycleId || null, notes || null]
    );
    return result.changes?.lastId || 0;
  }

  async deleteSymptom(id: number): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM symptoms WHERE id = ?', [id]);
  }

  // Custom Symptom Types
  async getAllCustomSymptomTypes(): Promise<CustomSymptomType[]> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM custom_symptom_types ORDER BY name');
    return (result.values || []) as CustomSymptomType[];
  }

  async addCustomSymptomType(name: string): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT OR IGNORE INTO custom_symptom_types (name) VALUES (?)',
      [name]
    );
    return result.changes?.lastId || 0;
  }

  async deleteCustomSymptomType(id: number): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM custom_symptom_types WHERE id = ?', [id]);
  }

  // Ovulation Markers
  async getOvulationMarkerByCycleId(cycleId: number): Promise<OvulationMarker | null> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM ovulation_markers WHERE cycle_id = ?', [cycleId]);
    return (result.values?.[0] as OvulationMarker) || null;
  }

  async getAllOvulationMarkers(): Promise<OvulationMarker[]> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM ovulation_markers ORDER BY date DESC');
    return (result.values || []) as OvulationMarker[];
  }

  async addOvulationMarker(cycleId: number, date: string, isConfirmed: boolean): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT INTO ovulation_markers (cycle_id, date, is_confirmed) VALUES (?, ?, ?)',
      [cycleId, date, isConfirmed ? 1 : 0]
    );
    return result.changes?.lastId || 0;
  }

  async updateOvulationMarker(id: number, date: string, isConfirmed: boolean): Promise<void> {
    const db = this.getDb();
    await db.run(
      'UPDATE ovulation_markers SET date = ?, is_confirmed = ? WHERE id = ?',
      [date, isConfirmed ? 1 : 0, id]
    );
  }

  async deleteOvulationMarker(id: number): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM ovulation_markers WHERE id = ?', [id]);
  }

  // Export/Import
  async exportAllData(): Promise<{
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    ovulation_markers: OvulationMarker[];
  }> {
    const cycles = await this.getAllCycles();
    const symptoms = await this.getAllSymptoms();
    const custom_symptom_types = await this.getAllCustomSymptomTypes();
    const ovulation_markers = await this.getAllOvulationMarkers();

    return { cycles, symptoms, custom_symptom_types, ovulation_markers };
  }

  async clearAllData(): Promise<void> {
    const db = this.getDb();
    await db.execute('DELETE FROM ovulation_markers');
    await db.execute('DELETE FROM symptoms');
    await db.execute('DELETE FROM custom_symptom_types');
    await db.execute('DELETE FROM cycles');
  }

  async importData(data: {
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    ovulation_markers: OvulationMarker[];
  }): Promise<void> {
    const db = this.getDb();

    // Clear existing data
    await this.clearAllData();

    // Import cycles
    for (const cycle of data.cycles) {
      await db.run(
        'INSERT INTO cycles (id, period_start_date, period_end_date, created_at) VALUES (?, ?, ?, ?)',
        [cycle.id, cycle.period_start_date, cycle.period_end_date, cycle.created_at]
      );
    }

    // Import symptoms
    for (const symptom of data.symptoms) {
      await db.run(
        'INSERT INTO symptoms (id, cycle_id, date, symptom_type, notes) VALUES (?, ?, ?, ?, ?)',
        [symptom.id, symptom.cycle_id, symptom.date, symptom.symptom_type, symptom.notes]
      );
    }

    // Import custom symptom types
    for (const customType of data.custom_symptom_types) {
      await db.run(
        'INSERT INTO custom_symptom_types (id, name, created_at) VALUES (?, ?, ?)',
        [customType.id, customType.name, customType.created_at]
      );
    }

    // Import ovulation markers
    for (const marker of data.ovulation_markers) {
      await db.run(
        'INSERT INTO ovulation_markers (id, cycle_id, date, is_confirmed) VALUES (?, ?, ?, ?)',
        [marker.id, marker.cycle_id, marker.date, marker.is_confirmed ? 1 : 0]
      );
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Create the appropriate database instance based on platform
function createDatabase(): DatabaseInterface {
  if (isNativePlatform()) {
    console.log('Using native SQLite database');
    return new NativeDatabaseService();
  } else {
    console.log('Using web localStorage database');
    return webDb;
  }
}

// Singleton instance - will be web or native based on platform
export const db: DatabaseInterface = createDatabase();
