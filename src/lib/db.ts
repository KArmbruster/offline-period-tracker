import type { Cycle, Symptom, CustomSymptomType, DayNote } from '@/types';
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
  initialize(): Promise<boolean>;
  close(): Promise<void>;
  getAllCycles(): Promise<Cycle[]>;
  getCycleById(id: number): Promise<Cycle | null>;
  addCycle(startDate: string, endDate?: string, ovulationDate?: string): Promise<number>;
  updateCycle(id: number, startDate: string, endDate?: string, ovulationDate?: string): Promise<void>;
  deleteCycle(id: number): Promise<void>;
  getCycleByDate(date: string): Promise<Cycle | null>;
  getSymptomsByDate(date: string): Promise<Symptom[]>;
  getSymptomsByCycleId(cycleId: number): Promise<Symptom[]>;
  getAllSymptoms(): Promise<Symptom[]>;
  addSymptom(date: string, symptomType: string, cycleId?: number): Promise<number>;
  deleteSymptom(id: number): Promise<void>;
  getAllCustomSymptomTypes(): Promise<CustomSymptomType[]>;
  addCustomSymptomType(name: string, category: 'physical' | 'mood'): Promise<number>;
  deleteCustomSymptomType(id: number): Promise<void>;
  getNoteByDate(date: string): Promise<DayNote | null>;
  getAllNotes(): Promise<DayNote[]>;
  addNote(date: string, content: string): Promise<number>;
  updateNote(id: number, content: string): Promise<void>;
  deleteNote(id: number): Promise<void>;
  exportAllData(): Promise<{
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    day_notes: DayNote[];
  }>;
  clearAllData(): Promise<void>;
  importData(data: {
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    day_notes?: DayNote[];
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

  async initialize(): Promise<boolean> {
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
          false, // not encrypted
          'no-encryption', // mode
          1, // version
          false // readonly
        );
      }

      await this.db.open();

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
        ovulation_date TEXT,
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
        category TEXT NOT NULL DEFAULT 'physical',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS day_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_day_notes_date ON day_notes(date);
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

  async addCycle(startDate: string, endDate?: string, ovulationDate?: string): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT INTO cycles (period_start_date, period_end_date, ovulation_date) VALUES (?, ?, ?)',
      [startDate, endDate || null, ovulationDate || null]
    );
    return result.changes?.lastId || 0;
  }

  async updateCycle(id: number, startDate: string, endDate?: string, ovulationDate?: string): Promise<void> {
    const db = this.getDb();
    await db.run(
      'UPDATE cycles SET period_start_date = ?, period_end_date = ?, ovulation_date = ? WHERE id = ?',
      [startDate, endDate || null, ovulationDate || null, id]
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

  async addSymptom(date: string, symptomType: string, cycleId?: number): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT INTO symptoms (date, symptom_type, cycle_id) VALUES (?, ?, ?)',
      [date, symptomType, cycleId || null]
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

  async addCustomSymptomType(name: string, category: 'physical' | 'mood'): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT OR IGNORE INTO custom_symptom_types (name, category) VALUES (?, ?)',
      [name, category]
    );
    return result.changes?.lastId || 0;
  }

  async deleteCustomSymptomType(id: number): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM custom_symptom_types WHERE id = ?', [id]);
  }

  // Day Notes
  async getNoteByDate(date: string): Promise<DayNote | null> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM day_notes WHERE date = ?', [date]);
    return (result.values?.[0] as DayNote) || null;
  }

  async getAllNotes(): Promise<DayNote[]> {
    const db = this.getDb();
    const result = await db.query('SELECT * FROM day_notes ORDER BY date DESC');
    return (result.values || []) as DayNote[];
  }

  async addNote(date: string, content: string): Promise<number> {
    const db = this.getDb();
    const result = await db.run(
      'INSERT INTO day_notes (date, content) VALUES (?, ?)',
      [date, content]
    );
    return result.changes?.lastId || 0;
  }

  async updateNote(id: number, content: string): Promise<void> {
    const db = this.getDb();
    await db.run(
      "UPDATE day_notes SET content = ?, updated_at = datetime('now') WHERE id = ?",
      [content, id]
    );
  }

  async deleteNote(id: number): Promise<void> {
    const db = this.getDb();
    await db.run('DELETE FROM day_notes WHERE id = ?', [id]);
  }

  // Export/Import
  async exportAllData(): Promise<{
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    day_notes: DayNote[];
  }> {
    const cycles = await this.getAllCycles();
    const symptoms = await this.getAllSymptoms();
    const custom_symptom_types = await this.getAllCustomSymptomTypes();
    const day_notes = await this.getAllNotes();

    return { cycles, symptoms, custom_symptom_types, day_notes };
  }

  async clearAllData(): Promise<void> {
    const db = this.getDb();
    await db.execute('DELETE FROM symptoms');
    await db.execute('DELETE FROM custom_symptom_types');
    await db.execute('DELETE FROM day_notes');
    await db.execute('DELETE FROM cycles');
  }

  async importData(data: {
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    day_notes?: DayNote[];
  }): Promise<void> {
    const db = this.getDb();

    // Clear existing data
    await this.clearAllData();

    // Import cycles
    for (const cycle of data.cycles) {
      await db.run(
        'INSERT INTO cycles (id, period_start_date, period_end_date, ovulation_date, created_at) VALUES (?, ?, ?, ?, ?)',
        [cycle.id, cycle.period_start_date, cycle.period_end_date, cycle.ovulation_date, cycle.created_at]
      );
    }

    // Import symptoms
    for (const symptom of data.symptoms) {
      await db.run(
        'INSERT INTO symptoms (id, cycle_id, date, symptom_type) VALUES (?, ?, ?, ?)',
        [symptom.id, symptom.cycle_id, symptom.date, symptom.symptom_type]
      );
    }

    // Import custom symptom types
    for (const customType of data.custom_symptom_types) {
      await db.run(
        'INSERT INTO custom_symptom_types (id, name, category, created_at) VALUES (?, ?, ?, ?)',
        [customType.id, customType.name, customType.category, customType.created_at]
      );
    }

    // Import day notes
    for (const note of data.day_notes || []) {
      await db.run(
        'INSERT INTO day_notes (id, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.created_at, note.updated_at]
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
