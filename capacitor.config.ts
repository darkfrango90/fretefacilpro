import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.fretefacil",
  appName: "Frete Fácil PRO",
  // A cópia Android não contém os ZIPs publicados pelo site para OTA.
  webDir: "dist/capacitor",
  // Removendo o bloco server para o APK usar os arquivos locais (Offline Ready)
  android: {
    allowMixedContent: false,
    backgroundColor: "#1B2A4A",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: "#1B2A4A",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    CapacitorUpdater: {
      // O aplicativo controla download/instalação pela própria interface.
      autoUpdate: "off",
      appReadyTimeout: 10_000,
      autoDeleteFailed: true,
      autoDeletePrevious: false,
      keepUrlPathAfterReload: true,
      resetWhenUpdate: false,
    },
  },
};

export default config;
