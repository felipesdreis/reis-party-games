// Regras puras do jogo. Sem DOM. Carregado via <script> no navegador e via require no test.js.
const MIN_PLAYERS = 6;

function newGame() {
  return {
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
}

function setMode(state, mode) { state.mode = mode; return state; }

function addPlayer(state, name) {
  name = (name || '').trim();
  if (name && !state.players.includes(name)) state.players.push(name);
  return state;
}

function removePlayer(state, i) { state.players.splice(i, 1); return state; }

// mulberry32: string → () => [0,1) determinístico (copiado do ito)
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

// Pool fixo (2 mafioso, 1 medico, 1 investigador, resto cidadao) embaralhado (Fisher-Yates) com rng(seed).
// Determinístico: mesma seed + mesmo n → mesmos papéis, em qualquer celular.
function assignRoles(n, seed) {
  if (n < MIN_PLAYERS) throw new Error('assignRoles exige n >= ' + MIN_PLAYERS);
  const pool = ['mafioso', 'mafioso', 'medico', 'investigador', ...Array(n - 4).fill('cidadao')];
  const r = rng(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// Índice do outro jogador com role === 'mafioso' (usado na tela de reveal, pro mafioso ver o parceiro).
function partnerOf(roles, i) {
  return roles.findIndex((role, idx) => idx !== i && role === 'mafioso');
}

function startGame(state) {
  const n = state.players.length;
  if (n < MIN_PLAYERS) return state;
  state.seed = newSeed();
  state.roles = assignRoles(n, state.seed);
  state.alive = Array(n).fill(true);
  state.night = 0;
  state.revealIdx = 0;
  state.revealed = false;
  state.screen = state.mode === 'qr' ? 'share' : 'reveal';
  return state;
}

function show(state) { state.revealed = true; return state; }

// Modo local, igual ito: hide zera e passa pro próximo; depois do último jogador,
// vai direto pra night (sem tela intermediária de "todos viram").
function hide(state) {
  state.revealed = false;
  state.revealIdx++;
  if (state.revealIdx >= state.players.length) startNight(state);
  return state;
}

// ponytail: sem tema (mais simples que o do ito) — só seed + nomes
function encodeRound(state) {
  return [state.seed, ...state.players].map(encodeURIComponent).join('|');
}

function decodeRound(hash) {
  const parts = (hash || '').split('|');
  if (parts.length < 7) return null; // semente + ao menos 6 nomes
  try {
    const [seed, ...players] = parts.map(decodeURIComponent);
    return { seed, players };
  } catch (e) { return null; }
}

function loadGuest(state, hash) {
  const round = decodeRound(hash);
  if (!round) return state;
  state.seed = round.seed;
  state.players = round.players;
  state.roles = assignRoles(round.players.length, round.seed);
  state.alive = Array(round.players.length).fill(true);
  state.guest = { who: null, shown: false };
  state.screen = 'guest';
  return state;
}

function pickGuest(state, i) { state.guest = { who: i, shown: false }; return state; }

// Handler do botão "Todos viram, continuar" no modo QR (equivalente ao toDiscuss do ito).
function toNight(state) { startNight(state); return state; }

function roleAlive(state, role) {
  return state.alive.some((alive, i) => alive && state.roles[i] === role);
}

// Ordem da noite: médico → investigador → máfia (a máfia decide por último, sem saber o
// que os outros dois fizeram). Papel especial morto não tem ninguém pra acordar — a fase
// dele é pulada. A máfia sempre acontece (o jogo já acaba se ela for zerada, ver isOver).
function afterMedicoPhase(state) { return roleAlive(state, 'investigador') ? 'investigador' : 'mafia'; }
function firstNightPhase(state) { return roleAlive(state, 'medico') ? 'medico' : afterMedicoPhase(state); }

function startNight(state) {
  state.night++;
  state.mafiaTarget = null;
  state.medicoTarget = null;
  state.investigadorTarget = null;
  state.investigadorResult = null;
  state.lastDeath = null;
  state.phase = firstNightPhase(state);
  state.screen = 'night';
  return state;
}

function chooseMedicoTarget(state, i) {
  if (state.phase !== 'medico') return state;
  state.medicoTarget = i;
  state.phase = afterMedicoPhase(state);
  return state;
}

// Não muda de tela — continua em night/investigador, só troca a grade pelo card de resultado
// (mesmo truque do `exploded` no batata-quente, via investigadorTarget !== null).
function chooseInvestigadorTarget(state, i) {
  if (state.phase !== 'investigador' || state.investigadorTarget !== null) return state;
  state.investigadorTarget = i;
  state.investigadorResult = state.roles[i] === 'mafioso' || state.roles[i] === 'medico';
  return state;
}

// Handler do botão "Investigador dormiu, continuar" — só aparece depois de chooseInvestigadorTarget.
// Avança pra fase da máfia, a última da noite.
function finishNight(state) {
  if (state.phase !== 'investigador' || state.investigadorTarget === null) return state;
  state.phase = 'mafia';
  return state;
}

// Máfia é a última fase: escolher a vítima já resolve a noite na hora, sem passo extra.
function chooseMafiaTarget(state, i) {
  if (state.phase !== 'mafia') return state;
  state.mafiaTarget = i;
  resolveNight(state);
  state.screen = 'nightResult';
  return state;
}

// Interno a chooseMafiaTarget: mesmo alvo do médico e da máfia → salvo; senão a vítima morre.
function resolveNight(state) {
  if (state.medicoTarget === state.mafiaTarget) {
    state.lastDeath = null;
  } else {
    state.alive[state.mafiaTarget] = false;
    state.lastDeath = state.mafiaTarget;
  }
  return state;
}

function toDay(state) {
  state.screen = isOver(state) ? 'gameOver' : 'day';
  return state;
}

function eliminateDay(state, i) {
  if (i !== null) state.alive[i] = false;
  state.lastEliminated = i;
  state.screen = 'dayResult';
  return state;
}

function toNextNight(state) {
  if (isOver(state)) state.screen = 'gameOver';
  else startNight(state);
  return state;
}

function aliveIndices(state) {
  return state.alive.reduce((acc, alive, i) => { if (alive) acc.push(i); return acc; }, []);
}

// aliveIndices excluindo os próprios mafiosos (não se matam entre si).
function mafiaTargetChoices(state) {
  return aliveIndices(state).filter(i => state.roles[i] !== 'mafioso');
}

function mafiaAliveCount(state) {
  return state.alive.filter((alive, i) => alive && state.roles[i] === 'mafioso').length;
}

function othersAliveCount(state) {
  return state.alive.filter((alive, i) => alive && state.roles[i] !== 'mafioso').length;
}

function isOver(state) {
  const mafiaAlive = mafiaAliveCount(state);
  return mafiaAlive > othersAliveCount(state) || mafiaAlive === 0;
}

function winner(state) {
  return mafiaAliveCount(state) === 0 ? 'cidade' : 'mafia';
}

if (typeof module !== 'undefined') module.exports = {
  MIN_PLAYERS, newGame, setMode, addPlayer, removePlayer, rng, newSeed, assignRoles, partnerOf,
  startGame, show, hide, encodeRound, decodeRound, loadGuest, pickGuest, toNight, startNight,
  chooseMafiaTarget, chooseMedicoTarget, chooseInvestigadorTarget, resolveNight, finishNight,
  toDay, eliminateDay, toNextNight, aliveIndices, mafiaTargetChoices, isOver, winner,
};
