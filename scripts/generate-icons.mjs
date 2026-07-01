import { Jimp } from "jimp";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

const ROOT = process.cwd();
const LOGO_PATH = join(ROOT, "src", "assets", "frete-facil-pro-logo.png");
const ICONS_DIR = join(ROOT, "public", "icons");

async function generate() {
  if (!existsSync(LOGO_PATH)) {
    console.error(`[icons] Logo original não encontrado em ${LOGO_PATH}`);
    process.exit(1);
  }

  if (!existsSync(ICONS_DIR)) {
    await mkdir(ICONS_DIR, { recursive: true });
  }

  console.log("[icons] Lendo logotipo original...");
  const logo = await Jimp.read(LOGO_PATH);
  
  // Cores em hexadecimal (RGBA)
  // Tema do app: #1B2A4A (azul escuro) -> 0x1B2A4AFF
  const THEME_COLOR = 0x1B2A4AFF; 

  const sizes = [
    { name: "icon-192.png", size: 192, padding: 0.15 },
    { name: "icon-384.png", size: 384, padding: 0.15 },
    { name: "icon-512.png", size: 512, padding: 0.15 },
    { name: "icon-maskable-512.png", size: 512, padding: 0.25 }, // mais margem para a zona segura circular do Android
  ];

  for (const s of sizes) {
    console.log(`[icons] Gerando ${s.name} (${s.size}x${s.size})...`);
    
    // Cria uma tela quadrada na cor de fundo do tema
    const canvas = new Jimp({
      width: s.size,
      height: s.size,
      color: THEME_COLOR
    });

    // Clona o logotipo para trabalhar nas dimensões deste tamanho
    const currentLogo = logo.clone();

    // Redimensiona o logotipo proporcionalmente para caber na tela com padding
    const innerMaxSize = s.size * (1 - s.padding * 2);
    
    let w = currentLogo.width;
    let h = currentLogo.height;
    
    const aspect = w / h;
    if (w > h) {
      w = innerMaxSize;
      h = innerMaxSize / aspect;
    } else {
      h = innerMaxSize;
      w = innerMaxSize * aspect;
    }

    currentLogo.resize({ w: Math.round(w), h: Math.round(h) });

    // Calcula a posição centralizada
    const x = Math.round((s.size - currentLogo.width) / 2);
    const y = Math.round((s.size - currentLogo.height) / 2);

    // Junta as imagens
    canvas.composite(currentLogo, x, y);

    // Salva o arquivo final
    const dest = join(ICONS_DIR, s.name);
    await canvas.write(dest);
    console.log(`[icons] Salvo com sucesso em: ${dest}`);
  }

  console.log("[icons] Todos os ícones do aplicativo PWA foram gerados com sucesso!");
}

generate().catch((err) => {
  console.error("[icons] Falha ao processar os ícones:", err);
  process.exit(1);
});
