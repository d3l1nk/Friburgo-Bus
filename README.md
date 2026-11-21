# Where is my bus?

Horários da **FAOL** + rastreamento por GPS do **Merus Tracker (Partiu)** para Nova Friburgo - RJ.
Criado por Marcos Raminelly. Iniciativa independente, sem vínculo oficial com a concessionária.

Stack: React 18 + Vite + TypeScript + Tailwind + Capacitor 6 (Android). Sem backend: tudo roda no aparelho.

## Gerar o APK (GitHub Actions)

1. Suba **todos** os arquivos para o repositório, **incluindo as pastas ocultas** `.github/` e o `.gitignore`
   (o upload por arrastar no site do GitHub às vezes ignora pastas que começam com ponto;
   se isso acontecer, crie `.github/workflows/build-apk.yml` manualmente em *Add file → Create new file*).
2. Aba **Actions → Build Android APK** (roda a cada push na `main`; ou *Run workflow*).
3. O pipeline roda `lint`, `prettier`, `tsc`, testes (Vitest e Python) e só então compila o APK.
4. Baixe o artefato **where-is-my-bus-debug-apk** (`app-debug.apk`).

APK de testes **com** as telas de diagnóstico: *Run workflow* e marque "Incluir telas técnicas de diagnóstico".

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm ci` | instala exatamente o que está no `package-lock.json` |
| `npm run dev` | servidor de desenvolvimento (no navegador o CORS da FAOL/Merus bloqueia; use o APK) |
| `npm run lint` | ESLint (zero avisos permitidos) |
| `npm run format` / `format:check` | Prettier (grava / só confere) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes unitários (Vitest + jsdom) |
| `npm run validate` | lint + prettier + tipos + testes + build |
| `python3 -m unittest discover -s scripts -p "test_*.py"` | testes do script nativo |
| `npm run snapshot:faol` | gera `snapshots/faol.json` (veja abaixo) |

## Estrutura

```
src/
  App.tsx, main.tsx, config.ts
  types/            tipos por assunto (common, merus, faol, alerts)
  data/             catálogo de linhas da FAOL e regras especiais (linha 54 no domingo, circulares)
  lib/              http (timeout/retry), storage, geo, time, download... funções reutilizáveis
  hooks/            hooks de app: favoritos, veículos, alertas, GPS, navegação, timers
  services/
    faol/           dom, alerts, links, timetableParser, originalHtml, schedule, snapshot, transport, repository
    merus/          constants, client (headers/retry), normalize (adapter resiliente), repository (cache)
    luiz/           persona (textos), nlu (intenções), handlers (respostas), sources (dados), index (roteador)
    notifications.ts
  features/         radar, lines, favorites, chat, alerts, settings, diagnostic (cada uma com seus hooks/componentes)
  components/ui/    componentes reutilizáveis (ui, AppIcon, LuizAvatar, OriginalTableSheet)
scripts/            patch_android.py (+ testes), faol-snapshot.ts
resources/ store/   ícones (não alterar)
```

## Configurações (`src/config.ts`)

- `FAOL_CHANNEL_URL`: canal oficial de avisos da FAOL (hoje aponta para o site).
- `FEEDBACK_EMAIL`: e-mail que recebe feedback (vazio = abre o menu de compartilhar).
- `FAOL_SNAPSHOT_URL`: JSON pré-processado opcional (veja abaixo). Vazio = comportamento original.

## Snapshot opcional da FAOL (JSON pré-processado)

O app lê as páginas da FAOL direto no celular. Para tornar isso mais rápido e resistente a mudanças de layout/queda do site:

1. Actions → **FAOL snapshot** → *Run workflow*. Ele gera e commita `snapshots/faol.json`
   (para rodar todo dia, descomente o `schedule` no workflow).
2. Em `src/config.ts`, preencha
   `FAOL_SNAPSHOT_URL = 'https://raw.githubusercontent.com/d3l1nk/Friburgo-Bus/main/snapshots/faol.json'`.

Com isso o app tenta: cache local → snapshot recente → site da FAOL → cópias antigas. O botão de atualizar
uma tabela sempre vai direto ao site. O JSON só é aceito se passar na validação de estrutura; se vier inválido,
mantém a última cópia boa. O workflow se recusa a gravar um snapshot com poucas tabelas (sinal de layout alterado).

## Avisos de manutenção

- Os parsers da FAOL foram escritos para o layout descrito (cabeçalho de 2 linhas, texto corrido, modais).
  Se a FAOL mudar o site, a tela da linha mostra "Não consegui ler esta tabela" e o botão **Tabela original**
  continua funcionando. Use o APK com diagnóstico para inspecionar o HTML.
- Para publicar na Google Play é preciso um pacote **assinado** (AAB de release); este pipeline gera só o APK de debug.
