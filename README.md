# Party Games

Coleção de party games web, um por subpasta. Cada jogo é HTML+CSS+JS puro — sem build, sem backend, sem dependências — pensado para pass-the-phone (hot-seat) num único celular.

`index.html` na raiz é um hub que linka pros jogos.

## Jogos

- [`mimica/`](mimica/) — pronto.
- [`ito/`](ito/) — pronto.
- [`batata-quente/`](batata-quente/) — pronto.
- [`hot-seat/`](hot-seat/) — pronto.

## Rodar localmente

Abra o `index.html` do jogo direto no navegador, ou:

```bash
npx serve
```

## Testar

Cada jogo tem seu próprio `test.js`:

```bash
cd mimica
node test.js
```

## Deploy

Estático puro — a raiz do repo é servida como um projeto único (GitHub Pages ou Vercel, sem build command). Cada subpasta vira um caminho: `/mimica`, `/ito`, `/batata-quente`, `/hot-seat`.

Ver `CLAUDE.md` para as convenções de arquitetura de cada jogo.
