import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.netizen.workboard',
  appName: 'Work Board',
  webDir: 'out',
  server: {
    url: 'https://workboard-app-indol.vercel.app/',
    cleartext: true
  }
};

export default config;
