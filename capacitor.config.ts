import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.enscribe.game',
  appName: 'Enscribe',
  webDir: 'dist',
  backgroundColor: '#0D1D68',
  android: {
    backgroundColor: '#0D1D68',
    allowMixedContent: false,
  },
};

export default config;
