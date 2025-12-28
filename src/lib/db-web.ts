/**
 * Web/localStorage implementation of the database service
 * Used for development and PWA mode when native SQLite is not available
 */

import type { Cycle, Symptom, CustomSymptomType, DayNote } from '@/types';

const STORAGE_KEYS = {
  CYCLES: 'pt_cycles',
  SYMPTOMS: 'pt_symptoms',
  CUSTOM_SYMPTOM_TYPES: 'pt_custom_symptom_types',
  DAY_NOTES: 'pt_day_notes',
  INITIALIZED: 'pt_initialized',
};

class WebDatabaseService {
  private isInitialized = false;
  private nextIds: Record<string, number> = {
    cycles: 1,
    symptoms: 1,
    custom_symptom_types: 1,
    day_notes: 1,
  };

  async initialize(_passphrase: string): Promise<boolean> {
    try {
      // Load next IDs from existing data
      this.loadNextIds();
      this.isInitialized = true;
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      return true;
    } catch (error) {
      console.error('Web database initialization failed:', error);
      return false;
    }
  }

  private loadNextIds(): void {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    const symptoms = this.getStoredData<Symptom>(STORAGE_KEYS.SYMPTOMS);
    const customTypes = this.getStoredData<CustomSymptomType>(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES);
    const dayNotes = this.getStoredData<DayNote>(STORAGE_KEYS.DAY_NOTES);

    this.nextIds.cycles = Math.max(1, ...cycles.map(c => c.id + 1), 1);
    this.nextIds.symptoms = Math.max(1, ...symptoms.map(s => s.id + 1), 1);
    this.nextIds.custom_symptom_types = Math.max(1, ...customTypes.map(c => c.id + 1), 1);
    this.nextIds.day_notes = Math.max(1, ...dayNotes.map(n => n.id + 1), 1);
  }

  private getStoredData<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setStoredData<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  async close(): Promise<void> {
    this.isInitialized = false;
  }

  // Cycles
  async getAllCycles(): Promise<Cycle[]> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    return cycles.sort((a, b) =>
      new Date(b.period_start_date).getTime() - new Date(a.period_start_date).getTime()
    );
  }

  async getCycleById(id: number): Promise<Cycle | null> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    return cycles.find(c => c.id === id) || null;
  }

  async addCycle(startDate: string, endDate?: string, ovulationDate?: string): Promise<number> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    const id = this.nextIds.cycles++;
    const newCycle: Cycle = {
      id,
      period_start_date: startDate,
      period_end_date: endDate || null,
      ovulation_date: ovulationDate || null,
      created_at: new Date().toISOString(),
    };
    cycles.push(newCycle);
    this.setStoredData(STORAGE_KEYS.CYCLES, cycles);
    return id;
  }

  async updateCycle(id: number, startDate: string, endDate?: string, ovulationDate?: string): Promise<void> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    const index = cycles.findIndex(c => c.id === id);
    if (index !== -1) {
      cycles[index] = {
        ...cycles[index],
        period_start_date: startDate,
        period_end_date: endDate || null,
        ovulation_date: ovulationDate || null,
      };
      this.setStoredData(STORAGE_KEYS.CYCLES, cycles);
    }
  }

  async deleteCycle(id: number): Promise<void> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    this.setStoredData(STORAGE_KEYS.CYCLES, cycles.filter(c => c.id !== id));
  }

  async getCycleByDate(date: string): Promise<Cycle | null> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    return cycles.find(c =>
      c.period_start_date <= date &&
      (c.period_end_date === null || c.period_end_date >= date)
    ) || null;
  }

  // Symptoms
  async getSymptomsByDate(date: string): Promise<Symptom[]> {
    const symptoms = this.getStoredData<Symptom>(STORAGE_KEYS.SYMPTOMS);
    return symptoms.filter(s => s.date === date);
  }

  async getSymptomsByCycleId(cycleId: number): Promise<Symptom[]> {
    const symptoms = this.getStoredData<Symptom>(STORAGE_KEYS.SYMPTOMS);
    return symptoms.filter(s => s.cycle_id === cycleId);
  }

  async getAllSymptoms(): Promise<Symptom[]> {
    const symptoms = this.getStoredData<Symptom>(STORAGE_KEYS.SYMPTOMS);
    return symptoms.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async addSymptom(date: string, symptomType: string, cycleId?: number): Promise<number> {
    const symptoms = this.getStoredData<Symptom>(STORAGE_KEYS.SYMPTOMS);
    const id = this.nextIds.symptoms++;
    const newSymptom: Symptom = {
      id,
      cycle_id: cycleId || null,
      date,
      symptom_type: symptomType,
    };
    symptoms.push(newSymptom);
    this.setStoredData(STORAGE_KEYS.SYMPTOMS, symptoms);
    return id;
  }

  async deleteSymptom(id: number): Promise<void> {
    const symptoms = this.getStoredData<Symptom>(STORAGE_KEYS.SYMPTOMS);
    this.setStoredData(STORAGE_KEYS.SYMPTOMS, symptoms.filter(s => s.id !== id));
  }

  // Custom Symptom Types
  async getAllCustomSymptomTypes(): Promise<CustomSymptomType[]> {
    const types = this.getStoredData<CustomSymptomType>(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES);
    return types.sort((a, b) => a.name.localeCompare(b.name));
  }

  async addCustomSymptomType(name: string, category: 'physical' | 'mood'): Promise<number> {
    const types = this.getStoredData<CustomSymptomType>(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES);

    // Check if already exists
    if (types.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      return 0;
    }

    const id = this.nextIds.custom_symptom_types++;
    const newType: CustomSymptomType = {
      id,
      name,
      category,
      created_at: new Date().toISOString(),
    };
    types.push(newType);
    this.setStoredData(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES, types);
    return id;
  }

  async deleteCustomSymptomType(id: number): Promise<void> {
    const types = this.getStoredData<CustomSymptomType>(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES);
    this.setStoredData(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES, types.filter(t => t.id !== id));
  }

  // Day Notes
  async getNoteByDate(date: string): Promise<DayNote | null> {
    const notes = this.getStoredData<DayNote>(STORAGE_KEYS.DAY_NOTES);
    return notes.find(n => n.date === date) || null;
  }

  async getAllNotes(): Promise<DayNote[]> {
    const notes = this.getStoredData<DayNote>(STORAGE_KEYS.DAY_NOTES);
    return notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async addNote(date: string, content: string): Promise<number> {
    const notes = this.getStoredData<DayNote>(STORAGE_KEYS.DAY_NOTES);
    const id = this.nextIds.day_notes++;
    const now = new Date().toISOString();
    const newNote: DayNote = {
      id,
      date,
      content,
      created_at: now,
      updated_at: now,
    };
    notes.push(newNote);
    this.setStoredData(STORAGE_KEYS.DAY_NOTES, notes);
    return id;
  }

  async updateNote(id: number, content: string): Promise<void> {
    const notes = this.getStoredData<DayNote>(STORAGE_KEYS.DAY_NOTES);
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) {
      notes[index] = {
        ...notes[index],
        content,
        updated_at: new Date().toISOString(),
      };
      this.setStoredData(STORAGE_KEYS.DAY_NOTES, notes);
    }
  }

  async deleteNote(id: number): Promise<void> {
    const notes = this.getStoredData<DayNote>(STORAGE_KEYS.DAY_NOTES);
    this.setStoredData(STORAGE_KEYS.DAY_NOTES, notes.filter(n => n.id !== id));
  }

  // Export/Import
  async exportAllData(): Promise<{
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    day_notes: DayNote[];
  }> {
    return {
      cycles: await this.getAllCycles(),
      symptoms: await this.getAllSymptoms(),
      custom_symptom_types: await this.getAllCustomSymptomTypes(),
      day_notes: this.getStoredData<DayNote>(STORAGE_KEYS.DAY_NOTES),
    };
  }

  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.CYCLES);
    localStorage.removeItem(STORAGE_KEYS.SYMPTOMS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES);
    localStorage.removeItem(STORAGE_KEYS.DAY_NOTES);
    localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
    this.nextIds = {
      cycles: 1,
      symptoms: 1,
      custom_symptom_types: 1,
      day_notes: 1,
    };
    this.isInitialized = false;
  }

  async importData(data: {
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    day_notes?: DayNote[];
  }): Promise<void> {
    await this.clearAllData();

    this.setStoredData(STORAGE_KEYS.CYCLES, data.cycles);
    this.setStoredData(STORAGE_KEYS.SYMPTOMS, data.symptoms);
    this.setStoredData(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES, data.custom_symptom_types);
    this.setStoredData(STORAGE_KEYS.DAY_NOTES, data.day_notes || []);

    this.loadNextIds();
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const webDb = new WebDatabaseService();
