'use client';

import { useApp } from '@/context/AppContext';
import OnboardingScreen from '@/components/OnboardingScreen';
import MainApp from '@/components/MainApp';

export default function Home() {
  const { isFirstLaunch, isLoading, completeOnboarding } = useApp();

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

  if (isFirstLaunch) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  return <MainApp />;
}
