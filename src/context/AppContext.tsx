'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/db';

interface AppContextType {
  isFirstLaunch: boolean;
  isLoading: boolean;
  completeOnboarding: () => void;
  resetApp: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const ONBOARDING_COMPLETE_KEY = 'pt_onboarding_complete';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Check if onboarding is complete and initialize database on mount
  useEffect(() => {
    const init = async () => {
      const onboardingComplete = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
      setIsFirstLaunch(!onboardingComplete);

      // Initialize database (no passphrase needed)
      await db.initialize();

      setIsLoading(false);
    };

    init();
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setIsFirstLaunch(false);
  }, []);

  const resetApp = useCallback(async () => {
    try {
      // Close database connection if open
      if (db.isReady()) {
        await db.close();
      }

      // Clear all database data
      await db.clearAllData();

      // Clear onboarding flag
      localStorage.removeItem(ONBOARDING_COMPLETE_KEY);

      // Reset state
      setIsFirstLaunch(true);
    } catch (error) {
      console.error('Reset failed:', error);
      // Force clear localStorage anyway
      await db.clearAllData();
      localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      setIsFirstLaunch(true);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        isFirstLaunch,
        isLoading,
        completeOnboarding,
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
