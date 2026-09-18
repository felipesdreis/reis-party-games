// DOM e handlers. As regras estão em game.js.
let state = newGame();
let lastRoundCorrect = []; // nomes marcados na rodada que acabou de ser confirmada (só pra exibir o resumo)
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CATEGORY_LABELS = { leves: 'Leves', engracadas: 'Engraçadas', bizarras: 'Bizarras', desafiadoras: 'Desafiadoras' };

function render() {
  document.querySelectorAll('section').forEach(sec => { sec.hidden = sec.id !== state.screen; });
  document.body.dataset.screen = state.screen;

  switch (state.screen) {
    case 'setup': {
      $('chips').innerHTML = state.players.map((p, i) =>
        `<span class="chip">${esc(p)}<button class="x" data-i="${i}" aria-label="Remover ${esc(p)}">✕</button></span>`).join('');
      const n = state.players.length;
      $('playerCount').textContent = n < 2 ? `Adicione pelo menos 2 jogadores (${n}/2)` : `${n} jogadores`;
      $('btnStart').disabled = n < 2;
      break;
    }
    case 'roundStart':
      $('roundLabel').textContent = `Rodada ${state.round} de ${state.totalRounds}`;
      $('hotSeatLabel').textContent = `${state.hotSeat} vai pra Hot Seat!`;
      break;
    case 'questionPick':
      $('questionPickLabel').textContent = CATEGORY_LABELS[state.category];
      $('questionChoices').innerHTML = state.suggestions.map(q =>
        `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
      break;
    case 'scoring':
      $('scoringQuestion').textContent = state.question;
      $('scoringPlayers').innerHTML = state.players
        .filter(p => p !== state.hotSeat)
        .map(p => `<button type="button" class="cat${state.correctGuessers.has(p) ? ' sel' : ''}" data-name="${esc(p)}">${esc(p)}${state.correctGuessers.has(p) ? ' ✓' : ''}</button>`)
        .join('');
      break;
    case 'roundEnd':
      $('roundSummary').textContent = lastRoundCorrect.length
        ? `+1 ponto: ${lastRoundCorrect.join(', ')}`
        : 'Ninguém acertou dessa vez';
      $('scoreboard').innerHTML = state.players.map(p =>
        `<div class="chip">${esc(p)}: ${state.scores[p]}</div>`).join('');
      break;
    case 'gameOver':
      $('ranking').innerHTML = ranking(state).map((r, i) =>
        `<div class="chip">${i + 1}º ${esc(r.name)} — ${r.score} pt${r.score === 1 ? '' : 's'}</div>`).join('');
      break;
  }
}

// setup
const addName = () => { addPlayer(state, $('nameInput').value); $('nameInput').value = ''; render(); $('nameInput').focus(); };
$('btnAdd').onclick = addName;
$('nameInput').onkeydown = e => { if (e.key === 'Enter') addName(); };
$('chips').onclick = e => { const b = e.target.closest('.x'); if (b) { removePlayer(state, +b.dataset.i); render(); } };
$('btnStart').onclick = () => { startGame(state); render(); };

// roundStart: escolher categoria
document.querySelector('#roundStart .stack').onclick = e => {
  const b = e.target.closest('.cat');
  if (b) { pickCategory(state, b.dataset.cat, QUESTIONS); render(); }
};

// questionPick: escolher a pergunta
$('questionChoices').onclick = e => {
  const b = e.target.closest('button');
  if (b) { pickQuestion(state, b.dataset.q); render(); }
};

// scoring: marcar quem acertou e confirmar
$('scoringPlayers').onclick = e => {
  const b = e.target.closest('button');
  if (b) { toggleCorrect(state, b.dataset.name); render(); }
};
$('btnConfirm').onclick = () => {
  lastRoundCorrect = [...state.correctGuessers];
  confirmRound(state);
  render();
};

// roundEnd
$('btnNextRound').onclick = () => { nextRound(state); render(); };

// gameOver
$('btnAgain').onclick = () => { state = newGame(); lastRoundCorrect = []; render(); };

render();
