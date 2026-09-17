// DOM, timer e handlers. As regras estão em game.js.
let state;
let timer;
const $ = id => document.getElementById(id);
const fmt = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
function setScore(prefix, s) {
  $(prefix + 'A').textContent = `${s.teams[0].name} ${s.teams[0].score}`;
  $(prefix + 'B').textContent = `${s.teams[1].score} ${s.teams[1].name}`;
}

function render() {
  document.querySelectorAll('section').forEach(sec => { sec.hidden = sec.id !== state.screen; });
  $('btnHome').hidden = state.screen === 'setup';
  const cur = state.teams[state.round % 2];
  const other = state.teams[(state.round + 1) % 2];
  switch (state.screen) {
    case 'handoff':
      setScore('handoffScore', state);
      $('handoffTitle').textContent = state.round < ROUNDS
        ? `Rodada ${state.round + 1} de ${ROUNDS} · Vez de ${cur.name}`
        : `Desempate · Vez de ${cur.name}`;
      $('handoffText').textContent = `Entregue o celular ao juiz de ${other.name} e chame o mímico de ${cur.name}.`;
      break;
    case 'playing': {
      const left = timeLeft(state, Date.now());
      $('timer').textContent = fmt(left);
      $('progressFill').style.width = `${(left * 1000 / ROUND_MS) * 100}%`;
      $('wordLabel').textContent = `Palavra ${state.wordIndex + 1} de 5 · vale ${state.wordIndex + 1} ponto${state.wordIndex ? 's' : ''}`;
      $('word').textContent = state.words[state.wordIndex];
      $('roundScore').textContent = `Nesta rodada: ${state.roundScore} pts`;
      break;
    }
    case 'roundEnd':
      // round já avançou em endRound; quem jogou é a equipe anterior (= other)
      $('roundEndTitle').textContent = `${other.name} fez +${state.roundScore} pontos`;
      setScore('roundEndScore', state);
      break;
    case 'gameOver':
      $('winnerTitle').textContent = `${state.teams[winner(state)].name} venceu!`;
      setScore('finalScore', state);
      break;
  }
}

function beginRound() {
  startRound(state, Date.now(), WORDS);
  clearInterval(timer);
  timer = setInterval(() => {
    if (state.screen !== 'playing') return clearInterval(timer);
    const left = timeLeft(state, Date.now());
    $('timer').textContent = fmt(left);
    $('progressFill').style.width = `${(left * 1000 / ROUND_MS) * 100}%`;
    if (left === 0) { clearInterval(timer); endRound(state); render(); }
  }, 250);
  // ponytail: wake lock só funciona em https/localhost; em file:// falha em silêncio e a tela pode apagar
  navigator.wakeLock?.request('screen').catch(() => {});
  render();
}

$('btnStart').onclick = () => { state = newGame($('nameA').value.trim(), $('nameB').value.trim()); render(); };
$('btnRound').onclick = beginRound;
$('btnHit').onclick = () => { hit(state); render(); };
$('btnSkip').onclick = () => { skip(state); render(); };
$('btnNext').onclick = () => { state.screen = 'handoff'; render(); };
$('btnAgain').onclick = () => { state.screen = 'setup'; render(); };
$('btnHome').onclick = () => {
  if (!confirm('Cancelar o jogo e voltar ao início?')) return;
  clearInterval(timer);
  state.screen = 'setup';
  render();
};
