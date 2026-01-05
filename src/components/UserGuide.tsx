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
                <strong>Local Storage:</strong> All data is stored in your browser&apos;s local storage (or SQLite on mobile). Nothing is ever transmitted.
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
            </div>
          </section>

          {/* How Calculations Work */}
          <section className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              How Predictions Work
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-900">Cycle Length</p>
                <p>
                  Your average cycle length is calculated from your last 6 recorded cycles.
                  A cycle is measured from one period start to the next. If you have fewer
                  than 2 cycles logged, the app uses 28 days as the default.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Period Duration</p>
                <p>
                  Calculated as the average number of days from period start to period end
                  across your logged cycles. If no end dates are recorded, 5 days is used
                  as the default.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Ovulation Date</p>
                <p>
                  If you manually log ovulation, that date is used. Otherwise, ovulation
                  is estimated as 14 days before the next period is expected
                  (cycle length minus 14 days from period start).
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Fertile Window</p>
                <p>
                  The fertile window spans from 5 days before ovulation to 1 day after
                  ovulation (7 days total). This is shown as a green ring around the
                  underlying phase color.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Phase Calculations</p>
                <p>
                  <strong>- Menstrual:</strong> From period start to period end.<br></br>
                  <strong>- Follicular:</strong> From end of period to day before ovulation.<br></br>
                  <strong>- Ovulation:</strong> The estimated or logged ovulation day.<br></br>
                  <strong>- Luteal:</strong> From day after ovulation until next period.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Future Predictions</p>
                <p>
                  After logging 2 or more cycles, the app projects phases up to 12 months
                  into the future. Predictions use your average cycle length and period
                  duration. Future dates appear slightly transparent to indicate they are
                  estimates, not recorded data.
                </p>
              </div>
            </div>
          </section>

          {/* Calendar Legend */}
          <section className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Calendar Colors
            </h3>
            <div className="space-y-2 text-sm">
              <LegendRow color="bg-phase-menstrual" label="Menstrual phase" />
              <LegendRow color="bg-phase-follicular" label="Follicular phase" />
              <LegendRow color="ring-4 ring-inset ring-phase-fertile" label="Fertile days" />
              <LegendRow color="bg-phase-ovulation" label="Ovulation day" />
              <LegendRow color="bg-phase-luteal" label="Luteal phase" />
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
