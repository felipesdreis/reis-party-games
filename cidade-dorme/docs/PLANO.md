# Plano de implementação — Cidade Dorme (party game)

> Plano fechado com o usuário em 2026-09-18. Modelo: `ito/docs/PLANO.md` (revelação de papel) + `batata-quente/docs/PLANO.md` (host controla o app, jogo é físico/verbal).

## Contexto

Quarto jogo da coleção `party-games`, no molde de `mimica/`, `ito/` e `batata-quente/`. Versão web do clássico **Mafia / Lobisomem**: 2 mafiosos, 1 médico, 1 investigador, resto cidadãos comuns. A cidade "dorme" (jogadores de olhos fechados) e acorda em rodadas de noite/dia até um lado vencer.

O app tem **duas fases de uso do celular** bem separadas:

1. **Revelação de papel** (início da partida) — cada jogador precisa ver seu próprio papel em segredo. Resolvido exatamente como o `ito/` já resolve "informação secreta em 1 celular só": modo **1 celular só** (pass-the-phone) ou **Cada um no seu** (QR code, sem servidor, dados no `#hash` da URL).
2. **Noite e dia** — a partir daí ninguém mais passa o celular. Um jogador é o **host/narrador**: ele segura o celular, lê o roteiro de narração em voz alta, observa os jogadores apontando fisicamente (de olhos fechados) e toca na tela pra registrar quem foi apontado. O app nunca mais interage diretamente com os outros jogadores depois da revelação.

## Regras fechadas com o usuário

| Regra | Decisão |
|---|---|
| Jogadores | Mínimo 6 (2 mafiosos + 1 médico + 1 investigador + pelo menos 2 cidadãos comuns), sem máximo |
| Papéis | Fixos: sempre 2 mafiosos, 1 médico, 1 investigador; o resto vira cidadão comum, não importa quantos jogadores |
| Revelação de papel | Toggle no setup, igual ito: **1 celular só** (pass-the-phone) ou **Cada um no seu** (QR code) |
| Mafiosos se conhecem | Sim — na tela de revelação, o mafioso também vê quem é o parceiro |
| Controle da noite/dia | Um jogador é o host; só ele mexe no celular a partir daí. Os outros agem fisicamente (apontando de olhos fechados), fora do app |
| Ordem da noite | Máfia escolhe vítima → Médico escolhe quem proteger → Investigador escolhe quem investigar |
| Auto-proteção do médico | Permitida, sem restrição, toda noite |
| Resultado da investigação | Binário "pessoa importante" = mafioso OU médico (não diferencia qual). App mostra isso só pro host; o host sinaliza com um **joinha físico** pro investigador, fora do app — o investigador nunca sabe se é mafioso ou médico, só que é "importante" |
| Votação do dia | 100% verbal/física; o host só toca no nome de quem foi expulso, ou em "Ninguém foi expulso" se o grupo empatar/decidir não expulsar — igual ao padrão de eliminação do `batata-quente` |
| Revelar papel ao morrer | Sempre — tanto na morte da noite quanto na expulsão do dia, o app mostra o papel de quem saiu |
| Condição de vitória | Máfia vence quando `mafiosos vivos > não-mafiosos vivos` (precisa **superar**, empate não basta). Cidade vence quando `mafiosos vivos == 0` |
| Narração | Cada tela de fase mostra um roteiro pronto pro host ler em voz alta, além dos controles |
| Timer | Não há — nem na revelação nem na discussão do dia, igual ito/mimica sem pressa artificial |
| Stack | HTML + CSS + JS puro, PT-BR, sem backend. Única dependência: `qrcode-generator`, vendorizada em `cidade-dorme/vendor/`, copiada sem alterações do `ito/vendor/qrcode.js` |

## Arquitetura

Mesmo padrão dos outros jogos: um objeto `state` mutável, `render()` mostra a `<section>` de `state.screen`. Regras em `game.js` sem DOM, testadas com `node test.js`. A revelação de papel reaproveita a arquitetura do `ito/` (papéis derivados de uma `seed`, para o modo QR não precisar transmitir os papéis — só semente + nomes). A partir da noite, o app vira uma **tela única de controle do host**; não há mais handoff entre jogadores.

Dentro da fase da noite, uma única `<section id="night">` troca de sub-vista conforme `state.phase` (`'mafia' | 'medico' | 'investigador'`), do mesmo jeito que o `batata-quente` já troca a sub-vista de `exploded` conforme `state.eliminated` — evita 3 `<section>` quase idênticas.

### Arquivos

```
cidade-dorme/
  index.html        # <section hidden>: setup, reveal, share, guest, night, nightResult, day, dayResult, gameOver
  style.css         # baseado em ito/style.css (tokens oklch/Inter, chips, avatar, QR) + cards de papel, roteiro
  game.js           # regras puras, zero DOM
  app.js            # DOM, render(), handlers, geração do QR, leitura do hash
  vendor/qrcode.js  # qrcode-generator 1.4.4 (MIT), copiado do ito sem alterações
  test.js           # asserts com node puro
  docs/PLANO.md
```

### Estado (`state`)

```js
let state = {
  mode: 'local',              // 'local' | 'qr'
  players: [],                 // nomes na ordem de cadastro; índice = id do jogador
  seed: '',                    // sorteio dos papéis; entra no QR
  roles: [],                   // roles[i] = 'mafioso' | 'medico' | 'investigador' | 'cidadao'
  alive: [],                   // alive[i] = boolean

  // revelação de papel (igual ito)
  revealIdx: 0,                // quem está com o celular na tela reveal (modo local)
  revealed: false,
  guest: null,                 // modo QR: { who: índice | null, shown: false }

  // noite/dia (só o host mexe)
  night: 0,                    // contador, incrementado a cada startNight
  phase: null,                 // durante 'night': 'mafia' | 'medico' | 'investigador'
  mafiaTarget: null,
  medicoTarget: null,
  investigadorTarget: null,
  investigadorResult: null,    // true = alvo é mafioso OU médico; só o host vê
  lastDeath: null,             // índice morto essa noite, ou null se o médico salvou
  lastEliminated: null,        // índice expulso de dia, ou null ("ninguém foi expulso")

  screen: 'setup',
  // 'setup'|'reveal'|'share'|'guest'|'night'|'nightResult'|'day'|'dayResult'|'gameOver'
};
```

### API de `game.js` (puro, sem DOM)

Todas recebem `state`, mutam e retornam o mesmo objeto. Sem classes.

| Função | O que faz |
|---|---|
| `newGame()` | Estado inicial, `screen = 'setup'`, `mode = 'local'` |
| `setMode(state, mode)` | `'local'` ou `'qr'` |
| `addPlayer(state, name)` | `trim`; ignora vazio ou duplicado; sem limite máximo |
| `removePlayer(state, i)` | `splice` |
| `rng(seed)` | mulberry32: string → função `() => [0,1)` determinística (copiado do ito) |
| `newSeed()` | 4 chars base36 aleatórios |
| `assignRoles(n, seed)` | Monta o pool `['mafioso','mafioso','medico','investigador', ...'cidadao' × (n-4)]` e embaralha (Fisher-Yates) com `rng(seed)`. Exige `n >= 6`. Determinístico: mesma `seed` + mesmo `n` → mesmos papéis, em qualquer celular |
| `partnerOf(roles, i)` | Índice do outro jogador com `role === 'mafioso'` (usado na tela de reveal para o mafioso ver o parceiro) |
| `startGame(state)` | Exige `players.length >= 6`; `seed = newSeed()`, `roles = assignRoles(n, seed)`, `alive = Array(n).fill(true)`, `night = 0`, `revealIdx = 0`, `revealed = false`, `screen = mode === 'qr' ? 'share' : 'reveal'` |
| `show(state)` / `hide(state)` | Modo local, igual ito: `revealed = true`; `hide` zera e faz `revealIdx++`; depois do último jogador, chama `startNight(state)` em vez de ir pra uma tela de "discuss" |
| `encodeRound(state)` | Hash com `seed` + `...players`, cada um `encodeURIComponent`, unidos por `\|` (sem tema, mais simples que o do ito) |
| `decodeRound(hash)` | Inverso; `null` se tiver menos de 7 campos (semente + ≥6 nomes) |
| `loadGuest(state, hash)` | `decodeRound`; preenche `seed`, `players`, `roles = assignRoles(n, seed)`, `alive`, `guest = { who: null, shown: false }`, `screen = 'guest'` |
| `pickGuest(state, i)` | `guest.who = i`, `guest.shown = false` |
| `toNight(state)` | Handler do botão "Todos viram, continuar" no modo QR (equivalente ao `toDiscuss` do ito) → `startNight(state)` |
| `startNight(state)` | `night++`, `phase = 'mafia'`, zera `mafiaTarget`/`medicoTarget`/`investigadorTarget`/`investigadorResult`/`lastDeath`, `screen = 'night'` |
| `chooseMafiaTarget(state, i)` | Só age se `phase === 'mafia'`; `mafiaTarget = i`, `phase = 'medico'` |
| `chooseMedicoTarget(state, i)` | Só age se `phase === 'medico'`; `medicoTarget = i`, `phase = 'investigador'` |
| `chooseInvestigadorTarget(state, i)` | Só age se `phase === 'investigador'` e `investigadorTarget === null`; `investigadorTarget = i`, `investigadorResult = roles[i] === 'mafioso' \|\| roles[i] === 'medico'`. **Não muda de tela** — continua em `night`/`investigador`, só troca a grade pelo card de resultado (mesmo truque do `exploded` no batata-quente, via `investigadorTarget !== null`) |
| `finishNight(state)` | Handler do botão "Investigador dormiu, continuar" (só aparece depois de `chooseInvestigadorTarget`); resolve a noite (abaixo) e `screen = 'nightResult'` |
| `resolveNight(state)` | Interno a `finishNight`: se `medicoTarget === mafiaTarget` → `lastDeath = null` (salvo); senão `alive[mafiaTarget] = false`, `lastDeath = mafiaTarget` |
| `toDay(state)` | Handler do botão "Continuar" em `nightResult`: se `isOver(state)` → `screen = 'gameOver'`; senão `screen = 'day'` |
| `eliminateDay(state, i)` | `i` é índice ou `null` ("Ninguém foi expulso"); se índice, `alive[i] = false`; `lastEliminated = i`; `screen = 'dayResult'` |
| `toNextNight(state)` | Handler do botão em `dayResult`: se `isOver(state)` → `screen = 'gameOver'`; senão `startNight(state)` |
| `aliveIndices(state)` | Array de índices com `alive[i] === true` |
| `mafiaTargetChoices(state)` | `aliveIndices` excluindo os próprios mafiosos (não se matam entre si) |
| `isOver(state)` | `mafiaAlive > othersAlive \|\| mafiaAlive === 0`, contando só `alive` |
| `winner(state)` | `mafiaAlive === 0 ? 'cidade' : 'mafia'` |

Última linha: `if (typeof module !== 'undefined') module.exports = { ... }`.

### Telas e fluxo

```
setup ──(startGame)──> reveal (local) | share (qr)
reveal ──(show/hide × n, último hide)──> night
share ──(toNight)──> night           guest (convidado, separado) ──(pickGuest)──> vê o próprio papel
night[mafia] ──(chooseMafiaTarget)──> night[medico] ──(chooseMedicoTarget)──> night[investigador]
night[investigador] ──(chooseInvestigadorTarget)──> night[investigador, resultado] ──(finishNight)──> nightResult
nightResult ──(toDay)──> day | gameOver
day ──(eliminateDay)──> dayResult
dayResult ──(toNextNight)──> night[mafia] (next) | gameOver
gameOver ──(Jogar de novo)──> setup (players preservados)
```

- **setup** — toggle "1 celular só / Cada um no seu", chips de nomes (adicionar/remover, sem ✕ especial), contador "Mínimo 6 jogadores (n/6)" em laranja abaixo de 6, botão "Sortear papéis e começar" desabilitado abaixo do mínimo.
- **reveal** (modo local) — barra de progresso segmentada, "Passe o celular para {nome}" → toque → card do papel:
  - Mafioso: fundo vermelho, 🔪, "Você é Mafioso. Seu parceiro é: **{nome}**."
  - Médico: fundo verde, 💉, "Você é o Médico. Toda noite pode proteger alguém, inclusive você mesmo."
  - Investigador: fundo roxo, 🔍, "Você é o Investigador. Toda noite pode investigar alguém."
  - Cidadão comum: fundo cinza, 🙂, "Você é um Cidadão Comum. Ajude a descobrir quem é da Máfia."
  - Botão "Memorizei, esconder e passar". Depois do último jogador, vai direto pra `night` (sem tela intermediária de "todos viram").
- **share** (modo QR) — igual ito: QR grande, "Compartilhar link", botão "Todos viram, continuar" → `night`.
- **guest** (modo QR, convidado) — escolhe o próprio nome, confirma, vê o mesmo card de papel do modo local (incluindo parceiro se for mafioso). Sem botão de avançar fase — quem avança é o host, na aba dele.
- **night** — cabeçalho fixo "Noite {n}"; conteúdo muda por `state.phase`:
  - `mafia`: roteiro *"A cidade inteira dorme... Todos fechem os olhos. Máfia, acordem em silêncio e apontem para a vítima desta noite."* + grade de `mafiaTargetChoices(state)` (nomes vivos, exceto os mafiosos).
  - `medico`: roteiro *"Máfia, voltem a dormir. Médico, acorde e aponte para quem você quer proteger esta noite."* + grade de `aliveIndices(state)` (todos vivos, incluindo o próprio médico).
  - `investigador`: roteiro *"Médico, volte a dormir. Investigador, acorde e aponte para alguém que você quer investigar."* + grade de `aliveIndices(state)`. Ao tocar num nome (`chooseInvestigadorTarget`), a grade vira um card de resultado, visível só pro host: **"🟢 Pessoa importante — dê um joinha discreto pro investigador"** ou **"⚪ Pessoa comum — não sinalize nada"**, com botão "Investigador dormiu, continuar" (`finishNight`) → `nightResult`.
- **nightResult** — roteiro *"O sol nasce e a cidade acorda..."* + `lastDeath !== null` → "**{nome}** foi encontrado morto. Era **{papel}**." ; `lastDeath === null` → "Ninguém morreu esta noite — parece que alguém foi salvo." Botão "Continuar" → `toDay`.
- **day** — roteiro *"É hora de discutir. Quem vocês acham que é da Máfia?"* + grade de `aliveIndices(state)` pra host tocar em quem foi expulso + botão secundário "Ninguém foi expulso".
- **dayResult** — `lastEliminated !== null` → "**{nome}** foi expulso pela cidade. Era **{papel}**." ; `lastEliminated === null` → "A cidade não chegou a um consenso — ninguém foi expulso." Botão "Próxima noite" → `toNextNight`.
- **gameOver** — "🔪 A Máfia venceu!" (fundo vermelho) ou "🏘️ A Cidade venceu!" (fundo verde) + lista final com todos os jogadores e seus papéis revelados + "Jogar de novo" → `setup` com `players` preservados (chips editáveis, como no setup do ito).

`render()` esconde todas as `<section>` e mostra a de `state.screen`; dentro de `night`, um `if (state.phase === ...)` monta o roteiro e a grade certos.

### CSS

Parte de `ito/style.css` (tokens oklch/Inter, `.chip`, `.avatar`). Adições: `.roleCard` (cor de fundo por papel via `data-role`), `.script` (bloco de roteiro, itálico, fundo sutil, pra destacar do resto do texto), `.grid` (grade de nomes tocáveis, reaproveitando o botão grande padrão), `.hint` (o aviso de joinha na tela do investigador, com fundo verde/cinza conforme o resultado).

## Passos de implementação (ordem)

1. Copiar `vendor/qrcode.js` do `ito/` sem alterações.
2. **`test.js` primeiro** (TDD leve): `addPlayer`/`removePlayer` (trim, ignora vazio/duplicado, sem máximo), `assignRoles` (2 mafioso + 1 medico + 1 investigador + resto cidadao, para n=6 e n=12; determinístico por seed; embaralhado — não sempre nas mesmas posições), `partnerOf`, `startGame` (bloqueia com 5, passa com 6), `encodeRound`/`decodeRound` ida e volta com nome acentuado, `loadGuest` produz os mesmos `roles` do host pra mesma seed, fluxo `show`/`hide` (n vezes → `night` direto, sem tela intermediária), `startNight` (incrementa `night`, reseta os targets), `chooseMafiaTarget` → `chooseMedicoTarget` → `chooseInvestigadorTarget` avançando `phase` corretamente e ignorando fora de ordem, `chooseInvestigadorTarget` não muda `screen` (continua `night`) e calcula `investigadorResult` (true pra mafioso e pra médico, false pra investigador e cidadão), `finishNight` só age depois de `chooseInvestigadorTarget` e resolve a noite (`resolveNight`: mesmo alvo do médico e da máfia → `lastDeath = null`; alvos diferentes → vítima morre) indo pra `nightResult`, `mafiaTargetChoices` exclui os mafiosos vivos, `eliminateDay` com índice e com `null`, `isOver`/`winner` (falso com máfia empatada, verdadeiro com máfia maioria, verdadeiro com máfia zerada mesmo se só sobrou 1 cidadão), `toDay`/`toNextNight` decidindo entre `gameOver` e a próxima fase.
3. `game.js` até `node test.js` imprimir `OK`.
4. `index.html` com as 9 `<section>` e ids.
5. `app.js`: estado, `render()` (incluindo sub-vista de `night` por `phase`), handlers, QR, leitura do hash no load.
6. `style.css`.
7. Verificação manual no navegador (abaixo).
8. Card de `cidade-dorme` no hub raiz `/index.html`.

## Verificação

- `cd cidade-dorme && node test.js` → `OK`.
- Abrir `cidade-dorme/index.html` via `file://` (modo local):
  1. Setup: menos de 6 jogadores não deixa começar; com 6, sorteia e mostra reveal.
  2. Passar o celular pelos 6: 2 telas de mafioso mostram um o nome do outro como parceiro; médico e investigador têm texto próprio; cidadãos comuns também. Depois do último, cai direto em `night`, fase máfia.
  3. Noite: tocar num nome na fase máfia avança pra médico; escolher alguém avança pra investigador; tocar num nome na fase investigador mostra o card de resultado (joinha ou não) sem trocar de tela; "Investigador dormiu, continuar" só então avança pra `nightResult`.
  4. Se o alvo da máfia === alvo do médico → "Ninguém morreu esta noite"; se diferente → "{nome} foi encontrado morto. Era {papel}.".
  5. Dia: tocar num nome vivo expulsa e revela o papel; "Ninguém foi expulso" não mexe em `alive`.
  6. Repetir noites até `mafiaAlive === 0` (cidade vence) ou `mafiaAlive > othersAlive` (máfia vence, empate não é suficiente) → `gameOver` com todos os papéis revelados.
  7. "Jogar de novo" volta ao setup com os mesmos 6 nomes já nos chips, prontos pra sortear de novo.
  8. DevTools mobile (390px): grade de nomes tocável com o polegar, roteiro legível.
- Modo QR (precisa de URL acessível, `npx serve` ou GitHub Pages): setup "Cada um no seu" → tela share com QR → escanear em outro celular → escolher o próprio nome → ver o papel (mafioso vê o parceiro certo) → "Todos viram, continuar" no host segue pra `night` normalmente (o convidado só via o papel, não participa da noite/dia).

## Fora de escopo (YAGNI — adicionar só se pedido)

- Papéis extras além dos 4 pedidos (vidente, bobo da corte, etc.).
- Voto digital de dia — é 100% verbal, host só registra quem saiu.
- Timer de discussão ou de qualquer fase.
- Log/histórico de mortes de rodadas anteriores na tela (só o roteiro da rodada atual).
- Placar entre partidas, persistência em `localStorage`.
- Sincronização real entre celulares além do QR (mesma limitação documentada no ito).
- Impedir o host de saber os papéis com antecedência (o host, se for um dos 6+ jogadores originais, já viu o próprio papel normalmente na revelação — o jogo assume um host de confiança, como qualquer mesa física).
