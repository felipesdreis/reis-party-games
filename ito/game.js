// Regras puras do jogo. Sem DOM. Carregado via <script> no navegador e via require no test.js.
const MAX_PLAYERS = 12;
const MIN_PLAYERS = 3;

function newGame() {
  return {
    mode: 'local',   // 'local' | 'qr'
    players: [],     // nomes; índice = id do jogador
    theme: null,     // { label, low, high }
    seed: '',        // 4 chars base36; entra no QR
    secrets: [],     // secrets[i] = número de players[i], únicos em 1..100
    revealIdx: 0,
    revealed: false,
    order: [],       // índices na ordem escolhida (menor → maior)
    guest: null,     // modo convidado: { who, shown }
    screen: 'setup',
  };
}

function setMode(state, mode) { state.mode = mode; return state; }

function addPlayer(state, name) {
  name = (name || '').trim();
  if (name && !state.players.includes(name) && state.players.length < MAX_PLAYERS) state.players.push(name);
  return state;
}

function removePlayer(state, i) { state.players.splice(i, 1); return state; }

function startGame(state) {
  if (state.players.length >= MIN_PLAYERS) state.screen = 'theme';
  return state;
}

function setTheme(state, theme) { state.theme = theme; return state; }

// ponytail: pode repetir tema entre rodadas; sem `used`
function randomTheme(themes, rand = Math.random) {
  return themes[Math.floor(rand() * themes.length)];
}

// mulberry32: string → () => [0,1) determinístico
function rng(seed) {
  let a = 0;
  for (const ch of String(seed)) a = Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newSeed() {
  return (Math.random().toString(36).slice(2, 6) + '0000').slice(0, 4);
}

// Fisher-Yates em [1..100] com rng(seed); devolve os n primeiros. Mesma seed → mesma lista.
function drawNumbers(n, seed) {
  const r = rng(seed);
  const pool = Array.from({ length: 100 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function startRound(state) {
  if (!state.theme) return state;
  state.seed = newSeed();
  state.secrets = drawNumbers(state.players.length, state.seed);
  state.revealIdx = 0;
  state.revealed = false;
  state.order = [];
  state.screen = state.mode === 'qr' ? 'share' : 'reveal';
  return state;
}

function show(state) { state.revealed = true; return state; }

function hide(state) {
  state.revealed = false;
  state.revealIdx++;
  if (state.revealIdx >= state.players.length) state.screen = 'discuss';
  return state;
}

// ponytail: encodeURIComponent triplica acentos (~400 chars com 12 nomes); se o QR ficar difícil de ler, trocar por base64 de UTF-8
function encodeRound(state) {
  return [state.seed, state.theme.label, state.theme.low, state.theme.high, ...state.players]
    .map(encodeURIComponent).join('|');
}

function decodeRound(hash) {
  const parts = (hash || '').split('|');
  if (parts.length < 7) return null;
  try {
    const [seed, label, low, high, ...players] = parts.map(decodeURIComponent);
    return { seed, theme: { label, low, high }, players };
  } catch (e) { return null; }
}

function loadGuest(state, hash) {
  const round = decodeRound(hash);
  if (!round) return state;
  state.seed = round.seed;
  state.theme = round.theme;
  state.players = round.players;
  state.secrets = drawNumbers(round.players.length, round.seed);
  state.guest = { who: null, shown: false };
  state.screen = 'guest';
  return state;
}

function pickGuest(state, i) { state.guest = { who: i, shown: false }; return state; }

function toDiscuss(state) { state.screen = 'discuss'; return state; }
// Fila começa na ordem de cadastro; o grupo arrasta para reordenar.
function toArrange(state) {
  state.order = state.players.map((_, i) => i);
  state.screen = 'arrange';
  return state;
}

// Move o item da posição `from` para `to` (posições na fila).
function move(state, from, to) {
  const n = state.order.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return state;
  const [p] = state.order.splice(from, 1);
  state.order.splice(to, 0, p);
  return state;
}

function submitOrder(state) {
  if (state.order.length === state.players.length) state.screen = 'result';
  return state;
}

function pairsOk(state) {
  return state.order.slice(0, -1).map((p, k) => state.secrets[p] < state.secrets[state.order[k + 1]]);
}

function errors(state) { return pairsOk(state).filter(ok => !ok).length; }

function newRound(state) {
  state.theme = null;
  state.screen = 'theme';
  return state;
}

if (typeof module !== 'undefined') module.exports = {
  newGame, setMode, addPlayer, removePlayer, startGame, setTheme, randomTheme, rng, newSeed, drawNumbers,
  startRound, show, hide, encodeRound, decodeRound, loadGuest, pickGuest, toDiscuss, toArrange,
  move, submitOrder, pairsOk, errors, newRound,
};
