// Regras puras do jogo. Sem DOM. Carregado via <script> no navegador e via require no test.js.
const MIN_DURATION = 30;
const MAX_DURATION = 120;
const JITTER = 10; // segundos de variação aleatória pra cima/baixo do tempo escolhido

function newGame() {
  return {
    screen: 'setup',   // 'setup' | 'playing' | 'exploded' | 'gameOver'
    players: [],       // nomes cadastrados no setup
    alive: [],         // nomes ainda na partida; copiado de players ao startGame
    category: '',      // categoria da rodada atual (pode trocar entre rodadas)
    duration: 45,       // segundos-alvo escolhidos pelo host (30–120); o tempo real varia ±10s (ver JITTER)
    endAt: 0,            // timestamp de quando a bomba "explode" — nunca exibido na UI
    eliminated: null,     // null = ainda não escolheram quem segurava; string = nome já escolhido
  };
}

function addPlayer(state, name) {
  name = (name || '').trim();
  if (name && !state.players.includes(name)) state.players.push(name);
  return state;
}

function removePlayer(state, i) {
  state.players.splice(i, 1);
  return state;
}

function setCategory(state, label) {
  state.category = (label || '').trim();
  return state;
}

// ponytail: pode repetir categoria entre sorteios; poucas dezenas de itens, sem controle de "usadas"
function randomCategory(categories, rand = Math.random) {
  return categories[Math.floor(rand() * categories.length)];
}

function setDuration(state, seconds) {
  if (Number.isFinite(seconds)) state.duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, seconds));
  return state;
}

// tempo real da rodada = duração escolhida ± JITTER segundos, nunca abaixo de MIN_DURATION —
// assim ninguém, nem quem programou a duração, sabe o segundo exato da explosão
function startRound(state, now, rand = Math.random) {
  const actual = Math.max(MIN_DURATION, state.duration + (rand() * 2 - 1) * JITTER);
  state.endAt = now + actual * 1000;
  state.eliminated = null;
  state.screen = 'playing';
  return state;
}

function startGame(state, now, rand = Math.random) {
  if (state.players.length >= 2 && state.category) {
    state.alive = [...state.players];
    startRound(state, now, rand);
  }
  return state;
}

function timeLeft(state, now) {
  return Math.max(0, Math.ceil((state.endAt - now) / 1000));
}

function explode(state) {
  if (state.screen !== 'playing') return state;
  state.screen = 'exploded';
  return state;
}

function isOver(state) {
  return state.alive.length <= 1;
}

function winner(state) {
  return state.alive[0];
}

function eliminate(state, name) {
  if (state.screen !== 'exploded' || state.eliminated !== null) return state;
  const i = state.alive.indexOf(name);
  if (i === -1) return state;
  state.alive.splice(i, 1);
  state.eliminated = name;
  if (isOver(state)) state.screen = 'gameOver';
  return state;
}

function nextRound(state, now, rand = Math.random) {
  if (state.screen !== 'exploded' || isOver(state)) return state;
  return startRound(state, now, rand);
}

if (typeof module !== 'undefined') {
  module.exports = {
    MIN_DURATION, MAX_DURATION, JITTER, newGame, addPlayer, removePlayer, setCategory, randomCategory,
    setDuration, startRound, startGame, timeLeft, explode, isOver, winner, eliminate, nextRound,
  };
}
