// Regras puras do jogo. Sem DOM. Carregado via <script> no navegador e via require no test.js.

function newGame() {
  return {
    screen: 'setup',   // 'setup' | 'roundStart' | 'questionPick' | 'scoring' | 'roundEnd' | 'gameOver'
    players: [],       // nomes cadastrados no setup
    scores: {},        // nome -> pontos; preenchido no startGame
    remaining: [],      // nomes que ainda não sentaram na Hot Seat nesta "volta"
    hotSeat: null,       // nome de quem está na Hot Seat na rodada atual
    round: 0,            // 1-based
    totalRounds: 0,       // = nº de jogadores, fixado no startGame
    category: null,
    suggestions: [],      // 3 perguntas sorteadas da categoria
    question: null,        // pergunta escolhida pela Hot Seat
    usedQuestions: new Set(),   // evita repetir pergunta na mesma partida
    correctGuessers: new Set(), // nomes marcados como "acertou" antes de confirmar
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

function startGame(state, rand = Math.random) {
  if (state.players.length < 2) return state;
  state.scores = Object.fromEntries(state.players.map(n => [n, 0]));
  state.remaining = [...state.players];
  state.totalRounds = state.players.length;
  state.round = 0;
  return nextRound(state, rand);
}

function nextRound(state, rand = Math.random) {
  if (!state.remaining.length) return state;
  const i = Math.floor(rand() * state.remaining.length);
  state.hotSeat = state.remaining.splice(i, 1)[0];
  state.round++;
  state.category = null;
  state.suggestions = [];
  state.question = null;
  state.correctGuessers = new Set();
  state.screen = 'roundStart';
  return state;
}

// Sorteia 3 perguntas da categoria sem repetir as já usadas na partida.
function pickCategory(state, category, pool, rand = Math.random) {
  if (state.screen !== 'roundStart') return state;
  let available = pool[category].filter(q => !state.usedQuestions.has(q));
  if (available.length < 3) { // ponytail: categoria quase esgotada; libera as usadas dela e sorteia de novo
    pool[category].forEach(q => state.usedQuestions.delete(q));
    available = [...pool[category]];
  }
  const pickPool = [...available];
  const picked = [];
  while (picked.length < 3 && pickPool.length) {
    const i = Math.floor(rand() * pickPool.length);
    picked.push(pickPool.splice(i, 1)[0]);
  }
  state.category = category;
  state.suggestions = picked;
  state.screen = 'questionPick';
  return state;
}

function pickQuestion(state, question) {
  if (state.screen !== 'questionPick' || !state.suggestions.includes(question)) return state;
  state.question = question;
  state.usedQuestions.add(question);
  state.suggestions = [];
  state.screen = 'scoring';
  return state;
}

function toggleCorrect(state, name) {
  if (state.screen !== 'scoring' || name === state.hotSeat) return state;
  if (state.correctGuessers.has(name)) state.correctGuessers.delete(name);
  else state.correctGuessers.add(name);
  return state;
}

function confirmRound(state) {
  if (state.screen !== 'scoring') return state;
  state.correctGuessers.forEach(name => { state.scores[name]++; });
  state.correctGuessers = new Set();
  state.question = null;
  state.screen = state.remaining.length === 0 ? 'gameOver' : 'roundEnd';
  return state;
}

function ranking(state) {
  return Object.entries(state.scores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

if (typeof module !== 'undefined') {
  module.exports = {
    newGame, addPlayer, removePlayer, startGame, nextRound,
    pickCategory, pickQuestion, toggleCorrect, confirmRound, ranking,
  };
}
