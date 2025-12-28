/**
 * Web/localStorage implementation of the database service
 * Used for development and PWA mode when native SQLite is not available
 */

import type { Cycle, Symptom, CustomSymptomType, OvulationMarker } from '@/types';

const STORAGE_KEYS = {
  CYCLES: 'pt_cycles',
  SYMPTOMS: 'pt_symptoms',
  CUSTOM_SYMPTOM_TYPES: 'pt_custom_symptom_types',
  OVULATION_MARKERS: 'pt_ovulation_markers',
  INITIALIZED: 'pt_initialized',
};

class WebDatabaseService {
  private isInitialized = false;
  private nextIds: Record<string, number> = {
    cycles: 1,
    symptoms: 1,
    custom_symptom_types: 1,
    ovulation_markers: 1,
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
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);

    this.nextIds.cycles = Math.max(1, ...cycles.map(c => c.id + 1), 1);
    this.nextIds.symptoms = Math.max(1, ...symptoms.map(s => s.id + 1), 1);
    this.nextIds.custom_symptom_types = Math.max(1, ...customTypes.map(c => c.id + 1), 1);
    this.nextIds.ovulation_markers = Math.max(1, ...markers.map(m => m.id + 1), 1);
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

  async addCycle(startDate: string, endDate?: string): Promise<number> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    const id = this.nextIds.cycles++;
    const newCycle: Cycle = {
      id,
      period_start_date: startDate,
      period_end_date: endDate || null,
      created_at: new Date().toISOString(),
    };
    cycles.push(newCycle);
    this.setStoredData(STORAGE_KEYS.CYCLES, cycles);
    return id;
  }

  async updateCycle(id: number, startDate: string, endDate?: string): Promise<void> {
    const cycles = this.getStoredData<Cycle>(STORAGE_KEYS.CYCLES);
    const index = cycles.findIndex(c => c.id === id);
    if (index !== -1) {
      cycles[index] = {
        ...cycles[index],
        period_start_date: startDate,
        period_end_date: endDate || null,
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

  async addSymptom(date: string, symptomType: string, cycleId?: number, notes?: string): Promise<number> {
    const symptoms = this.getStoredData<Symptom>(STORAGE_KEYS.SYMPTOMS);
    const id = this.nextIds.symptoms++;
    const newSymptom: Symptom = {
      id,
      cycle_id: cycleId || null,
      date,
      symptom_type: symptomType,
      notes: notes || null,
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

  async addCustomSymptomType(name: string): Promise<number> {
    const types = this.getStoredData<CustomSymptomType>(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES);

    // Check if already exists
    if (types.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      return 0;
    }

    const id = this.nextIds.custom_symptom_types++;
    const newType: CustomSymptomType = {
      id,
      name,
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

  // Ovulation Markers
  async getOvulationMarkerByCycleId(cycleId: number): Promise<OvulationMarker | null> {
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);
    return markers.find(m => m.cycle_id === cycleId) || null;
  }

  async getAllOvulationMarkers(): Promise<OvulationMarker[]> {
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);
    return markers.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async addOvulationMarker(cycleId: number, date: string, isConfirmed: boolean): Promise<number> {
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);
    const id = this.nextIds.ovulation_markers++;
    const newMarker: OvulationMarker = {
      id,
      cycle_id: cycleId,
      date,
      is_confirmed: isConfirmed,
    };
    markers.push(newMarker);
    this.setStoredData(STORAGE_KEYS.OVULATION_MARKERS, markers);
    return id;
  }

  async updateOvulationMarker(id: number, date: string, isConfirmed: boolean): Promise<void> {
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);
    const index = markers.findIndex(m => m.id === id);
    if (index !== -1) {
      markers[index] = {
        ...markers[index],
        date,
        is_confirmed: isConfirmed,
      };
      this.setStoredData(STORAGE_KEYS.OVULATION_MARKERS, markers);
    }
  }

  async deleteOvulationMarker(id: number): Promise<void> {
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);
    this.setStoredData(STORAGE_KEYS.OVULATION_MARKERS, markers.filter(m => m.id !== id));
  }

  async getOvulationMarkerByDate(date: string): Promise<OvulationMarker | null> {
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);
    return markers.find(m => m.date === date) || null;
  }

  async deleteOvulationMarkerByDate(date: string): Promise<void> {
    const markers = this.getStoredData<OvulationMarker>(STORAGE_KEYS.OVULATION_MARKERS);
    this.setStoredData(STORAGE_KEYS.OVULATION_MARKERS, markers.filter(m => m.date !== date));
  }

  // Export/Import
  async exportAllData(): Promise<{
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    ovulation_markers: OvulationMarker[];
  }> {
    return {
      cycles: await this.getAllCycles(),
      symptoms: await this.getAllSymptoms(),
      custom_symptom_types: await this.getAllCustomSymptomTypes(),
      ovulation_markers: await this.getAllOvulationMarkers(),
    };
  }

  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.CYCLES);
    localStorage.removeItem(STORAGE_KEYS.SYMPTOMS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES);
    localStorage.removeItem(STORAGE_KEYS.OVULATION_MARKERS);
    this.nextIds = {
      cycles: 1,
      symptoms: 1,
      custom_symptom_types: 1,
      ovulation_markers: 1,
    };
  }

  async importData(data: {
    cycles: Cycle[];
    symptoms: Symptom[];
    custom_symptom_types: CustomSymptomType[];
    ovulation_markers: OvulationMarker[];
  }): Promise<void> {
    await this.clearAllData();

    this.setStoredData(STORAGE_KEYS.CYCLES, data.cycles);
    this.setStoredData(STORAGE_KEYS.SYMPTOMS, data.symptoms);
    this.setStoredData(STORAGE_KEYS.CUSTOM_SYMPTOM_TYPES, data.custom_symptom_types);
    this.setStoredData(STORAGE_KEYS.OVULATION_MARKERS, data.ovulation_markers);

    this.loadNextIds();
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const webDb = new WebDatabaseService();
