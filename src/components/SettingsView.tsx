'use client';

import { basePath } from '@/lib/base-path';
import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { BookOpen, ChevronRight, Download, Trash2, Upload } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import UserGuide from '@/components/UserGuide';
import ConfirmSheet, { type ConfirmSheetContent } from '@/components/ConfirmSheet';
import type { ExportData } from '@/types';

export default function SettingsView() {
  const { resetApp } = useApp();
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [sheet, setSheet] = useState<ConfirmSheetContent | null>(null);

  // A message with a single OK button
  const showNotice = useCallback((title: string, message: string, onClose?: () => void) => {
    setSheet({ title, message, confirmLabel: 'OK', onConfirm: onClose });
  }, []);

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
      a.download = `period-tracker-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      showNotice('Export failed', 'Your data could not be exported. Try again.');
    }
  }, [showNotice]);

  // Opens the file picker and restores the chosen backup
  const pickImportFile = useCallback(() => {
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
          showNotice(
            'Backup not supported',
            'This backup was made with a different version of the app. Nothing was changed.'
          );
          return;
        }

        // Refuse anything that is not shaped like a backup before wiping data
        const hasValidShape =
          Array.isArray(data.cycles) &&
          Array.isArray(data.symptoms) &&
          Array.isArray(data.custom_symptom_types) &&
          (data.day_notes === undefined || Array.isArray(data.day_notes)) &&
          data.cycles.every((c) => typeof c?.period_start_date === 'string') &&
          data.symptoms.every((s) => typeof s?.date === 'string' && typeof s?.symptom_type === 'string');

        if (!hasValidShape) {
          showNotice('Not a backup file', 'This file is not a valid backup. Nothing was changed.');
          return;
        }

        await db.importData({
          cycles: data.cycles,
          symptoms: data.symptoms,
          custom_symptom_types: data.custom_symptom_types,
          day_notes: data.day_notes || [],
        });

        showNotice('Data imported', 'Your backup has been restored.', () => window.location.reload());
      } catch (error) {
        console.error('Import failed:', error);
        showNotice('Import failed', 'The file could not be read. Check that it is a backup file and try again.');
      }
    };

    input.click();
  }, [showNotice]);

  const handleImport = () => {
    setSheet({
      title: 'Replace all data?',
      message:
        'Importing a backup deletes everything on this device and replaces it with the file you choose. This cannot be undone.',
      confirmLabel: 'Choose backup file',
      cancelLabel: 'Cancel',
      danger: true,
      onConfirm: pickImportFile,
    });
  };

  // Two steps on purpose: resetting cannot be undone
  const handleReset = () => {
    setSheet({
      title: 'Delete all data?',
      message:
        'This removes every period, symptom and note from this device. Export your data first if you want to keep a copy.',
      confirmLabel: 'Delete everything',
      cancelLabel: 'Cancel',
      danger: true,
      onConfirm: () =>
        setSheet({
          title: 'Are you sure?',
          message: 'Your tracking data will be permanently deleted. This cannot be undone.',
          confirmLabel: 'Yes, delete all data',
          cancelLabel: 'Keep my data',
          danger: true,
          onConfirm: () => {
            void resetApp();
          },
        }),
    });
  };

  return (
    <div className="p-4">
      <h1 className="mb-5 text-2xl font-semibold text-gray-900">Settings</h1>

      <SettingsGroup title="Help">
        <SettingsRow
          icon={<BookOpen className="h-5 w-5" />}
          label="User guide"
          description="How the app works and how your data is protected"
          onClick={() => setIsUserGuideOpen(true)}
        />
      </SettingsGroup>

      <SettingsGroup title="Your data">
        <SettingsRow
          icon={<Download className="h-5 w-5" />}
          label="Export data"
          description="Save a backup file. Do this regularly: there is no other backup."
          onClick={handleExport}
        />
        <SettingsRow
          icon={<Upload className="h-5 w-5" />}
          label="Import data"
          description="Restore a backup file. Replaces everything on this device."
          onClick={handleImport}
        />
      </SettingsGroup>

      <SettingsGroup title="Danger zone">
        <SettingsRow
          icon={<Trash2 className="h-5 w-5" />}
          label="Reset app"
          description="Delete all data and start fresh"
          onClick={handleReset}
          danger
        />
      </SettingsGroup>

      {/* About Section */}
      <div className="mt-8 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${basePath}/icons/icon-192.png`} alt="" className="mb-3 h-14 w-14 rounded-2xl" />
        <h2 className="font-medium text-gray-900">Offline Period Tracker</h2>
        <p className="mt-1 text-sm text-gray-600">
          Privacy-first. 100% offline. Your data never leaves your device.
        </p>
        <p className="mt-2 text-xs text-gray-400">Version 1.2</p>
      </div>

      {/* Confirmations and notices */}
      <ConfirmSheet content={sheet} onClose={() => setSheet(null)} />

      {/* User Guide Drawer */}
      <UserGuide
        isOpen={isUserGuideOpen}
        onClose={() => setIsUserGuideOpen(false)}
      />
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-sm font-medium text-gray-500">{title}</h2>
      <div className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200">
        {children}
      </div>
    </section>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  danger?: boolean;
}

function SettingsRow({ icon, label, description, onClick, danger = false }: SettingsRowProps) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 bg-white p-4 text-left transition-colors active:bg-gray-50"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          danger ? 'bg-red-50 text-red-600' : 'bg-brand-pink/15 text-brand-red'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${danger ? 'text-red-600' : 'text-gray-900'}`}>{label}</span>
        <span className="block text-sm text-gray-500">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
    </button>
  );
}
