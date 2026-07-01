import { Jimp } from "jimp";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const LOGO_PATH = join(ROOT, "src", "assets", "frete-facil-pro-logo.png");
const ASSETS_DIR = join(ROOT, "assets");

async function run() {
  if (!existsSync(LOGO_PATH)) {
    console.error(`[cap-assets] Logo original não encontrado em ${LOGO_PATH}`);
    process.exit(1);
  }

  if (!existsSync(ASSETS_DIR)) {
    await mkdir(ASSETS_DIR, { recursive: true });
  }

  const THEME_COLOR = 0x1B2A4AFF; // #1B2A4A em RGBA

  console.log("[cap-assets] Lendo logotipo original...");
  const logo = await Jimp.read(LOGO_PATH);

  // 1. Gerar o icon.png (1024x1024) para o launcher
  console.log("[cap-assets] Gerando assets/icon.png...");
  const iconCanvas = new Jimp({
    width: 1024,
    height: 1024,
    color: THEME_COLOR
  });

  const iconLogo = logo.clone();
  // Redimensiona o logotipo para caber centralizado com 25% de margem de segurança
  const maxIconLogoSize = 1024 * 0.55; 
  let w = iconLogo.width;
  let h = iconLogo.height;
  const aspect = w / h;
  if (w > h) {
    w = maxIconLogoSize;
    h = maxIconLogoSize / aspect;
  } else {
    h = maxIconLogoSize;
    w = maxIconLogoSize * aspect;
  }
  iconLogo.resize({ w: Math.round(w), h: Math.round(h) });
  const iconX = Math.round((1024 - iconLogo.width) / 2);
  const iconY = Math.round((1024 - iconLogo.height) / 2);
  iconCanvas.composite(iconLogo, iconX, iconY);
  await iconCanvas.write(join(ASSETS_DIR, "icon.png"));

  // 2. Gerar o splash.png (2732x2732) para a tela de abertura
  console.log("[cap-assets] Gerando assets/splash.png...");
  const splashCanvas = new Jimp({
    width: 2732,
    height: 2732,
    color: THEME_COLOR
  });

  const splashLogo = logo.clone();
  // Redimensiona o logotipo para a tela de splash (menor no centro)
  const maxSplashLogoSize = 2732 * 0.35; 
  let sw = splashLogo.width;
  let sh = splashLogo.height;
  const sAspect = sw / sh;
  if (sw > sh) {
    sw = maxSplashLogoSize;
    sh = maxSplashLogoSize / sAspect;
  } else {
    sh = maxSplashLogoSize;
    sw = maxSplashLogoSize * sAspect;
  }
  splashLogo.resize({ w: Math.round(sw), h: Math.round(sh) });
  const splashX = Math.round((2732 - splashLogo.width) / 2);
  const splashY = Math.round((2732 - splashLogo.height) / 2);
  splashCanvas.composite(splashLogo, splashX, splashY);
  await splashCanvas.write(join(ASSETS_DIR, "splash.png"));

  console.log("[cap-assets] Arquivos base gerados na pasta /assets.");

  // 3. Rodar o capacitor-assets para gerar todos os mipmaps nativos do Android
  console.log("[cap-assets] Executando gerador nativo do Android...");
  try {
    execSync("npx @capacitor/assets generate --android", { stdio: "inherit" });
    console.log("[cap-assets] Todos os ícones e telas de splash nativos do Android foram gerados com sucesso!");
  } catch (err) {
    console.error("[cap-assets] Erro ao rodar gerador nativo:", err);
  }
}

run().catch(console.error);
