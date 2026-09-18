# Plano de implementação — Hot Seat (party game)

## Contexto

Pasta `party-games/hot-seat` vazia. Objetivo: versão digital do jogo Hot Seat pra jogar **em um único dispositivo passado de mão em mão**, sem backend, sem build. A cada rodada, um jogador sorteado senta na "Hot Seat", escolhe uma pergunta entre 3 sugestões de uma categoria, e responde sobre si mesmo. Os demais **escrevem seus palpites no papel** (fora do app) antes da revelação. O app não lida com sigilo — só sorteia perguntas, controla a rotação da Hot Seat e registra quem acertou.

## Regras fechadas com o usuário

| Regra | Decisão |
|---|---|
| Sigilo dos palpites | Resolvido fora do app (papel); o app só registra o resultado depois da revelação |
| Jogadores | Lista dinâmica de nomes, mínimo 2, sem máximo |
| Categorias | 4 fixas: Leves, Engraçadas, Bizarras, Desafiadoras — escolhida a cada rodada (não uma vez só) |
| Perguntas por rodada | 3 sugestões sorteadas da categoria escolhida; a Hot Seat escolhe 1 |
| Rotação da Hot Seat | Sorteio a cada rodada, sem repetir dentro da mesma "volta" |
| Fim de jogo | Quando todos tiverem passado 1x pela Hot Seat (N jogadores → N rodadas) |
| Pontuação | 1 ponto por jogador que acertou o palpite (marcado manualmente pelo grupo, toque nos nomes) |
| Vencedor | Ranking final por pontos; empates aparecem lado a lado, sem desempate |
| Stack | HTML + CSS + JS puro, sem dependências; abre direto no navegador / GitHub Pages |

## Arquitetura

Mesmo padrão do `mimica/`: objeto `state` + `render()`. Lógica de regras isolada em `game.js` (sem DOM, funções puras sobre o estado), testável com `node test.js`. `app.js` só faz DOM.

### Arquivos

```
hot-seat/
  index.html      # 6 <section hidden>, uma visível por vez
  style.css       # mobile-first, botões grandes, texto grande
  questions.js    # const QUESTIONS = { leves:[...], engracadas:[...], bizarras:[...], desafiadoras:[...] }
  game.js         # regras puras: newGame, startGame, nextRound, pickCategory, pickQuestion, toggleCorrect, confirmRound, ranking
  app.js          # estado, render(), handlers, link ../ pro hub
  test.js         # asserts sobre game.js (node test.js)
  docs/PLANO.md
```

### Estado (`app.js`)

```js
let state = {
  players: [],            // [{ name, score }]
  remaining: [],          // índices de jogadores que ainda não sentaram nesta volta
  hotSeatIndex: null,
  round: 0,               // 1-based, exibido como "Rodada N de {players.length}"
  category: null,         // 'leves' | 'engracadas' | 'bizarras' | 'desafiadoras'
  suggestions: [],        // 3 perguntas sorteadas da categoria
  question: null,         // pergunta escolhida pela Hot Seat
  usedQuestions: new Set(),   // evita repetir pergunta na mesma partida
  correctGuessers: new Set(), // índices marcados como "acertou" antes de confirmar
  screen: 'setup',        // 'setup' | 'roundStart' | 'questionPick' | 'scoring' | 'roundEnd' | 'gameOver'
};
```

### API de `game.js` (puro, sem DOM)

Todas recebem `state`, mutam e retornam o mesmo objeto. Sem classes.

| Função | O que faz |
|---|---|
| `newGame()` | Retorna estado inicial, `screen = 'setup'` |
| `startGame(state, names)` | Filtra nomes vazios; exige `>= 2`; cria `players` com `score: 0`; `remaining = [0..n-1]`; chama `nextRound` |
| `nextRound(state)` | Sorteia `hotSeatIndex` aleatório dentre `remaining`, remove esse índice de `remaining`; `round++`; `screen = 'roundStart'` |
| `pickCategory(state, category, pool)` | Sorteia 3 perguntas de `pool[category]` que não estejam em `usedQuestions` (se sobrarem menos de 3, libera as usadas dessa categoria — `// ponytail:` comentário, igual ao `drawWords` do mímica); guarda em `suggestions`/`category`; `screen = 'questionPick'` |
| `pickQuestion(state, question)` | `question = question`; adiciona a `usedQuestions`; `screen = 'scoring'` |
| `toggleCorrect(state, playerIndex)` | Adiciona/remove `playerIndex` de `correctGuessers` (nunca inclui `hotSeatIndex`) |
| `confirmRound(state)` | Soma 1 ponto a cada jogador em `correctGuessers`; limpa `correctGuessers`/`question`/`suggestions`; `screen = remaining.length === 0 ? 'gameOver' : 'roundEnd'` |
| `ranking(state)` | Retorna `players` (com índice original) ordenados por `score` desc, para a tela final |
| `totalRounds(state)` | `state.players.length` |

Última linha de `game.js`: `if (typeof module !== 'undefined') module.exports = { ... }`.

### Telas e fluxo

1. **setup** — lista de inputs de nome (botão "+ jogador" / remover), mínimo 2 preenchidos. Botão "Começar" → `startGame`.
2. **roundStart** — "Rodada N de {total} · {jogador} vai pra Hot Seat!" + 4 botões de categoria (Leves/Engraçadas/Bizarras/Desafiadoras). Tocar numa categoria chama `pickCategory` e avança.
3. **questionPick** — mostra as 3 perguntas sugeridas como botões grandes; a Hot Seat toca em uma → `pickQuestion`.
4. **scoring** — pergunta escolhida em destaque no topo + instrução "Escrevam os palpites no papel. Quando a Hot Seat revelar, toque em quem acertou." Lista dos demais jogadores com toggle (botão que vira "acertou ✓" ao tocar). Botão "Confirmar rodada" → `confirmRound`.
5. **roundEnd** — "+1 ponto: {nomes marcados}" (ou "Ninguém acertou dessa vez"), placar atual de todos. Botão "Próxima rodada" → `nextRound`.
6. **gameOver** — ranking final (`ranking(state)`), destaque pro 1º lugar (ou empate lado a lado). Botão "Jogar de novo" → `newGame` → `setup`.

`render()` esconde todas as `<section>` e mostra a de `state.screen`, preenchendo textos por `id`, igual aos outros jogos.

### `questions.js`

```js
const QUESTIONS = {
  leves: [ /* ~20 perguntas leves, 1ª pessoa da Hot Seat */ ],
  engracadas: [ /* ~20 */ ],
  bizarras: [ /* ~20 */ ],
  desafiadoras: [ /* ~20, sem nada ofensivo/constrangedor demais */ ],
};
```

Todas em PT-BR, formuladas na 1ª pessoa de quem está na Hot Seat (ex.: "Qual é meu animal favorito?", "Qual foi minha mentirinha mais recente?"), pra ficarem prontas pra leitura em voz alta.

### CSS

Mobile-first, `100dvh`, fonte grande (`clamp`), botões `min-height: 64px`. Fundo por tela via `body[data-screen="x"]` reaproveitando as variáveis de cor já usadas nos outros jogos (`:root`, sem paleta nova). Classe `.backHub` replicada (link `← Escolher outro jogo` no topo do `#setup`), `<body data-screen="setup">` hardcoded no HTML.

## Passos de implementação (ordem)

1. ~~Criar `docs/PLANO.md`~~ (este arquivo).
2. **`test.js` primeiro**: `startGame` (mínimo 2 nomes, filtra vazios), `nextRound` (sorteia sem repetir dentro da volta, remove de `remaining`), `pickCategory` (3 perguntas, sem repetir `usedQuestions`, libera categoria se esgotar), `pickQuestion`, `toggleCorrect` (não deixa marcar a própria Hot Seat), `confirmRound` (soma pontos certos, decide `roundEnd` vs `gameOver`), `ranking` (ordena por score).
3. `game.js` até `node test.js` passar.
4. `questions.js` com as ~80 perguntas (20 × 4 categorias).
5. `index.html` com as 6 `<section>` e ids.
6. `app.js`: estado, `render()`, handlers.
7. `style.css`.
8. Entrada no `index.html` da raiz (`<a class="game" href="hot-seat/">`) — fora do escopo deste PLANO, feito só quando o jogo estiver implementado.
9. Verificação manual no navegador (abaixo).

## Verificação

- `node test.js` imprime `OK`.
- Abrir `index.html` no navegador:
  1. Setup com 3 nomes → Começar → roundStart mostra "Rodada 1 de 3 · {jogador} vai pra Hot Seat!".
  2. Escolher categoria → 3 perguntas aparecem, diferentes entre si.
  3. Escolher pergunta → tela scoring mostra a pergunta e os outros 2 jogadores (não a Hot Seat).
  4. Marcar 1 acerto → Confirmar → roundEnd mostra +1 pro marcado, placar atualizado.
  5. Repetir até a 3ª rodada → após confirmar, vai direto pra gameOver com ranking correto.
  6. Jogar de novo → volta pro setup zerado.
  7. Testar em celular: botões alcançáveis com o polegar, texto da pergunta legível.

## Fora de escopo (YAGNI — adicionar só se pedido)

- Captura da resposta real da Hot Seat no app (ela é falada/mostrada no papel, o app não precisa saber).
- Modo online / múltiplos dispositivos.
- Editar/adicionar perguntas pela UI.
- Desempate no ranking final.
- Timer por rodada.
- Persistência da partida em `localStorage`.
- Histórico de partidas, animações, PWA/offline.
