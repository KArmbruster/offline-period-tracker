import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.privacyfirst.periodtracker',
  appName: 'Offline Period Tracker',
  webDir: 'out',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: true,
      iosKeychainPrefix: 'periodtracker',
      androidIsEncryption: true,
    },
  },
};

export default config;
