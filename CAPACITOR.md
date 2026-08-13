# Android com Capacitor — Frete Fácil PRO

O projeto Android já existe em `android/` e o aplicativo usa o build local de `dist/capacitor`. Não há `server.url` no `capacitor.config.ts`; portanto, a versão instalada continua abrindo e trabalhando offline. Atualizações de HTML, CSS e JavaScript podem ser baixadas depois pela própria interface.

## Configuração atual

- App ID: `app.lovable.fretefacil`
- Nome: `Frete Fácil PRO`
- `versionCode`: `7`
- `versionName`: `1.6`
- Versão web/OTA inicial: `1.6.0`
- Conteúdo web do APK: `dist/capacitor`
- Tráfego HTTP misto: desabilitado
- Backup Android: desabilitado
- Permissões: internet, câmera e localização aproximada/precisa

O service worker da PWA é removido/desregistrado quando a aplicação detecta o runtime nativo. No APK, o shell web já está embarcado e as operações offline usam IndexedDB/Dexie.

## Pré-requisitos

- Node.js 20 ou superior e Bun
- Android Studio, Android SDK e JDK 17
- Keystore segura para assinar a versão de produção
- Conta Google Play Console para publicação

## Gerar e validar o projeto

```bash
bun install
bun run check
bun run build
bun run android:sync
```

Não execute `npx cap add android`: a plataforma já foi adicionada ao repositório.

Para abrir o projeto nativo:

```bash
npx cap open android
```

No Android Studio, use **Build > Generate Signed Bundle / APK** e selecione **Android App Bundle (.aab)**. O bundle é gerado em `android/app/build/outputs/bundle/release/`.

Para distribuição direta por APK, salve o novo artefato assinado em `android/app/release/app-release.apk`. Antes da assinatura, esse caminho ainda pode conter a versão anterior; confirme sempre `versionCode`, `versionName` e certificado após gerar o arquivo.

Para um APK de depuração pela linha de comando, a partir da raiz:

```bash
cd android
./gradlew assembleDebug
```

No PowerShell, use `./gradlew.bat assembleDebug`.

## Recursos nativos

`src/lib/native.ts` centraliza os recursos com fallback web:

- `capturarFoto()`: câmera pelo Capacitor ou seleção de arquivo no navegador;
- `obterCoordenadas()`: geolocalização pelo Capacitor ou Web Geolocation API.

As permissões estão declaradas em `android/app/src/main/AndroidManifest.xml`. O Android ainda solicita a autorização do usuário em tempo de execução.

## Ícone e splash

Os recursos nativos ficam em `android/app/src/main/res`. Para regenerá-los, coloque imagens-base em `assets/icon.png` e `assets/splash.png` e execute:

```bash
npx capacitor-assets generate --android --iconBackgroundColor "#1B2A4A" --splashBackgroundColor "#1B2A4A"
npx cap sync android
```

Guarde a keystore fora do repositório e mantenha cópia de segurança: a mesma chave é necessária para todas as atualizações na Play Store.

## Atualizações dentro do aplicativo (OTA)

A versão 1.6 inclui `@capgo/capacitor-updater` em modo manual e auto-hospedado. O usuário acessa **Configurações > Atualização**, verifica a versão, baixa o pacote, acompanha o progresso e confirma **Instalar e reiniciar**.

O build cria saídas separadas:

- `dist/capacitor`: pacote limpo incorporado ao APK;
- `dist/client`: site publicado na Vercel;
- `dist/client/updates/latest.json`: manifesto da versão mais recente;
- `dist/client/updates/fretefacil-X.Y.Z.zip`: pacote OTA com `index.html` na raiz.

O manifesto informa a versão nativa compatível, tamanho, notas e SHA-256. O aplicativo rejeita formato inválido, versão nativa incompatível e ZIP com checksum diferente. `notifyAppReady()` confirma que a nova interface abriu; se isso não ocorrer no prazo configurado, o plugin restaura o pacote funcional anterior.

A confirmação deve ser chamada no fluxo de montagem bem-sucedida da aplicação. A versão OTA 1.6.3 corrige o comportamento anterior em que a confirmação acontecia apenas no tratamento de erro, o que podia restaurar a versão anterior e repetir o aviso de atualização.

Para publicar uma nova atualização somente de interface:

1. altere `version` no `package.json`, por exemplo de `1.6.0` para `1.6.1`;
2. atualize as notas em `ota-release.json` sem mudar `nativeVersion`;
3. execute `bun run check` e `bun run build`;
4. publique o projeto pelo Git/Vercel conectado;
5. confirme no domínio `/updates/latest.json` o novo número e checksum.

Se houver alteração em plugin Capacitor, permissões, Manifest, Gradle ou outro código nativo, gere novo APK com `versionCode`/`versionName` maiores e atualize `nativeVersion` em `ota-release.json`. OTA serve apenas para HTML, CSS e JavaScript.
