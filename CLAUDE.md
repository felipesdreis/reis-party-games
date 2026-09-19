# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este repositório

Coleção de party games web, um por subpasta (`mimica/`, `ito/`, `batata-quente/`, ...). Cada jogo é standalone: HTML+CSS+JS puro, **sem build, sem backend, sem dependências**, pensado para um único dispositivo passado de mão em mão (pass-the-phone / hot-seat), abrindo direto no navegador ou via GitHub Pages.

`mimica/` é o jogo de referência (padrão original). `mimica/`, `ito/` e `batata-quente/` já estão implementados e completos — todo jogo novo deve seguir exatamente o mesmo padrão de arquitetura a menos que o usuário peça algo diferente.

## Hub (index.html na raiz)

O `index.html` na raiz lista todo jogo em `<a class="game" href="<pasta>/">`. Todo jogo novo deve: (1) ganhar uma entrada lá, e (2) ter no topo da tela inicial (`#setup`) um link `<a class="backHub" href="../">← Escolher outro jogo</a>`, com a classe `.backHub` replicada no `style.css` do próprio jogo — **não existe CSS/JS compartilhado entre jogos**, cada pasta duplica suas próprias regras (consistente com "sem dependências").

## Comandos

Cada jogo tem seus próprios comandos, executados dentro da sua pasta:

```bash
cd mimica          # ou a pasta do jogo em questão
node test.js       # roda os testes: imprime "OK" ou quebra com stack trace no assert que falhou
```

Não há testes automatizados de UI — verificação manual é feita abrindo `index.html` direto no navegador (file://) ou com `npx serve` / Live Server.

Pra pular direto pra uma tela sem jogar a partida inteira: no console do navegador, `state.screen = 'nomeDaTela'; render();` funciona em qualquer um dos jogos, porque `state`/`render` são globais do script clássico (não é module).

Não há linter, formatter, bundler ou `package.json` configurados em nenhum jogo — não introduza nenhum sem necessidade explícita.

## Grafo de conhecimento (graphify)

Este repo tem um grafo de conhecimento gerado pela skill `graphify` em `graphify-out/` (gitignored, gerado localmente — não existe até alguém rodar `/graphify`). Se `graphify-out/graph.json` existir, prefira `/graphify query "<pergunta>"` a explorar o código manualmente arquivo por arquivo para perguntas sobre arquitetura, convenções cross-game ou como um jogo se relaciona com outro — é mais rápido e já mapeia as relações entre `CLAUDE.md`, os `docs/PLANO.md` de cada jogo e o código. Se `graph.json` não existir ou estiver desatualizado após mudanças grandes, rode `/graphify --update` antes de confiar nele.

## Arquitetura de cada jogo (padrão estabelecido por `mimica/`)

Todo jogo novo deve seguir esta mesma separação de arquivos:

```
<jogo>/
  index.html      # todas as telas como <section hidden>, uma visível por vez (troca via JS, sem router)
  style.css       # mobile-first, botões grandes (min-height ~64px), texto grande (clamp), sem framework
  <dados>.js       # dados estáticos do jogo (ex.: words.js), const global
  game.js         # regras puras: só funções sobre um objeto `state`, ZERO DOM
  app.js          # DOM: render(), event handlers, timer, wake lock — chama as funções de game.js
  test.js         # asserts do node puro sobre game.js (sem framework de teste)
  docs/PLANO.md   # plano de implementação: regras fechadas com o usuário, arquitetura, passos, "fora de escopo"
```

**Por que a lógica fica isolada em `game.js` sem DOM**: é o que permite `node test.js` testar as regras do jogo sem precisar de jsdom/browser. `game.js` termina sempre com:

```js
if (typeof module !== 'undefined') module.exports = { ...funções... };
```

Isso faz o mesmo arquivo funcionar tanto carregado via `<script>` no navegador quanto via `require()` no Node.

**Padrão de estado**: um único objeto `state` mutável com um campo `screen` (string) que determina qual `<section>` aparece. Funções de `game.js` recebem `state`, mutam e retornam o mesmo objeto — sem classes, sem imutabilidade, sem gerenciador de estado. `app.js` tem uma função `render()` que esconde todas as `<section>` e mostra só a de `state.screen`, preenchendo textos por `id`.

**Timer** (quando o jogo tem cronômetro): `setInterval` recalculando a partir de um timestamp `endAt` (`Date.now() + duração`), nunca contando ticks — assim não desalinha se a aba for para segundo plano. Ao entrar na tela de jogo, tenta `navigator.wakeLock.request('screen')` dentro de `try/catch` (ignora silenciosamente se não suportado, ex. em `file://`).

**Fundo por tela**: `app.js` seta `document.body.dataset.screen = state.screen` dentro de `render()`; `style.css` define `body[data-screen="x"] { background: radial-gradient(...), var(--bg-void); }` por tela, reaproveitando as cores que já existem em `:root` (não inventa paleta nova). Se a tela inicial aparece antes do primeiro `render()` (ex.: `setup` antes do primeiro clique), o `<body data-screen="setup">` precisa vir hardcoded no HTML.

## Convenções de conteúdo

- Todo texto de UI e dados (palavras, cartas, categorias) em **PT-BR**.
- `docs/PLANO.md` de cada jogo documenta decisões fechadas com o usuário (regras do jogo, pontuação, número de rodadas) e uma seção explícita de "fora de escopo (YAGNI)" — consulte o de `mimica/` como modelo antes de propor features não pedidas.
- Comentários `// ponytail: ...` marcam simplificações deliberadas com o teto conhecido (ex.: pool de palavras que se esgota após N rodadas) — preserve esse estilo em vez de "corrigir" com abstrações não pedidas.
