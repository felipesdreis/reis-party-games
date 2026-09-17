// DOM, timer e efeitos de explosão. As regras estão em game.js.
let state = newGame();
let timer;
let audioCtx;
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// mesma grid de categorias é usada no setup e na tela de "quem estava segurando" (próxima rodada)
function renderCategoryPicker(container, current) {
  container.innerHTML = CATEGORIES.map(c =>
    `<button type="button" class="cat${c === current ? ' sel' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
}
function wireCategoryPicker(pickerEl, randomBtn, customInput) {
  pickerEl.onclick = e => {
    const b = e.target.closest('.cat');
    if (!b) return;
    setCategory(state, b.dataset.cat);
    customInput.value = '';
    render();
  };
  randomBtn.onclick = () => { setCategory(state, randomCategory(CATEGORIES)); customInput.value = ''; render(); };
  customInput.oninput = e => { setCategory(state, e.target.value); render(); };
}

const CONFETTI_EMOJI = ['🎉', '🎊', '✨', '🥳', '🎆'];
function renderConfetti() {
  $('confetti').innerHTML = Array.from({ length: 24 }, () => {
    const emoji = CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)];
    const left = Math.random() * 100;
    const duration = (4 + Math.random() * 3).toFixed(2);
    const delay = (-Math.random() * 4).toFixed(2); // negativo: já entra em voo, sem todo mundo nascendo junto
    return `<span style="left:${left}%;animation-duration:${duration}s;animation-delay:${delay}s">${emoji}</span>`;
  }).join('');
}

function render() {
  document.querySelectorAll('section').forEach(sec => { sec.hidden = sec.id !== state.screen; });
  $('btnHome').hidden = state.screen === 'setup';
  document.body.dataset.screen = state.screen;
  switch (state.screen) {
    case 'setup': {
      $('chips').innerHTML = state.players.map((p, i) =>
        `<span class="chip">${esc(p)}<button class="x" data-i="${i}" aria-label="Remover ${esc(p)}">✕</button></span>`).join('');
      const n = state.players.length;
      $('playerCount').textContent = n < 2 ? `Adicione pelo menos 2 jogadores (${n}/2)` : `${n} jogadores`;
      renderCategoryPicker($('categoryPicker'), state.category);
      $('durationLabel').textContent = `${state.duration}s`;
      $('duration').value = state.duration;
      $('btnStart').disabled = n < 2 || !state.category;
      break;
    }
    case 'playing':
      $('categoryLabel').textContent = state.category;
      break;
    case 'exploded': {
      const picking = state.eliminated === null;
      $('explodedPick').hidden = !picking;
      $('explodedConfirm').hidden = picking;
      if (picking) {
        $('alivePicker').innerHTML = state.alive.map(name =>
          `<button type="button" data-name="${esc(name)}">${esc(name)}</button>`).join('');
      } else {
        $('eliminatedTitle').textContent = `${state.eliminated} foi eliminado!`;
        $('aliveCount').textContent = `Restam ${state.alive.length} jogador${state.alive.length > 1 ? 'es' : ''}: ${state.alive.join(', ')}`;
        renderCategoryPicker($('categoryPickerNext'), state.category);
      }
      break;
    }
    case 'gameOver':
      $('winnerTitle').textContent = `${winner(state)} venceu!`;
      renderConfetti();
      break;
  }
}

// beep curto sintetizado via Web Audio API, sem depender de nenhum arquivo de áudio
function playBeep() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

function triggerExplosionEffects() {
  navigator.vibrate?.([200, 100, 200, 100, 400]);
  document.body.classList.add('boom');
  setTimeout(() => document.body.classList.remove('boom'), 1300);
  try { playBeep(); } catch (e) {}
}

// liga o intervalo que só fica de olho em timeLeft === 0 — nunca escreve o número na tela
function armTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (state.screen !== 'playing') return clearInterval(timer);
    if (timeLeft(state, Date.now()) === 0) {
      clearInterval(timer);
      explode(state);
      triggerExplosionEffects();
      render();
    }
  }, 250);
  // ponytail: wake lock só funciona em https/localhost; em file:// falha em silêncio e a tela pode apagar
  navigator.wakeLock?.request('screen').catch(() => {});
}

function goSetup() {
  clearInterval(timer);
  state = newGame();
  $('confetti').innerHTML = '';
  render();
}

// setup
const addName = () => { addPlayer(state, $('nameInput').value); $('nameInput').value = ''; render(); $('nameInput').focus(); };
$('btnAdd').onclick = addName;
$('nameInput').onkeydown = e => { if (e.key === 'Enter') addName(); };
$('chips').onclick = e => { const b = e.target.closest('.x'); if (b) { removePlayer(state, +b.dataset.i); render(); } };
wireCategoryPicker($('categoryPicker'), $('btnRandomCategory'), $('customCategory'));
$('duration').oninput = e => { setDuration(state, +e.target.value); render(); };
$('btnStart').onclick = () => { startGame(state, Date.now()); armTimer(); render(); };

// exploded: escolher quem estava segurando
$('alivePicker').onclick = e => { const b = e.target.closest('button'); if (b) { eliminate(state, b.dataset.name); render(); } };

// exploded: trocar categoria (opcional) e seguir pra próxima rodada
wireCategoryPicker($('categoryPickerNext'), $('btnRandomCategoryNext'), $('customCategoryNext'));
$('btnNextRound').onclick = () => { nextRound(state, Date.now()); armTimer(); render(); };

// gameOver / cancelar
$('btnAgain').onclick = goSetup;
$('btnHome').onclick = () => { if (confirm('Cancelar o jogo e voltar ao início?')) goSetup(); };

render();
