# Gerar APK/AAB com Capacitor — Frete Fácil PRO

O projeto já está preparado para empacotamento nativo via Capacitor. A compilação do APK/AAB precisa rodar **fora do Lovable**, numa máquina com Android Studio instalado.

## Pré-requisitos (na sua máquina)
- Node.js 20+ e Bun
- Android Studio (com Android SDK + JDK 17)
- Conta Google Play Console ($25 — pagamento único)

## Passo a passo

```bash
# 1) Clone o projeto via "Export to GitHub" no Lovable e instale
git clone <seu-repo> && cd <seu-repo>
bun install

# 2) Build web (gera /dist)
bun run build

# 3) Adicione a plataforma Android (primeira vez apenas)
npx cap add android

# 4) Sincronize os assets web com o projeto nativo
npx cap sync android

# 5) Abre no Android Studio
npx cap open android
```

No Android Studio:
- **Build > Generate Signed Bundle / APK** → escolha **Android App Bundle (.aab)**
- Crie/use sua keystore (guarde com cuidado, é exigida em toda atualização)
- O AAB final fica em `android/app/build/outputs/bundle/release/`

## Modo dev x produção

Em `capacitor.config.ts`:
- **Desenvolvimento** (atual): `server.url` aponta para o preview Lovable → permite hot reload no celular
- **Produção (publicar na Play Store)**: **remova** o bloco `server` antes de rodar `bun run build && npx cap sync`. Assim o app usa os arquivos de `/dist` embarcados, funciona offline e não depende do Lovable.

## Recursos nativos já integrados

O arquivo `src/lib/native.ts` expõe helpers que usam plugins nativos quando rodando no APK, com **fallback automático para a web**:
- `capturarFoto()` — câmera nativa (Capacitor Camera) ou `<input type=file>`
- `obterCoordenadas()` — GPS nativo (Capacitor Geolocation) ou Web API

## Permissões Android
Após `cap add android`, edite `android/app/src/main/AndroidManifest.xml` e garanta:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Ícone e splash
Use `@capacitor/assets` para gerar ícones a partir de um PNG 1024x1024 com a logo do **Frete Fácil PRO**:
```bash
bun add -d @capacitor/assets
mkdir -p assets
# Baixe a logo oficial do CDN para usar como ícone base
curl -L "https://fretefacilpro.com.br/__l5e/assets-v1/c5a45567-3d57-406c-ba99-0a35b6dea519/frete-facil-pro-logo.png" -o assets/icon.png
cp assets/icon.png assets/splash.png
npx capacitor-assets generate --android --iconBackgroundColor "#1B2A4A" --splashBackgroundColor "#1B2A4A"
```
