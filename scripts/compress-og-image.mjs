import { Jimp } from "jimp";
import { join } from "node:path";
import { stat } from "node:fs/promises";

const ROOT = process.cwd();
const OG_IMAGE_PATH = join(ROOT, "public", "og-image.jpg");

async function main() {
  try {
    console.log("[compress-og] Lendo imagem...");
    const image = await Jimp.read(OG_IMAGE_PATH);
    
    // Redimensiona levemente para 960px de largura mantendo a proporção (1.91:1)
    // para ajudar a baixar o tamanho do arquivo
    console.log("[compress-og] Redimensionando para 960x502...");
    image.resize({ w: 960, h: 502 });
    
    console.log("[compress-og] Salvando com qualidade reduzida (75%)...");
    // Salva a imagem comprimida com qualidade 75
    await image.write(OG_IMAGE_PATH, { quality: 75 });
    
    const stats = await stat(OG_IMAGE_PATH);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`[compress-og] Concluído! Tamanho final: ${sizeKB}KB`);
    
    if (sizeKB > 300) {
      console.warn("[compress-og] AVISO: A imagem ainda está maior que 300KB. Tentando comprimir mais...");
      const image2 = await Jimp.read(OG_IMAGE_PATH);
      await image2.write(OG_IMAGE_PATH, { quality: 60 });
      const stats2 = await stat(OG_IMAGE_PATH);
      console.log(`[compress-og] Concluído na segunda tentativa! Tamanho final: ${Math.round(stats2.size / 1024)}KB`);
    }
  } catch (error) {
    console.error("[compress-og] Erro ao comprimir imagem:", error);
    process.exit(1);
  }
}

main();
