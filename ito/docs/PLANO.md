# Plano de implementação — Ito (party game)

> Plano fechado com o usuário em 2026-09-16. Modelo: `mimica/docs/PLANO.md`.

## Contexto

`party-games/ito/` contém só o protótipo de design (`Jogo Ito online - prototipo design.zip`, feito no mesmo design system do `mimica/`). Objetivo: versão web do jogo de cartas **Ito**, sem backend, sem build, no mesmo padrão de `mimica/`, com dois modos de revelar os números:

- **1 celular só** — pass-the-phone: o celular passa de mão em mão e cada um vê seu número.
- **Cada um no seu** — o host cadastra os nomes, sorteia e mostra um **QR code**; cada pessoa escaneia com a câmera do próprio celular, escolhe seu nome e vê só o seu número. O QR carrega os dados no `#hash` da URL, então **não há rede entre os celulares nem servidor**.

Regra do jogo: cada jogador recebe em segredo um número de 1 a 100. O grupo escolhe um tema com dois extremos (ex.: "Sabor de pizza": 1 = só queijo, 100 = a mistura mais bizarra). Cada um diz em voz alta uma dica dentro do tema que represente seu número, sem falar o número. Depois o grupo tenta colocar todos em ordem do menor para o maior e revela.

O protótipo (`Ito Online.dc.html` dentro do zip) já desenha as telas e o texto de UI; este plano o segue, com três ajustes: sorteio **sem repetição** (o protótipo permitia números iguais), tela "Organizar" por toque em sequência em vez de setas ▲▼, e o modo remoto por QR code em vez de "sala" com servidor.

## Regras fechadas com o usuário

| Regra | Decisão |
|---|---|
| Modos | Toggle no setup: **1 celular só** (pass-the-phone) ou **Cada um no seu** (QR code). Tema, dica, ordenação e resultado ficam sempre no celular do host |
| Jogadores | 3 a 12, nomes digitados no setup (chips com ✕ para remover) |
| Números | 1..100, **únicos** por rodada, sorteados sem reposição a partir de uma **semente** (mesma semente → mesmos números em qualquer celular) |
| Tema | Lista de sugestões por categoria (`themes.js`) + botão 🎲 aleatório + **input de tema próprio** (extremos genéricos "menor" / "maior") |
| Revelação local | Um jogador por vez: "Passe o celular para X" → toque para ver → "Memorizei, esconder e passar" |
| Revelação por QR | Host mostra QR (link do site com semente, tema e nomes no `#hash`) + botão "Compartilhar link" de reserva. Convidado abre o link, toca no próprio nome, confirma ("Você é Ana?") e vê o número; pode esconder/mostrar. Cada "Novo tema" gera QR novo; todos escaneiam de novo |
| Confiança | Qualquer um poderia tocar em outro nome; aceito (jogo entre amigos). O host não sabe quem já viu — pergunta em voz alta |
| Dica | Falada em voz alta, o app só instrui; nada é digitado |
| Ordenar | Fila com todos os jogadores (ordem de cadastro); **arrastar** para reordenar (Pointer Events, funciona em toque e mouse); "Revelar ordem" sempre disponível. Decidido em 2026-09-16, substituindo o toque em sequência |
| Resultado | Lista na ordem escolhida com os números; ✓/✕ entre cada par vizinho; "Ordem perfeita!" ou "Quase lá · N fora de ordem" |
| Pontuação | **Cada rodada é isolada**, sem placar, sem vidas. "Novo tema" mantém jogadores; "Nova partida" volta ao setup |
| Timer | Não há |
| Publicação | O QR aponta para a URL em que o host abriu a página. Para convidados abrirem, o site precisa estar publicado (GitHub Pages); o modo local funciona em `file://` |
| Stack | HTML + CSS + JS puro, PT-BR. Única biblioteca: `qrcode-generator` (MIT, 1 arquivo) **vendorizada** em `ito/vendor/`, para funcionar offline e em `file://` |

## Arquitetura

Igual ao `mimica/`: um objeto `state` mutável, `render()` mostra a `<section>` de `state.screen`. Regras em `game.js` sem DOM, testadas com `node test.js`. `app.js` só faz DOM. A página é a mesma para host e convidado: se `location.hash` tem dados de rodada ao carregar, entra direto na tela `guest`.

### Arquivos

```
ito/
  index.html        # 8 <section hidden>: setup, theme, reveal, share, guest, discuss, arrange, result
  style.css         # copiado de mimica/style.css (mesmos tokens oklch/Inter) + chips, número gigante, lista de temas, fila ordenada, QR
  themes.js         # const THEMES = [{ cat, label, low, high }, ...]
  game.js           # regras puras + PRNG com semente + encode/decode do hash
  app.js            # estado, render(), handlers, geração do QR, leitura do hash
  vendor/qrcode.js  # qrcode-generator 1.4.4 (MIT), copiado sem alterações
  test.js           # asserts sobre game.js
  docs/PLANO.md
```

O zip do protótipo fica onde está (não é usado em runtime).

### Estado

```js
let state = {
  mode: 'local',      // 'local' | 'qr'
  players: [],        // nomes na ordem de cadastro; índice = id do jogador
  theme: null,        // { label, low, high }
  seed: '',           // 4 chars base36 da rodada; entra no QR
  secrets: [],        // secrets[i] = número do players[i], únicos em 1..100, derivados de seed
  revealIdx: 0,       // quem está com o celular na tela reveal (modo local)
  revealed: false,    // número visível agora?
  order: [],          // índices de jogadores na ordem escolhida (menor → maior)
  guest: null,        // modo convidado: { who: índice | null, shown: false }
  screen: 'setup',    // 'setup' | 'theme' | 'reveal' | 'share' | 'guest' | 'discuss' | 'arrange' | 'result'
};
```

### API de `game.js` (puro, sem DOM)

Todas recebem `state`, mutam e retornam o mesmo objeto. Sem classes.

| Função | O que faz |
|---|---|
| `newGame()` | Estado inicial, `screen = 'setup'` |
| `setMode(state, mode)` | `'local'` ou `'qr'` |
| `addPlayer(state, name)` | `trim`; ignora vazio, duplicado ou se já há 12; push em `players` |
| `removePlayer(state, i)` | `splice` |
| `startGame(state)` | Se `players.length >= 3` → `screen = 'theme'` |
| `setTheme(state, theme)` | `state.theme = theme`. Tema próprio: `{ label: texto, low: 'menor', high: 'maior' }` |
| `randomTheme(themes, rand = Math.random)` | Elemento aleatório da lista (`ponytail:` pode repetir entre rodadas; sem `used`) |
| `rng(seed)` | mulberry32: string → função `() => [0,1)` determinística (~5 linhas) |
| `newSeed()` | 4 chars base36 aleatórios (`Math.random().toString(36).slice(2, 6)`) |
| `drawNumbers(n, seed)` | Fisher-Yates em `[1..100]` usando `rng(seed)`, devolve os `n` primeiros. Mesma `seed` → mesma lista |
| `startRound(state)` | Exige `theme`; `seed = newSeed()`, `secrets = drawNumbers(n, seed)`, `revealIdx = 0`, `revealed = false`, `order = []`, `screen = mode === 'qr' ? 'share' : 'reveal'` |
| `show(state)` / `hide(state)` | Modo local: `revealed = true`; `hide` zera e faz `revealIdx++`; se `revealIdx >= players.length` → `screen = 'discuss'` |
| `encodeRound(state)` | String do hash: campos `seed, theme.label, theme.low, theme.high, ...players`, cada um com `encodeURIComponent`, unidos por `\|` |
| `decodeRound(hash)` | Inverso; devolve `null` se tiver menos de 7 campos (semente + tema + ≥3 nomes) |
| `loadGuest(state, hash)` | `decodeRound`; preenche `seed`, `theme`, `players`, `secrets = drawNumbers(n, seed)`, `guest = { who: null, shown: false }`, `screen = 'guest'`. Hash inválido → não muda nada |
| `pickGuest(state, i)` | `guest.who = i`, `guest.shown = false` |
| `toDiscuss(state)` | `screen = 'discuss'` (botão "Todos viram" na tela share) |
| `toArrange(state)` | `order = [0..n-1]` (ordem de cadastro), `screen = 'arrange'` |
| `move(state, from, to)` | Move o item da posição `from` para `to` na fila; índices inválidos ou iguais não alteram |
| `submitOrder(state)` | Se `order.length === players.length` → `screen = 'result'` |
| `pairsOk(state)` | Array de booleanos: `secrets[order[k]] < secrets[order[k+1]]` para cada vizinho |
| `errors(state)` | Quantos `false` em `pairsOk` (0 = ordem perfeita) |
| `newRound(state)` | Mantém `players` e `mode`; `theme = null`; `screen = 'theme'` |

Última linha: `if (typeof module !== 'undefined') module.exports = { ... }`.

### Link do QR

`app.js` monta `location.origin + location.pathname + '#' + encodeRound(state)` e desenha com `qrcode(0, 'M')` → `addData(url)` → `make()` → `createSvgTag({ cellSize: 6, margin: 4 })` dentro de `#qr`. Com 12 nomes acentuados e tema longo o hash chega a ~400 caracteres (percent-encoding triplica acentos), ainda bem dentro do limite de um QR; `ponytail:` comentário registrando que, se ficar difícil de ler, o próximo passo é base64 de UTF-8 em vez de `encodeURIComponent`.

`// ponytail:` a URL base é a que o host abriu. Em `file://` o QR aponta para o disco do host e ninguém consegue abrir — o texto da tela share avisa "abra o site pelo link publicado para o QR funcionar".

Botão "Compartilhar link": `navigator.share({ url })` dentro de `try/catch`; sem suporte, `navigator.clipboard.writeText(url)` e texto "Link copiado".

### Telas e fluxo (texto do protótipo)

1. **setup** — eyebrow "Nova partida", título "Quem vai jogar?", bloco `.howto` com a regra em 3 linhas. Toggle pill "1 celular só / Cada um no seu" com dica abaixo ("Um celular passa de mão em mão a cada rodada." / "Cada pessoa escaneia um QR code e vê seu número no próprio celular."). Input "Nome do jogador" + botão "+" (Enter também adiciona), chips dos jogadores com inicial colorida (3 cores cíclicas: blue/purple/green) e ✕, contador "Adicione pelo menos 3 jogadores (n/3)" em laranja ou "n jogadores" em cinza, botão "Continuar" desabilitado com menos de 3.
2. **theme** — "Passo 2 · Escolham um tema". Chips horizontais de categoria (filtro, primeira selecionada por padrão), lista de cards de tema (label + linha `1 · low — high · 100`), card selecionado com borda roxa. Botão "🎲 Tema aleatório". Input "ou escreva o seu tema" (ao digitar, vira o tema selecionado). Botão "Começar rodada" desabilitado sem tema.
3. **reveal** (modo local) — barra de progresso segmentada (1 segmento por jogador, preenchidos até `revealIdx`), linha `TEMA · label`.
   - `revealed = false`: avatar grande com inicial, "Passe o celular para" / **nome**, botão "Toque para ver seu número", nota "Confira se ninguém está olhando de lado 👀".
   - `revealed = true`: "{nome}, seu número é", número em ~96px mono azul, extremos `1 · low` / `high · 100`, botão verde "Memorizei, esconder e passar".
   - Depois do último `hide` vai direto para **discuss**.
4. **share** (modo QR) — "Passo 3 · Escaneiem o QR code", linha `TEMA · label`. QR grande em card claro (fundo branco, para a câmera ler). Texto "Cada um aponta a câmera do celular, abre o link e toca no próprio nome." Botão secundário "Compartilhar link". Botão "Também jogo: ver meu número" abre o mesmo link em nova guia (`window.open`), onde o host entra como convidado e vê o próprio número, sem perder a guia do host. Botão verde "Todos viram, continuar" → discuss. Aviso pequeno se a URL for `file://`.
5. **guest** (convidado, entra pelo hash) — card do tema com extremos. `who = null`: "Quem é você?" e um botão grande por nome. `who` escolhido e `shown = false`: "Você é {nome}?" com "Sou eu, mostrar número" e "Não, voltar". `shown = true`: "{nome}, seu número é", número gigante, extremos, botão "Esconder" (volta a `shown = false` sem perder `who`; o botão vira "Mostrar de novo"). Sem botão de sair: a pessoa fecha a aba; novo tema = novo QR.
6. **discuss** — "Hora da dica", subtítulo "Todos já viram seu número. Devolvam o celular para a mesa." (modo local) ou "Todo mundo já viu? Então é hora da dica." (modo QR). Card roxo com o tema e extremos, parágrafo de instrução ("Cada jogador diz em voz alta uma dica dentro do tema, sem falar números…"), chips dos jogadores, botão "Organizar ordem →".
7. **arrange** — "Organizem a ordem", subtítulo "Arrastem os nomes: menor número no topo, maior embaixo.". **Fila** com todos (linhas numeradas por CSS counter, avatar+nome, alça ☰). Arrastar com Pointer Events: `pointerdown` marca a linha, `pointermove` usa `elementFromPoint` para saber que linha está sob o dedo e chama `move`; os nós do DOM são reordenados com `appendChild` (não recriados) para manter o pointer capture. `ponytail:` a linha pula para o slot em vez de flutuar sob o dedo. Botão verde "Revelar ordem".
8. **result** — Card verde "🎉 Ordem perfeita!" + "Todo mundo acertou a leitura da mesa." ou vermelho "Quase lá" + "N par(es) fora de ordem — vejam os ✕." Lista na ordem escolhida (avatar, nome, número mono grande) com conector entre linhas: "✓ em ordem" verde ou "✕ fora de ordem" vermelho. Botão "Novo tema" → theme; link "Nova partida (trocar jogadores)" → setup.

Botão fixo "✕ Cancelar jogo" (`btnHome`) fora de setup e guest, com `confirm`, como no mimica. Ao voltar ao setup, `history.replaceState` limpa o hash.

`render()` esconde todas as `<section>` e mostra a de `state.screen`. Listas (chips, temas, fila, nomes do convidado) são montadas com `innerHTML` + template string; handlers por `data-i` com delegação no container. Ao carregar: `if (location.hash.length > 1) loadGuest(state, location.hash.slice(1))`.

### `themes.js`

```js
const THEMES = [
  { cat: 'Comida e sabores', label: 'Sabor de pizza', low: 'só queijo', high: 'a mistura mais bizarra do cardápio' },
  ...
];
```

Array plano com campo `cat`; as categorias da tela vêm de `[...new Set(THEMES.map(t => t.cat))]`. Meta: **8 categorias × ~10 temas ≈ 80 temas**, PT-BR, sem conteúdo ofensivo. Cada tema precisa de extremos claros e engraçados. Categorias e exemplos:

- **Comida e sabores** — Sabor de pizza; Picância de um prato; Doce ou salgado; Prato de boteco
- **Sensações e emoções** — Quão assustador é isso; Nível de vergonha; Felicidade que isso te dá
- **Trabalho e dia a dia** — Urgência desse e-mail; Quão chata é essa reunião; Dificuldade dessa tarefa
- **Cultura pop** — Filme para chorar; Música para festa; Série para maratonar
- **Lugares e viagens** — Destino de férias (relaxante → aventura); Lugar para morar
- **Animais e natureza** — Animal de estimação (fácil de cuidar → impossível); Bicho perigoso
- **Objetos e invenções** — Utilidade de uma invenção; Coisa cara
- **Polêmicas leves** — Quão aceitável é isso (ex.: abacaxi na pizza); Coisa que dá azar

### CSS

`style.css` parte do de `mimica/` (mesmos tokens, `body` flex centralizado, `section` 480px, botões 64px). Adições: `.toggle` (pill com 2 opções), `.chip` (pill com avatar), `.avatar` (círculo com inicial, 3 cores por `data-c`), `#secret` / `#guestSecret` (número gigante, `tabular-nums`, `user-select: none`), `.themeCard` / `.themeCard.sel`, `.catChips` (scroll horizontal), `#progressSeg` (segmentos), `.queue` (linhas numeradas), `.connector` (✓/✕ centralizado), `#qr` (card branco, SVG 100% de largura, máx. 320px), `button:disabled` (opacity .4).

## Passos de implementação (ordem)

1. Baixar `vendor/qrcode.js` (`https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js`), sem alterações.
2. **`test.js` primeiro**: asserts para `rng` (mesma semente → mesma sequência; sementes diferentes → sequências diferentes), `drawNumbers` (tamanho n, únicos, todos em 1..100, n=12 e n=100, determinístico por semente), `addPlayer` (trim, ignora vazio/duplicado/13º), `startGame` (bloqueia com 2, passa com 3), `startRound` sem tema não muda `screen`; com `mode: 'qr'` vai para `share`, com `local` para `reveal`, fluxo `show`/`hide` (n vezes → `discuss`), `encodeRound`/`decodeRound` ida e volta com nome contendo `|` e acentos, `decodeRound` de hash inválido → `null`, `loadGuest` produz os mesmos `secrets` do host para a mesma semente, `pickGuest`, `pick` ignora repetido, `undo`, `submitOrder` bloqueia com fila incompleta, `pairsOk`/`errors` com `secrets` fixos (ordem perfeita = 0 erros; invertida = n−1), `newRound` mantém `players` e `mode` e zera `theme`, `randomTheme` devolve elemento da lista.
3. `game.js` até `node test.js` imprimir `OK`.
4. `themes.js` com os ~80 temas.
5. `index.html` com as 8 `<section>` e ids; `<script src="vendor/qrcode.js">` antes de `app.js`.
6. `app.js`: estado, `render()`, handlers, delegação nas listas, QR, share/clipboard, leitura do hash no load.
7. `style.css`.
8. Verificação manual no navegador (abaixo).

## Verificação

- `cd ito && node test.js` imprime `OK`.
- Abrir `ito/index.html` no navegador (file:// basta para o modo local; ou `npx serve`):
  1. Setup: "Continuar" desabilitado com 2 nomes; nome vazio/duplicado não entra; ✕ remove; com 3 → tela de tema.
  2. Tema: trocar categoria filtra a lista; 🎲 seleciona um; digitar tema próprio habilita "Começar rodada" com extremos "menor/maior".
  3. Modo local: "Passe o celular para A" → toque → número → esconder → "Passe para B"… após o último cai em "Hora da dica"; barra segmentada avança.
  4. Os números dos jogadores nunca se repetem (ver no resultado; repetir algumas rodadas).
  5. Arrange: arrastar uma linha para cima/baixo (toque e mouse) reordena e a numeração acompanha; "Revelar ordem" leva ao resultado com a ordem arrastada.
  6. Result: ordem correta → card verde "Ordem perfeita!"; ordem errada → card vermelho com contagem e ✕ nos pares certos.
  7. "Novo tema" mantém os jogadores; "Nova partida" volta ao setup vazio; "✕ Cancelar jogo" pede confirmação.
  8. DevTools mobile (390px): número legível a 1 m, botões alcançáveis com o polegar, lista de temas rola sem quebrar o layout.
- Modo QR (precisa de URL acessível: `npx serve` na mesma Wi-Fi com o IP da máquina, ou GitHub Pages):
  9. Setup com "Cada um no seu" → tema → tela share mostra QR; "Compartilhar link" copia/abre o share sheet.
  10. Escanear com a câmera de um celular: abre a página na tela guest com o tema e os nomes; tocar em "Ana" → "Você é Ana?" → "Sou eu" → número; "Esconder" oculta e "Mostrar de novo" volta o mesmo número.
  11. Abrir o mesmo link em outra aba e escolher "Bruno": número diferente do da Ana. Os números batem com os que o host revela no resultado.
  12. Nome com acento e com `|` sobrevive à ida e volta pelo QR.
  13. "Todos viram, continuar" → dica → organizar → resultado como no modo local. "Novo tema" gera um QR diferente (semente nova).
  14. Abrir a página com hash quebrado (`#abc`) → cai no setup normal.

## Fora de escopo (YAGNI — adicionar só se pedido)

- Sincronização real entre celulares (PeerJS/WebRTC, Firebase): "espelho completo" com tema, ordem e resultado em cada celular, ou host sabendo quem já viu. O QR resolve o único segredo do jogo (o número) sem rede; só vale voltar a isso se o grupo quiser jogar sem estar na mesma mesa.
- Scanner de QR dentro da página (a câmera nativa já abre o link) e encurtador de URL.
- Impedir alguém de escolher outro nome (sessão, senha por jogador).
- Vidas / 3 rodadas com cartas cumulativas (Ito original), placar, sequência de acertos.
- Timer, wake lock, som/vibração.
- Animação de "flutuar" no arrasto (a linha segue o dedo pixel a pixel); hoje ela pula para o slot.
- Registrar a dica digitada no app.
- Persistência em `localStorage`, histórico, PWA/offline.
