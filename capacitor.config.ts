import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.fretefacil",
  appName: "Frete Fácil PRO",
  webDir: "dist/client",
  // Removendo o bloco server para o APK usar os arquivos locais (Offline Ready)
  android: {
    allowMixedContent: true,
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
  },
};

export default config;
