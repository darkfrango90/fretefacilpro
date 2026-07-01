import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.fretefacil",
  appName: "Frete Fácil PRO",
  webDir: "dist",
  server: {
    // Hot-reload apontando para o preview Lovable enquanto desenvolve.
    // Para build de produção (AAB), remova `url` e use os assets embarcados em `dist`.
    url: "https://27acc5ad-5eed-4add-ac34-90c6ed619f01.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
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
