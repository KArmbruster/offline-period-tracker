'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { validatePinFormat } from '@/lib/crypto';
import { Button } from '@/components/ui/button';

const basePath = process.env.NODE_ENV === 'production' ? '/offline-period-tracker' : '';

interface PinScreenProps {
  isSetup: boolean;
}

export default function PinScreen({ isSetup }: PinScreenProps) {
  const { unlock, setupPin, resetApp } = useApp();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDigitPress = useCallback((digit: string) => {
    setError('');

    if (step === 'enter') {
      if (pin.length < 4) {
        setPin(prev => prev + digit);
      }
    } else {
      if (confirmPin.length < 4) {
        setConfirmPin(prev => prev + digit);
      }
    }
  }, [step, pin.length, confirmPin.length]);

  const handleBackspace = useCallback(() => {
    setError('');

    if (step === 'enter') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (isProcessing) return;

    if (isSetup) {
      // Setting up new PIN
      if (step === 'enter') {
        if (!validatePinFormat(pin)) {
          setError('Please enter a 4-digit PIN');
          return;
        }
        setStep('confirm');
      } else {
        if (pin !== confirmPin) {
          setError('PINs do not match');
          setConfirmPin('');
          return;
        }

        setIsProcessing(true);
        const success = await setupPin(pin);
        setIsProcessing(false);

        if (!success) {
          setError('Failed to setup PIN. Please try again.');
          setPin('');
          setConfirmPin('');
          setStep('enter');
        }
      }
    } else {
      // Unlocking with existing PIN
      if (!validatePinFormat(pin)) {
        setError('Please enter a 4-digit PIN');
        return;
      }

      setIsProcessing(true);
      const success = await unlock(pin);
      setIsProcessing(false);

      if (!success) {
        setError('Incorrect PIN');
        setPin('');
      }
    }
  }, [isSetup, step, pin, confirmPin, setupPin, unlock, isProcessing]);

  const handleReset = useCallback(async () => {
    if (confirm('This will delete all data and cannot be undone. Are you sure?')) {
      await resetApp();
    }
  }, [resetApp]);

  const currentPin = step === 'enter' ? pin : confirmPin;
  const title = isSetup
    ? step === 'enter'
      ? 'Create Your PIN'
      : 'Confirm Your PIN'
    : 'Welcome Back';
  const subtitle = isSetup
    ? step === 'enter'
      ? 'Choose a 4-digit PIN to protect your data. Remember: if you forget this PIN, your data cannot be recovered.'
      : 'Re-enter your PIN to confirm'
    : 'Enter your 4-digit PIN to unlock';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 safe-area-top">
      <div className="w-full max-w-sm">
        {/* App Icon */}
        <div className="mb-8 flex justify-center">
          <img
            src={`${basePath}/icons/icon-192.png`}
            alt="Period Tracker"
            className="h-20 w-20"
          />
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
        </div>

        {/* PIN Dots */}
        <div className="mb-8 flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full transition-colors ${
                i < currentPin.length
                  ? 'bg-brand-red'
                  : 'border-2 border-gray-300 bg-white'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <p className="mb-4 text-center text-sm text-red-600">{error}</p>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <Button
              key={digit}
              variant="outline"
              className="h-16 text-2xl font-medium hover:bg-brand-pink/20"
              onClick={() => handleDigitPress(digit.toString())}
              disabled={isProcessing}
            >
              {digit}
            </Button>
          ))}
          <Button
            variant="ghost"
            className="h-16 text-sm text-gray-500"
            onClick={handleBackspace}
            disabled={isProcessing || currentPin.length === 0}
          >
            Delete
          </Button>
          <Button
            variant="outline"
            className="h-16 text-2xl font-medium hover:bg-brand-pink/20"
            onClick={() => handleDigitPress('0')}
            disabled={isProcessing}
          >
            0
          </Button>
          <Button
            className="h-16 bg-brand-red text-white hover:bg-brand-red/90"
            onClick={handleSubmit}
            disabled={isProcessing || currentPin.length !== 4}
          >
            {isProcessing ? '...' : step === 'confirm' || !isSetup ? 'OK' : 'Next'}
          </Button>
        </div>

        {/* Reset Option (only when not in setup mode) */}
        {!isSetup && (
          <div className="mt-8 text-center">
            <button
              className="text-sm text-gray-500 underline"
              onClick={handleReset}
            >
              Forgot PIN? Reset App
            </button>
          </div>
        )}

        {/* Back button during confirmation */}
        {isSetup && step === 'confirm' && (
          <div className="mt-4 text-center">
            <button
              className="text-sm text-gray-500 underline"
              onClick={() => {
                setStep('enter');
                setConfirmPin('');
                setError('');
              }}
            >
              Go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
