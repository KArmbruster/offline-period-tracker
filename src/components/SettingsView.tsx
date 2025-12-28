'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { storePinHash, verifyPin, validatePinFormat } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import type { ExportData } from '@/types';

export default function SettingsView() {
  const { resetApp, lock } = useApp();
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExport = useCallback(async () => {
    try {
      const data = await db.exportAllData();
      const exportData: ExportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        ...data,
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `period-tracker-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  }, []);

  const handleImport = useCallback(async () => {
    const confirmed = confirm(
      'This will delete all existing data and replace it with the imported data. This cannot be undone. Are you sure?'
    );

    if (!confirmed) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;

        if (data.version !== 1) {
          alert('Invalid backup file version.');
          return;
        }

        await db.importData({
          cycles: data.cycles,
          symptoms: data.symptoms,
          custom_symptom_types: data.custom_symptom_types,
          ovulation_markers: data.ovulation_markers,
        });

        alert('Data imported successfully!');
        window.location.reload();
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import data. Please check the file and try again.');
      }
    };

    input.click();
  }, []);

  const handleChangePin = useCallback(async () => {
    setPinError('');

    if (!validatePinFormat(currentPin)) {
      setPinError('Current PIN must be 4 digits');
      return;
    }

    if (!validatePinFormat(newPin)) {
      setPinError('New PIN must be 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('New PINs do not match');
      return;
    }

    setIsProcessing(true);

    const isValid = await verifyPin(currentPin);
    if (!isValid) {
      setPinError('Current PIN is incorrect');
      setIsProcessing(false);
      return;
    }

    try {
      await storePinHash(newPin);
      setIsChangePinOpen(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      alert('PIN changed successfully! Please log in again.');
      lock();
    } catch (error) {
      console.error('Failed to change PIN:', error);
      setPinError('Failed to change PIN. Please try again.');
    }

    setIsProcessing(false);
  }, [currentPin, newPin, confirmPin, lock]);

  const handleReset = useCallback(async () => {
    const confirmed = confirm(
      'This will delete ALL data including your PIN. This cannot be undone. Are you absolutely sure?'
    );

    if (!confirmed) return;

    const doubleConfirmed = confirm(
      'Last chance! All your period tracking data will be permanently deleted.'
    );

    if (!doubleConfirmed) return;

    await resetApp();
  }, [resetApp]);

  return (
    <div className="p-4">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Settings</h1>

      <div className="space-y-4">
        {/* Change PIN */}
        <SettingsButton
          label="Change PIN"
          description="Update your 4-digit PIN"
          onClick={() => setIsChangePinOpen(true)}
        />

        {/* Export Data */}
        <SettingsButton
          label="Export Data"
          description="Save your data as a JSON file"
          onClick={handleExport}
        />

        {/* Import Data */}
        <SettingsButton
          label="Import Data"
          description="Restore from a backup file"
          onClick={handleImport}
          variant="warning"
        />

        {/* Reset App */}
        <SettingsButton
          label="Reset App"
          description="Delete all data and start fresh"
          onClick={handleReset}
          variant="danger"
        />
      </div>

      {/* About Section */}
      <div className="mt-8 rounded-lg bg-gray-50 p-4 text-center">
        <h2 className="font-medium text-gray-900">Offline Period Tracker</h2>
        <p className="mt-1 text-sm text-gray-600">
          Privacy-first. 100% offline.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Your data never leaves your device.
        </p>
      </div>

      {/* Change PIN Drawer */}
      <Drawer open={isChangePinOpen} onOpenChange={setIsChangePinOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Change PIN</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Current PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="h-12 text-center text-xl tracking-widest"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                New PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="h-12 text-center text-xl tracking-widest"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Confirm New PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="h-12 text-center text-xl tracking-widest"
              />
            </div>

            {pinError && (
              <p className="text-sm text-red-600">{pinError}</p>
            )}

            <Button
              className="h-14 w-full bg-brand-red text-white hover:bg-brand-red/90"
              onClick={handleChangePin}
              disabled={isProcessing}
            >
              {isProcessing ? 'Changing...' : 'Change PIN'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

interface SettingsButtonProps {
  label: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'warning' | 'danger';
}

function SettingsButton({
  label,
  description,
  onClick,
  variant = 'default',
}: SettingsButtonProps) {
  const variantStyles = {
    default: 'border-gray-200 hover:bg-gray-50',
    warning: 'border-yellow-200 hover:bg-yellow-50',
    danger: 'border-red-200 hover:bg-red-50',
  };

  const textStyles = {
    default: 'text-gray-900',
    warning: 'text-yellow-800',
    danger: 'text-red-600',
  };

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col items-start rounded-lg border p-4 text-left transition-colors ${variantStyles[variant]}`}
    >
      <span className={`font-medium ${textStyles[variant]}`}>{label}</span>
      <span className="text-sm text-gray-500">{description}</span>
    </button>
  );
}
