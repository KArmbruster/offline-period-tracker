'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PinScreen from '@/components/PinScreen';
import OnboardingScreen from '@/components/OnboardingScreen';
import MainApp from '@/components/MainApp';

export default function Home() {
  const { isUnlocked, isFirstLaunch, isLoading } = useApp();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white safe-area-top">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-pink border-t-brand-red mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    // First-time user: show onboarding first, then PIN setup
    if (isFirstLaunch && !onboardingComplete) {
      return <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />;
    }
    // After onboarding (or returning user): show PIN screen
    return <PinScreen isSetup={isFirstLaunch} />;
  }

  return <MainApp />;
}
