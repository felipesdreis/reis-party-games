# Plano de implementação — Batata Quente (party game)

## Contexto

Terceiro jogo da coleção `party-games`, seguindo o molde de `mimica/` e `ito/`. Um objeto físico (bola, bicho de pelúcia etc.) é passado de mão em mão entre os jogadores enquanto cada um fala em voz alta um item de uma categoria. O celular **não participa da passagem de turno** — isso é 100% físico/verbal. A tela só serve para configurar a partida, manter um temporizador escondido rodando, disparar o alarme de explosão e deixar o host registrar manualmente quem foi eliminado.

## Regras fechadas com o usuário

| Regra | Decisão |
|---|---|
| Passagem de turno | 100% física (objeto real). O app nunca mostra de quem é a vez nem tem botão "passar" |
| Jogadores | Nomes digitados no início, lista dinâmica (adicionar/remover), mínimo 2 para iniciar |
| Eliminação | Ao explodir, o host toca no nome de quem segurava o objeto — escolha explícita, não é contagem abstrata |
| Fim de rodada | 1 jogador eliminado por explosão; recomeça o timer para os restantes |
| Fim de jogo | Quando resta 1 jogador, ele vence |
| Duração da rodada | Host escolhe um alvo em segundos (slider 30–120s, padrão 45s); o tempo real da explosão varia aleatoriamente até ±10s pra cima ou pra baixo desse alvo, nunca abaixo de 30s — ninguém sabe o segundo exato |
| Tela de vencedor | Fundo verde + emojis de confete/fogos flutuando no plano de fundo |
| Cronômetro | Escondido durante o jogo — tela "jogando" não mostra segundos nem barra de progresso; mostra só a categoria e um indicador ambiente de "bomba ativa" |
| Efeito de explosão | `navigator.vibrate()` (guard, falha em silêncio) + flash visual (fundo vermelho piscando + "💥") + beep sintetizado via Web Audio API, sem arquivo de áudio |
| Categorias | Lista fixa de sugestões (array de strings) + botão 🎲 aleatório + campo de texto livre customizado. Escolhida no setup; pode ser **trocada a cada nova rodada**, no próprio aviso de eliminação, antes do botão "Próxima rodada" — evita ficar preso ao mesmo tema a partida inteira |
| Tela de explosão | Uma única `<section id="exploded">`; o `render()` troca a sub-vista internamente conforme `state.eliminated` (picker de nome vs. confirmação+próxima rodada), sem 5ª tela |

## Arquitetura

### Arquivos

```
batata-quente/
  index.html      # 4 <section hidden>: setup, playing, exploded, gameOver
  style.css       # baseado em mimica/ito (tokens oklch/Inter) + .bomb (pulso), .boom (flash)
  categorias.js   # const CATEGORIES = [...strings PT-BR...]
  game.js         # regras puras, zero DOM
  app.js          # DOM, render(), timer, wake lock, efeitos de explosão
  test.js         # asserts com node puro
  docs/PLANO.md
```

### Estado (`state`)

```js
let state = {
  screen: 'setup',   // 'setup' | 'playing' | 'exploded' | 'gameOver'
  players: [],       // nomes cadastrados no setup
  alive: [],         // nomes ainda na partida; copiado de players ao startGame; um sai por explosão
  category: '',      // categoria da rodada atual (pode trocar entre rodadas)
  duration: 45,      // segundos-alvo escolhidos pelo host (30–120); tempo real varia ±10s (JITTER)
  endAt: 0,          // timestamp de quando a bomba "explode" — já com o jitter aplicado; nunca exibido na UI
  eliminated: null,  // null = ainda não escolheram quem segurava; string = nome já escolhido
};
```

### API de `game.js`

| Função | O que faz |
|---|---|
| `newGame()` | Estado inicial, `screen: 'setup'` |
| `addPlayer(state, name)` | Trim; ignora vazio ou duplicado |
| `removePlayer(state, i)` | Remove por índice |
| `setCategory(state, label)` | Define categoria (sugestão, aleatória ou customizada) |
| `randomCategory(categories, rand = Math.random)` | Retorna item aleatório da lista; não muta `state` |
| `setDuration(state, seconds)` | Clampa entre `MIN_DURATION` (30) e `MAX_DURATION` (120); ignora `NaN` |
| `startGame(state, now, rand = Math.random)` | Exige `players.length >= 2` e categoria definida; copia `players` para `alive`, chama `startRound` |
| `startRound(state, now, rand = Math.random)` | Sorteia o tempo real (`duration ± JITTER` segundos, nunca abaixo de `MIN_DURATION`), `endAt = now + tempo_real*1000`, `eliminated = null`, `screen = 'playing'` |
| `timeLeft(state, now)` | Segundos restantes — uso interno do `app.js`, nunca exibido |
| `explode(state)` | Só age se `screen === 'playing'`; `screen = 'exploded'` |
| `eliminate(state, name)` | Remove `name` de `alive`, `eliminated = name`; se só resta 1 → `screen = 'gameOver'` |
| `isOver(state)` | `alive.length <= 1` |
| `winner(state)` | `alive[0]` |
| `nextRound(state, now, rand = Math.random)` | Só age se `screen === 'exploded'` e não terminou; chama `startRound` de novo |

### Telas e fluxo

```
setup ──(startGame)──> playing
playing ──(timer chega a 0 → explode())──> exploded [eliminated=null]
exploded[null] ──(host toca num nome → eliminate())──┬─> exploded[nome]   (se restam ≥2)
                                                       └─> gameOver        (se resta 1)
exploded[nome] ──(Próxima rodada → nextRound())──> playing
gameOver ──(Jogar de novo → newGame())──> setup
```

- **setup**: chips de nomes, grid de categorias + 🎲 + campo customizado, slider de duração, botão "Começar".
- **playing**: só categoria + ícone de bomba pulsando. Nenhum número de tempo.
- **exploded** (`eliminated === null`): dispara vibração+flash+beep; picker de nomes vivos.
- **exploded** (`eliminated !== null`): "{nome} eliminado! Restam N" + seletor de categoria (mesmo widget do setup) + "Próxima rodada".
- **gameOver**: "{winner} venceu!" + fundo com gradiente verde + emojis de confete/fogos flutuando no plano de fundo (`body[data-screen="gameOver"]` + `#confetti`) + "Jogar de novo".

Fundo com gradiente radial por tela (`body[data-screen]`, um por valor de `state.screen`): azul no setup, laranja jogando, vermelho na explosão, verde no gameOver.

### Timer e efeitos (`app.js`)

Timer por timestamp absoluto (`endAt`), `setInterval` de 250ms só verificando `timeLeft === 0` — nunca escreve número na tela. `endAt` já sai de `startRound` com o jitter aplicado (ver API de `game.js`), então o próprio `app.js` não precisa saber de aleatoriedade. Ao disparar: `navigator.vibrate?.(...)`, classe `.boom` no `body` (flash CSS), beep via `AudioContext`+`OscillatorNode`+`GainNode` criado dentro de um handler de clique existente (evita bloqueio de autoplay). Wake lock ao entrar em `'playing'`.

## Fora de escopo (YAGNI)

- Placar por pontos, múltiplas vidas/chances por jogador.
- Persistência entre sessões (`localStorage`), histórico de partidas.
- Trocar categoria **durante** uma rodada em andamento (só entre rodadas).
- Música contínua — só o beep pontual da explosão.
- Detecção de repetição de itens ditos (é verbal, sem validação por texto).
- Pausa no meio da rodada.
- Modo online/múltiplos dispositivos/QR code.
- Limite máximo de jogadores.

## Passos de implementação (ordem)

1. `docs/PLANO.md` (este arquivo).
2. `test.js` primeiro (TDD leve).
3. `game.js` até `node test.js` imprimir `OK`.
4. `categorias.js`.
5. `index.html`.
6. `style.css`.
7. `app.js`.
8. Verificação manual no navegador.
9. Card de `batata-quente` no hub raiz `/index.html`.

## Verificação

- `node test.js` → `OK`.
- Abrir `batata-quente/index.html` via `file://`: setup com validação de jogadores/categoria; duração baixa para testar rápido; `playing` sem número de tempo; explosão dispara vibração/flash/beep; picker de nomes; trocar categoria na tela de eliminado; "Próxima rodada" reinicia com a categoria vigente; com 2 jogadores, eliminar vai direto a `gameOver`; "Jogar de novo" zera; "✕ Cancelar jogo" limpa o timer.
