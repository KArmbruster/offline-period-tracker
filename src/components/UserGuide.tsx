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
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              How Your Data is Protected
            </h3>
            <div className="space-y-4">
              <InfoCard
                title="100% Offline"
                description="This app runs entirely on your device. No servers, no cloud, no internet connection required after installation."
              />
              <InfoCard
                title="Local Storage"
                description="All data is stored in your browser's local storage (or SQLite on mobile). Nothing is ever transmitted."
              />
              <InfoCard
                title="No Analytics"
                description="Zero tracking, zero analytics, zero third-party services."
              />
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Features
            </h3>
            <div className="space-y-4">
              <InfoCard
                title="Calendar View"
                description="View and manage your cycle. Tap any past date to log data."
                howTo="Tap the Calendar tab at the bottom."
              />
              <InfoCard
                title="Log Period Start"
                description="Mark when your period begins. This creates a new cycle."
                howTo="Tap a date, then select the red 'Start' button."
              />
              <InfoCard
                title="Log Period End"
                description="Mark the last day of your period."
                howTo="Tap a date within a cycle, then select the green 'End' button."
              />
              <InfoCard
                title="Log Ovulation"
                description="Record your actual ovulation date if you track it."
                howTo="Tap a date within a cycle, then select the 'Ovulation' button."
              />
              <InfoCard
                title="Track Symptoms"
                description="Log physical symptoms, flow intensity, and mood for any day."
                howTo="Tap a date to open the drawer, then tap symptoms to toggle them."
              />
              <InfoCard
                title="Custom Symptoms"
                description="Create your own symptom types to track."
                howTo="In the date drawer, tap 'Add custom symptom' and choose a category."
              />
              <InfoCard
                title="Daily Notes"
                description="Add free-text notes to any day."
                howTo="Tap a date, scroll down to the Note section, and type your note."
              />
              <InfoCard
                title="Cycle Predictions"
                description="After 2+ cycles, the app predicts future phases based on your averages."
                howTo="Future dates on the calendar show predicted phases (slightly transparent)."
              />
              <InfoCard
                title="Insights"
                description="View your cycle statistics and common symptoms by phase."
                howTo="Tap the Insights tab at the bottom."
              />
              <InfoCard
                title="Export Data"
                description="Download all your data as a JSON file for backup."
                howTo="Settings > Export Data"
              />
              <InfoCard
                title="Import Data"
                description="Restore from a previously exported backup file."
                howTo="Settings > Import Data (replaces all current data)"
              />
            </div>
          </section>

          {/* How Calculations Work */}
          <section className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              How Predictions Work
            </h3>
            <div className="space-y-4">
              <InfoCard
                title="Cycle Length"
                description="Your average cycle length is calculated from your last 6 recorded cycles. A cycle is measured from one period start to the next. If you have fewer than 2 cycles logged, the app uses 28 days as the default."
              />
              <InfoCard
                title="Period Duration"
                description="Calculated as the average number of days from period start to period end across your logged cycles. If no end dates are recorded, 5 days is used as the default."
              />
              <InfoCard
                title="Ovulation Date"
                description="If you manually log ovulation, that date is used. Otherwise, ovulation is estimated as 14 days before the next period is expected (cycle length minus 14 days from period start)."
              />
              <InfoCard
                title="Fertile Window"
                description="The fertile window spans from 5 days before ovulation to 1 day after ovulation (7 days total). This is shown as a green ring around the underlying phase color."
              />
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <h4 className="font-medium text-gray-900">Phase Definitions</h4>
                <div className="mt-1 space-y-1 text-sm text-gray-600">
                  <p><strong>Menstrual:</strong> From period start to period end.</p>
                  <p><strong>Follicular:</strong> From end of period to day before ovulation.</p>
                  <p><strong>Ovulation:</strong> The estimated or logged ovulation day.</p>
                  <p><strong>Luteal:</strong> From day after ovulation until next period.</p>
                </div>
              </div>
              <InfoCard
                title="Future Predictions"
                description="After logging 2 or more cycles, the app projects phases up to 12 months into the future. Predictions use your average cycle length and period duration. Future dates appear slightly transparent to indicate they are estimates, not recorded data."
              />
            </div>
          </section>

          {/* Calendar Legend */}
          <section className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Calendar Colors
            </h3>
            <div className="space-y-4">
              <LegendCard color="bg-phase-menstrual" title="Menstrual Phase" description="Red indicates days during your period." />
              <LegendCard color="bg-phase-follicular" title="Follicular Phase" description="Teal indicates days after your period ends until ovulation." />
              <LegendCard color="ring-4 ring-inset ring-phase-fertile" title="Fertile Days" description="Green ring overlay indicates your fertile window." />
              <LegendCard color="bg-phase-ovulation" title="Ovulation Day" description="Green indicates the estimated or logged ovulation day." />
              <LegendCard color="bg-phase-luteal" title="Luteal Phase" description="Blue indicates days after ovulation until your next period." />
            </div>
          </section>

          {/* Icons Legend */}
          <section>
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Calendar Icons
            </h3>
            <div className="space-y-4">
              <InfoCard
                title="Circle (top-left)"
                description="Date has a marker (period start, end, or ovulation)."
              />
              <InfoCard
                title="Star (top-right)"
                description="Symptoms logged for this day."
              />
              <InfoCard
                title="Pen (bottom-right)"
                description="Note saved for this day."
              />
            </div>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function InfoCard({
  title,
  description,
  howTo,
}: {
  title: string;
  description: string;
  howTo?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <h4 className="font-medium text-gray-900">{title}</h4>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      {howTo && (
        <p className="mt-1 text-xs text-gray-500">
          <span className="font-medium">How:</span> {howTo}
        </p>
      )}
    </div>
  );
}

function LegendCard({
  color,
  title,
  description,
}: {
  color: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center gap-3">
        <div className={`h-5 w-5 shrink-0 rounded ${color}`} />
        <h4 className="font-medium text-gray-900">{title}</h4>
      </div>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
    </div>
  );
}
