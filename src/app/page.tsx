'use client';

import { useApp } from '@/context/AppContext';
import PinScreen from '@/components/PinScreen';
import MainApp from '@/components/MainApp';

export default function Home() {
  const { isUnlocked, isFirstLaunch, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-pink border-t-brand-red mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return <PinScreen isSetup={isFirstLaunch} />;
  }

  return <MainApp />;
}
