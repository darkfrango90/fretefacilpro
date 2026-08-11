import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";

const ROOT = process.cwd();
const CLIENT_DIR = join(ROOT, "dist", "client");
const CAPACITOR_DIR = join(ROOT, "dist", "capacitor");
const UPDATE_DIR = join(CLIENT_DIR, "updates");
const PACKAGE = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const RELEASE = JSON.parse(await readFile(join(ROOT, "ota-release.json"), "utf8"));

if (!/^\d+\.\d+\.\d+$/.test(PACKAGE.version)) {
  throw new Error("[ota] package.json version deve usar o formato X.Y.Z");
}
if (!/^\d+\.\d+$/.test(RELEASE.nativeVersion)) {
  throw new Error("[ota] nativeVersion deve usar o formato X.Y");
}

// O APK recebe uma cópia limpa. Os pacotes OTA são adicionados somente à
// saída pública do Vercel depois desta cópia, evitando duplicar o ZIP no APK.
await rm(CAPACITOR_DIR, { recursive: true, force: true });
await cp(CLIENT_DIR, CAPACITOR_DIR, { recursive: true });

const arquivos = {};
async function adicionarDiretorio(diretorio) {
  for (const nome of await readdir(diretorio)) {
    const caminho = join(diretorio, nome);
    const info = await stat(caminho);
    if (info.isDirectory()) {
      await adicionarDiretorio(caminho);
      continue;
    }
    const nomeZip = relative(CAPACITOR_DIR, caminho).split(sep).join("/");
    arquivos[nomeZip] = new Uint8Array(await readFile(caminho));
  }
}
await adicionarDiretorio(CAPACITOR_DIR);

if (!arquivos["index.html"]) throw new Error("[ota] index.html ausente no pacote");

const zip = zipSync(arquivos, { level: 7 });
const nomeArquivo = `fretefacil-${PACKAGE.version}.zip`;
const checksum = createHash("sha256").update(zip).digest("hex");
await mkdir(UPDATE_DIR, { recursive: true });
await writeFile(join(UPDATE_DIR, nomeArquivo), zip);

const manifesto = {
  schema: 1,
  version: PACKAGE.version,
  nativeVersion: RELEASE.nativeVersion,
  required: RELEASE.required === true,
  notes: Array.isArray(RELEASE.notes) ? RELEASE.notes.map(String) : [],
  file: nomeArquivo,
  checksum,
  size: zip.byteLength,
  publishedAt: new Date().toISOString(),
};
await writeFile(join(UPDATE_DIR, "latest.json"), `${JSON.stringify(manifesto, null, 2)}\n`);

console.log(`[ota] ${nomeArquivo} (${zip.byteLength} bytes, sha256 ${checksum}) + dist/capacitor`);
