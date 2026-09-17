# Plano de implementação — Mímica (party game)

> Ao executar, o passo 1 copia este arquivo para `docs/PLANO.md` dentro do projeto, como pedido.

## Contexto

Pasta `party-games/mimica` está vazia. Objetivo: um site de mímica para jogar **em um único dispositivo** (celular/notebook na sala), sem backend, sem login, sem build. Duas equipes se alternam; o dispositivo é operado por um **juiz da equipe adversária**, que vê a palavra junto com o mímico e marca acertos.

## Regras fechadas com o usuário

| Regra | Decisão |
|---|---|
| Equipes | 2, nomes editáveis (padrão "Equipe A" / "Equipe B") |
| Rodadas | 4 por equipe, alternadas → 8 rodadas no total |
| Tempo por rodada | 2 minutos (120 s) |
| Palavras por rodada | 5, em ordem crescente de dificuldade |
| Pontuação | 1ª palavra = 1 pt, 2ª = 2 … 5ª = 5 (máx. 15/rodada, 60/partida) |
| Pular | Permitido, sem penalidade; a palavra pulada não pontua e não volta |
| Fim da rodada | Timer zera **ou** a 5ª palavra foi acertada/pulada |
| Empate | Rodada extra para cada equipe, repete até desempatar |
| Lista de palavras | Única, PT-BR, geral, classificada por nível 1–5; nível 5 pode ter frases de até 3 palavras; sem repetir na partida |
| Stack | HTML + CSS + JS puro, sem dependências; abre direto no navegador / GitHub Pages |

## Arquitetura

Um objeto `state` + uma função `render()`. Lógica de regras isolada em `game.js` (sem DOM, funções puras sobre o estado), para ser testada com `node test.js`. `app.js` só faz DOM e timer.

### Arquivos (5 no total)

```
mimica/
  index.html   # todas as telas como <section hidden>, uma visível por vez
  style.css    # mobile-first, botões grandes, texto grande
  words.js     # const WORDS = { 1:[...], 2:[...], 3:[...], 4:[...], 5:[...] }
  game.js      # regras puras: newGame, startRound, hit, skip, endRound, isOver, winner
  app.js       # estado, render(), handlers, timer, wake lock
  test.js      # asserts sobre game.js (node test.js)
  docs/PLANO.md
```

### Estado (`app.js`)

```js
let state = {
  teams: [{ name: 'Equipe A', score: 0 }, { name: 'Equipe B', score: 0 }],
  round: 0,           // 0-based; equipe da vez = round % 2
  words: [],          // 5 palavras da rodada atual, níveis 1..5 nessa ordem
  wordIndex: 0,       // 0..4 → vale wordIndex + 1 pontos
  roundScore: 0,
  endAt: 0,           // timestamp de fim da rodada (Date.now() + 120000)
  used: new Set(),    // palavras já sorteadas na partida
  screen: 'setup',    // 'setup' | 'handoff' | 'playing' | 'roundEnd' | 'gameOver'
};
```

### API de `game.js` (puro, sem DOM)

Todas recebem `state`, mutam e retornam o mesmo objeto. Sem classes.

| Função | O que faz |
|---|---|
| `newGame(nameA, nameB)` | Retorna estado inicial na tela `setup` → `handoff` |
| `drawWords(used)` | Sorteia 1 palavra de cada nível 1..5 sem repetir; se um nível esgotar, libera as usadas daquele nível (`// ponytail:` comentário) |
| `startRound(state, now)` | Preenche `words`, zera `wordIndex`/`roundScore`, `endAt = now + 120000`, `screen = 'playing'` |
| `hit(state)` | Soma `wordIndex + 1` em `roundScore` e no placar da equipe da vez; avança; se era a 5ª → `endRound` |
| `skip(state)` | Só avança; se era a 5ª → `endRound` |
| `endRound(state)` | `round++`, `screen = isOver(state) ? 'gameOver' : 'roundEnd'` |
| `isOver(state)` | `round >= 8 && round % 2 === 0 && scoreA !== scoreB` — cobre as 8 rodadas e o desempate em pares sem lógica extra |
| `winner(state)` | Índice da equipe com maior placar |
| `timeLeft(state, now)` | `Math.max(0, Math.ceil((endAt - now) / 1000))` |

Última linha de `game.js`: `if (typeof module !== 'undefined') module.exports = { ... }` para o `test.js` rodar em node e o navegador carregar via `<script>`.

### Telas e fluxo

1. **setup** — dois inputs de nome, botão "Começar".
2. **handoff** — "Rodada N de 8 · Vez da {equipe}. Entregue o celular ao juiz da {outra equipe} e chame o mímico." Placar atual. Botão "Iniciar rodada" (só aqui o timer começa). Nas rodadas de desempate mostra "Desempate".
3. **playing** — timer grande, palavra atual bem grande, "vale N pontos", pontos da rodada, dois botões grandes: **Acertou** / **Pular**. Sem botão de pausa (YAGNI).
4. **roundEnd** — "{equipe} fez +N pontos", placar, botão "Próxima rodada" → handoff.
5. **gameOver** — "{equipe} venceu!" com placar final e botão "Jogar de novo" → setup. (Empate nunca chega aqui: `isOver` força rodadas extras; a tela `handoff` avisa que é desempate.)

`render()` esconde todas as `<section>` e mostra a de `state.screen`, preenchendo textos por `id`.

### Timer (`app.js`)

`setInterval` de 250 ms que recalcula `timeLeft(state, Date.now())` a partir do `endAt` — não conta ticks, então não deriva se a aba for para segundo plano. Quando chega a 0 chama `endRound` e limpa o intervalo. Ao entrar em `playing`, tenta `navigator.wakeLock.request('screen')` dentro de `try/catch` (3 linhas, evita a tela apagar no meio da mímica; ignora se não suportado).

### `words.js`

Objeto `{ 1: [...], ..., 5: [...] }` com **~50 entradas por nível** (250 no total). 8 rodadas usam 40; sobra para desempates e variedade. Critério por nível:

- **1** — substantivo concreto, 1 palavra, fácil de gesticular: *cachorro, escova de dente, chuva*
- **2** — objeto/ação simples: *guarda-chuva, pescar, dirigir*
- **3** — ação composta ou lugar: *lavar louça, cinema, dentista*
- **4** — conceito ou expressão, até 2 palavras: *ciúme, fila do banco, madrugada*
- **5** — frase/situação, até 3 palavras: *pagar boleto atrasado, perder o ônibus, ressaca de segunda*

Todas em PT-BR, sem acentos trocados, sem palavras ofensivas.

### CSS

Mobile-first, `100dvh`, fonte grande (`clamp`), botões com `min-height: 64px`, `user-select: none` na palavra, cores fortes para Acertou (verde) / Pular (cinza). Sem framework, sem variáveis CSS além de 3–4 cores.

## Passos de implementação (ordem)

1. Criar `docs/PLANO.md` com o conteúdo deste arquivo.
2. **`test.js` primeiro** (TDD leve): asserts para `drawWords` (5 palavras, níveis 1..5, sem repetir), `hit` (pontuação 1..5, soma 15 numa rodada perfeita), `skip` (não pontua, avança), `endRound` após a 5ª palavra, `isOver` (falso com 7 rodadas, verdadeiro com 8 e placar diferente, falso com 8 e empate, verdadeiro com 10 e placar diferente), `timeLeft` (nunca negativo).
3. `game.js` até `node test.js` passar.
   - **Learn by Doing**: deixar `isOver(state)` com `// TODO(human)` e pedir ao usuário para implementar — é a regra que une "8 rodadas" + "desempate em pares" numa única expressão, e o teste já diz o que ela precisa satisfazer.
4. `words.js` com as 250 entradas.
5. `index.html` com as 5 `<section>` e ids.
6. `app.js`: estado, `render()`, handlers dos botões, timer, wake lock.
7. `style.css`.
8. Verificação manual no navegador (abaixo).

## Verificação

- `node test.js` imprime `OK` (falha com stack trace em qualquer assert quebrado).
- Abrir `index.html` no navegador (ou `npx serve` / Live Server, opcional):
  1. Setup → nomes → Começar → tela handoff mostra "Rodada 1 de 8 · Vez da Equipe A".
  2. Iniciar rodada → timer em 2:00 decrescendo, palavra de nível 1, "vale 1 ponto".
  3. Acertou ×5 → rodada termina antes do timer com +15; placar A = 15.
  4. Próxima rodada → vez da Equipe B; Pular ×5 → +0.
  5. Deixar o timer zerar numa rodada → termina sozinho.
  6. Forçar empate (mesmos acertos para as duas) → após a 8ª rodada aparece handoff "Desempate", não gameOver.
  7. Jogo com placar diferente após 8 rodadas → gameOver com vencedor correto; "Jogar de novo" volta ao setup zerado.
  8. Testar em celular (ou DevTools mobile): botões alcançáveis com o polegar, palavra legível a 1 m de distância.

## Fora de escopo (YAGNI — adicionar só se pedido)

- Modo online / salas / múltiplos dispositivos.
- Categorias de palavras, filtros, palavras customizadas pela UI.
- Som/vibração ao fim do timer (1 linha com `<audio>` se quiser depois).
- Pausa no meio da rodada.
- Persistência da partida em `localStorage` (recarregar a página reinicia o jogo).
- Histórico de partidas, animações, PWA/offline.
