'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/db';
import { isPinSetup, verifyPin, storePinHash, deriveEncryptionKey, clearAllStoredData } from '@/lib/crypto';

interface AppContextType {
  isUnlocked: boolean;
  isFirstLaunch: boolean;
  isLoading: boolean;
  unlock: (pin: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<boolean>;
  lock: () => void;
  resetApp: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Check if PIN is setup on mount
  useEffect(() => {
    const checkSetup = () => {
      const pinExists = isPinSetup();
      setIsFirstLaunch(!pinExists);
      setIsLoading(false);
    };

    checkSetup();
  }, []);

  // Handle app visibility changes (auto-lock when app goes to background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsUnlocked(false);
        db.close();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const isValid = await verifyPin(pin);

      if (!isValid) {
        return false;
      }

      const encryptionKey = await deriveEncryptionKey(pin);
      const dbInitialized = await db.initialize(encryptionKey);

      if (!dbInitialized) {
        return false;
      }

      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error('Unlock failed:', error);
      return false;
    }
  }, []);

  const setupPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      await storePinHash(pin);
      const encryptionKey = await deriveEncryptionKey(pin);
      const dbInitialized = await db.initialize(encryptionKey);

      if (!dbInitialized) {
        clearAllStoredData();
        return false;
      }

      setIsFirstLaunch(false);
      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error('PIN setup failed:', error);
      clearAllStoredData();
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    db.close();
  }, []);

  const resetApp = useCallback(async () => {
    try {
      // Clear database if connected
      if (db.isReady()) {
        await db.clearAllData();
        await db.close();
      }

      // Clear stored PIN hash
      clearAllStoredData();

      // Reset state
      setIsUnlocked(false);
      setIsFirstLaunch(true);
    } catch (error) {
      console.error('Reset failed:', error);
      // Force clear localStorage anyway
      clearAllStoredData();
      setIsUnlocked(false);
      setIsFirstLaunch(true);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        isUnlocked,
        isFirstLaunch,
        isLoading,
        unlock,
        setupPin,
        lock,
        resetApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }

  return context;
}
