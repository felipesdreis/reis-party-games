// Regras puras do jogo. Sem DOM. Carregado via <script> no navegador e via require no test.js.
const ROUNDS = 8;      // 4 por equipe, alternadas
const ROUND_MS = 120000;
const WORDS_PER_ROUND = 5;

function newGame(nameA, nameB) {
  return {
    teams: [{ name: nameA || 'Equipe A', score: 0 }, { name: nameB || 'Equipe B', score: 0 }],
    round: 0,          // equipe da vez = round % 2
    words: [],
    wordIndex: 0,      // vale wordIndex + 1 pontos
    roundScore: 0,
    endAt: 0,
    used: new Set(),
    screen: 'handoff',
  };
}

// Sorteia 1 palavra de cada nível 1..5 sem repetir na partida.
function drawWords(used, words) {
  return [1, 2, 3, 4, 5].map(level => {
    let pool = words[level].filter(w => !used.has(w));
    if (!pool.length) { // ponytail: nível esgotou (>1000 rodadas); libera as usadas dele e segue
      words[level].forEach(w => used.delete(w));
      pool = words[level];
    }
    const w = pool[Math.floor(Math.random() * pool.length)];
    used.add(w);
    return w;
  });
}

function startRound(state, now, words) {
  state.words = drawWords(state.used, words);
  state.wordIndex = 0;
  state.roundScore = 0;
  state.endAt = now + ROUND_MS;
  state.screen = 'playing';
  return state;
}

function advance(state) {
  state.wordIndex++;
  if (state.wordIndex >= WORDS_PER_ROUND) endRound(state);
  return state;
}

function hit(state) {
  if (state.screen !== 'playing') return state;
  const pts = state.wordIndex + 1;
  state.roundScore += pts;
  state.teams[state.round % 2].score += pts;
  return advance(state);
}

function skip(state) {
  if (state.screen !== 'playing') return state;
  return advance(state);
}

function endRound(state) {
  state.round++;
  state.screen = isOver(state) ? 'gameOver' : 'roundEnd';
  return state;
}

// Jogo acabou? Precisa cobrir: as 8 rodadas normais E o desempate em pares
// (se empatar após a 8ª, cada equipe joga mais uma; repete até desempatar).
// `state.round` já foi incrementado quando isOver é chamado (é o nº de rodadas concluídas).
function isOver(state) {
  return state.round >= ROUNDS && state.round % 2 === 0 && state.teams[0].score !== state.teams[1].score;
}

function winner(state) {
  return state.teams[0].score > state.teams[1].score ? 0 : 1;
}

function timeLeft(state, now) {
  return Math.max(0, Math.ceil((state.endAt - now) / 1000));
}

if (typeof module !== 'undefined') {
  module.exports = { ROUNDS, newGame, drawWords, startRound, hit, skip, endRound, isOver, winner, timeLeft };
}
