import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maxwell.maya',
  appName: 'M.A.Y.A.',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
