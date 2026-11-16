# Where is my bus? (v1.2)

Horários da FAOL + rastreamento Merus Tracker (Partiu) para Nova Friburgo - RJ.
Criado por Marcos Raminelly. Iniciativa independente, sem vínculo oficial.

## Gerar o APK
1. Suba todos os arquivos para o repositório (branch `main`).
2. Aba **Actions** > **Build Android APK** (roda a cada push, ou *Run workflow*).
3. Baixe o artefato **where-is-my-bus-debug-apk** (`app-debug.apk`).

## Versão final x versão de testes
As telas técnicas de diagnóstico ficam **ocultas** por padrão. Para um APK de testes com elas,
use *Run workflow* e marque "Incluir telas técnicas de diagnóstico".

## Configurações editáveis (`src/config.ts`)
- `FAOL_CHANNEL_URL`: link do canal oficial de avisos da FAOL (hoje aponta para o site da FAOL).
- `FEEDBACK_EMAIL`: e-mail que recebe feedback (vazio = abre o menu de compartilhar do Android).

## Ícone
`resources/icon.svg` (fonte), `resources/android/res/` (aplicado no build) e `store/icon-512.png` (Google Play).
