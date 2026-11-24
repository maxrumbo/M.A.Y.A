import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maxwell.maya',
  appName: 'M.A.Y.A.',
  webDir: 'dist',
  server: {
    // Gunakan http scheme agar WebView (origin http://localhost) dapat memanggil
    // Maya.Server lokal via HTTP LAN / Tailscale tanpa diblokir mixed-content.
    androidScheme: 'http',
    cleartext: true
  }
};

export default config;
