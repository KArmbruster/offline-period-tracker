'use client';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuide({ isOpen, onClose }: UserGuideProps) {
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>User Guide</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-8">
          {/* Privacy Section */}
          <section className="mb-6">
            <h3 className="mb-2 text-base font-semibold text-gray-900">
              How Your Data is Protected
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>100% Offline:</strong> This app runs entirely on your device. No servers, no cloud, no internet connection required after installation.
              </p>
              <p>
                <strong>Local Storage:</strong> All data is stored in your browser&apos;s local storage (or encrypted SQLite on mobile). Nothing is ever transmitted.
              </p>
              <p>
                <strong>PIN Protection:</strong> Your 4-digit PIN encrypts your data. Without it, your data cannot be accessed.
              </p>
              <p>
                <strong>No Recovery:</strong> If you forget your PIN, there is no way to recover your data. This is intentional for maximum privacy.
              </p>
              <p>
                <strong>No Analytics:</strong> Zero tracking, zero analytics, zero third-party services.
              </p>
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Features
            </h3>
            <div className="space-y-4">
              <FeatureItem
                title="Calendar View"
                description="View and manage your cycle. Tap any past date to log data."
                howTo="Tap the Calendar tab at the bottom."
              />
              <FeatureItem
                title="Log Period Start"
                description="Mark when your period begins. This creates a new cycle."
                howTo="Tap a date, then select the red 'Start' button."
              />
              <FeatureItem
                title="Log Period End"
                description="Mark when your period ends."
                howTo="Tap a date within a cycle, then select the green 'End' button."
              />
              <FeatureItem
                title="Log Ovulation"
                description="Record your actual ovulation date if you track it."
                howTo="Tap a date within a cycle, then select the 'Ovulation' button."
              />
              <FeatureItem
                title="Track Symptoms"
                description="Log physical symptoms, flow intensity, and mood for any day."
                howTo="Tap a date to open the drawer, then tap symptoms to toggle them."
              />
              <FeatureItem
                title="Custom Symptoms"
                description="Create your own symptom types to track."
                howTo="In the date drawer, tap 'Add custom symptom' and choose a category."
              />
              <FeatureItem
                title="Daily Notes"
                description="Add free-text notes to any day."
                howTo="Tap a date, scroll down to the Note section, and type your note."
              />
              <FeatureItem
                title="Cycle Predictions"
                description="After 2+ cycles, the app predicts future phases based on your averages."
                howTo="Future dates on the calendar show predicted phases (slightly transparent)."
              />
              <FeatureItem
                title="Insights"
                description="View your cycle statistics and common symptoms by phase."
                howTo="Tap the Insights tab at the bottom."
              />
              <FeatureItem
                title="Export Data"
                description="Download all your data as a JSON file for backup."
                howTo="Settings > Export Data"
              />
              <FeatureItem
                title="Import Data"
                description="Restore from a previously exported backup file."
                howTo="Settings > Import Data (replaces all current data)"
              />
              <FeatureItem
                title="Change PIN"
                description="Update your 4-digit PIN."
                howTo="Settings > Change PIN"
              />
            </div>
          </section>

          {/* Calendar Legend */}
          <section className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Calendar Colors
            </h3>
            <div className="space-y-2 text-sm">
              <LegendRow color="bg-phase-menstrual" label="Menstrual phase (period days)" />
              <LegendRow color="bg-phase-follicular" label="Follicular phase (after period, before fertile window)" />
              <LegendRow color="ring-4 ring-inset ring-phase-fertile" label="Fertile window (green ring)" />
              <LegendRow color="bg-phase-ovulation" label="Ovulation day" />
              <LegendRow color="bg-phase-luteal" label="Luteal phase (after ovulation)" />
            </div>
          </section>

          {/* Icons Legend */}
          <section>
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Calendar Icons
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Circle (top-left):</strong> Date has a marker (period start, end, or ovulation)</p>
              <p><strong>Star (top-right):</strong> Symptoms logged for this day</p>
              <p><strong>Pen (bottom-right):</strong> Note saved for this day</p>
            </div>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function FeatureItem({
  title,
  description,
  howTo,
}: {
  title: string;
  description: string;
  howTo: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <h4 className="font-medium text-gray-900">{title}</h4>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <p className="mt-1 text-xs text-gray-500">
        <span className="font-medium">How:</span> {howTo}
      </p>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-5 w-5 rounded ${color}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}
