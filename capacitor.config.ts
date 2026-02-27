import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'live.sitea.app',
  appName: 'SiteA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://sitea.live',
    cleartext: false
  }
};

export default config;
