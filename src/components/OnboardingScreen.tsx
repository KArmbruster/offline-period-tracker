'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const basePath = process.env.NODE_ENV === 'production' ? '/offline-period-tracker' : '';

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface SlideData {
  title: string;
  content?: string;
  isInstall?: boolean;
}

const slides: SlideData[] = [
  {
    title: 'Welcome to Offline Period Tracker',
    content: 'A simple, private period tracker designed with your privacy as the top priority.',
  },
  {
    title: '100% Offline',
    content: 'This app works entirely on your device. Even though it runs in your browser, no data ever leaves your phone or computer. There are no servers, no accounts, no cloud sync.',
  },
  {
    title: 'Your Data Stays Yours',
    content: 'No analytics, no tracking, no third-party services. Your menstrual health data is stored only on this device.',
  },
  {
    title: 'Install as App',
    isInstall: true,
  },
];

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 safe-area-top">
      <div className="w-full max-w-sm">
        {/* App Icon */}
        <div className="mb-14 flex justify-center">
          <img
            src={`${basePath}/icons/icon-192.png`}
            alt="Period Tracker"
            className="h-24 w-24"
          />
        </div>

        {/* Progress dots */}
        <div className="mb-8 flex justify-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === currentSlide
                  ? 'bg-brand-red'
                  : i < currentSlide
                    ? 'bg-brand-pink'
                    : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            {slide.title}
          </h1>
          {slide.content && (
            <p className="text-base leading-relaxed text-gray-600">
              {slide.content}
            </p>
          )}
          {slide.isInstall && (
            <div className="text-left space-y-4">
              <p className="text-gray-600 text-sm text-center mb-4">
                For the best experience, install this app on your home screen:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-800 mb-2">Android (Chrome)</p>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Tap the menu (3 dots) in your browser</li>
                  <li>Select "Install app" or "Add to Home screen"</li>
                  <li>Tap "Install" to confirm</li>
                </ol>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-800 mb-2">iPhone/iPad (Safari)</p>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Tap the Share button (square with arrow)</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" to confirm</li>
                </ol>
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                You can skip this step and do it later from your browser.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentSlide > 0 && (
            <Button
              variant="outline"
              className="flex-1 h-14 text-base"
              onClick={handleBack}
            >
              Back
            </Button>
          )}
          <Button
            className={`${currentSlide > 0 ? 'flex-1' : 'w-full'} h-14 text-base bg-brand-red text-white hover:bg-brand-red/90`}
            onClick={handleNext}
          >
            {isLastSlide ? 'Get Started' : 'Continue'}
          </Button>
        </div>

        {/* Skip option for first few slides */}
        {!isLastSlide && (
          <div className="mt-4 text-center">
            <button
              className="text-sm text-gray-400 underline"
              onClick={onComplete}
            >
              Skip introduction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
