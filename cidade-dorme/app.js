// DOM e handlers. As regras estão em game.js. Sem timer, sem wake lock (a spec não pede).
let state = newGame();
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const avatar = (i, cls = '') => `<span class="avatar ${cls}" data-c="${i % 3}">${esc(state.players[i].slice(0, 2).toUpperCase())}</span>`;
const grid = indices => indices.map(i => `<button type="button" data-i="${i}">${avatar(i)}${esc(state.players[i])}</button>`).join('');

const MODE_HINT = {
  local: 'Um celular passa de mão em mão para revelar os papéis.',
  qr: 'Cada pessoa escaneia um QR code e vê seu papel no próprio celular.',
};

const ROLE_INFO = {
  mafioso: { emoji: '🔪', title: 'Você é Mafioso.' },
  medico: { emoji: '💉', title: 'Você é o Médico.', desc: 'Toda noite pode proteger alguém, inclusive você mesmo.' },
  investigador: { emoji: '🔍', title: 'Você é o Investigador.', desc: 'Toda noite pode investigar alguém.' },
  cidadao: { emoji: '🙂', title: 'Você é um Cidadão Comum.', desc: 'Ajude a descobrir quem é da Máfia.' },
};
const ROLE_LABEL = { mafioso: 'Mafioso', medico: 'Médico', investigador: 'Investigador', cidadao: 'Cidadão Comum' };

// Ordem da noite: médico → investigador → máfia (a máfia decide por último). Cada linha é
// autossuficiente — não referencia o papel anterior "voltando a dormir", porque esse papel
// pode ter sido pulado (morto) e a frase ficaria errada.
const NIGHT_SCRIPT = {
  medico: 'A cidade inteira dorme... Todos fechem os olhos. Médico, acorde e aponte para quem você quer proteger esta noite.',
  investigador: 'Investigador, acorde e aponte para alguém que você quer investigar.',
  mafia: 'Máfia, acordem em silêncio e apontem para a vítima desta noite.',
};

// Card de papel reaproveitado na revelação local (revealCard) e no convidado (guestCard).
function roleCardHtml(i) {
  const role = state.roles[i];
  const info = ROLE_INFO[role];
  let desc = info.desc || '';
  if (role === 'mafioso') {
    const partner = partnerOf(state.roles, i);
    desc = `Seu parceiro é: <b>${esc(state.players[partner])}</b>.`;
  }
  return `<div class="roleCard" data-role="${role}">
    <div class="roleEmoji">${info.emoji}</div>
    <h2>${esc(info.title)}</h2>
    <p>${desc}</p>
  </div>`;
}

function render() {
  document.querySelectorAll('section').forEach(sec => { sec.hidden = sec.id !== state.screen; });
  document.body.dataset.screen = state.screen;
  const n = state.players.length;
  switch (state.screen) {
    case 'setup':
      document.querySelectorAll('.toggle button').forEach(b => b.classList.toggle('sel', b.dataset.mode === state.mode));
      $('modeHint').textContent = MODE_HINT[state.mode];
      $('chips').innerHTML = state.players.map((p, i) =>
        `<span class="chip" data-c="${i % 3}">${avatar(i)}${esc(p)}<button class="x" data-i="${i}" aria-label="Remover ${esc(p)}">✕</button></span>`).join('');
      $('playerCount').textContent = n < MIN_PLAYERS ? `Mínimo 6 jogadores (${n}/6)` : `${n} jogadores`;
      $('playerCount').classList.toggle('warn', n < MIN_PLAYERS);
      $('btnStart').disabled = n < MIN_PLAYERS;
      break;

    case 'reveal': {
      const who = state.players[state.revealIdx];
      $('progressSeg').innerHTML = state.players.map((_, i) => `<i class="${i < state.revealIdx ? 'done' : ''}"></i>`).join('');
      $('revealLocked').hidden = state.revealed;
      $('revealOpen').hidden = !state.revealed;
      $('revealAvatar').textContent = who.slice(0, 2).toUpperCase();
      $('revealAvatar').dataset.c = state.revealIdx % 3;
      $('revealName').textContent = who;
      $('revealCard').innerHTML = state.revealed ? roleCardHtml(state.revealIdx) : '';
      break;
    }

    case 'share':
      $('fileWarn').hidden = location.protocol !== 'file:';
      drawQr(roundUrl());
      break;

    case 'guest': {
      const gst = state.guest;
      $('guestWho').hidden = gst.who !== null;
      $('guestNames').innerHTML = state.players.map((p, i) => `<button type="button" data-i="${i}">${avatar(i)}${esc(p)}</button>`).join('');
      $('guestConfirm').hidden = gst.who === null || gst.shown;
      $('guestOpen').hidden = gst.who === null || !gst.shown;
      if (gst.who !== null) {
        $('guestAsk').textContent = `Você é ${state.players[gst.who]}?`;
        $('guestCard').innerHTML = gst.shown ? roleCardHtml(gst.who) : '';
      }
      break;
    }

    case 'night': {
      $('nightNum').textContent = state.night;
      $('nightScript').textContent = NIGHT_SCRIPT[state.phase];
      const showResult = state.phase === 'investigador' && state.investigadorTarget !== null;
      $('nightGrid').hidden = showResult;
      $('nightResultCard').hidden = !showResult;
      if (showResult) {
        $('nightResultText').textContent = state.investigadorResult
          ? '🟢 Pessoa importante — dê um joinha discreto pro investigador'
          : '⚪ Pessoa comum — não sinalize nada';
        $('nightResultCard').dataset.positive = state.investigadorResult;
      } else {
        const choices = state.phase === 'mafia' ? mafiaTargetChoices(state) : aliveIndices(state);
        $('nightGrid').innerHTML = grid(choices);
      }
      break;
    }

    case 'nightResult':
      $('nightResultInfo').innerHTML = state.lastDeath !== null
        ? `<p><b>${esc(state.players[state.lastDeath])}</b> foi encontrado morto. Era <b>${ROLE_LABEL[state.roles[state.lastDeath]]}</b>.</p>`
        : `<p>Ninguém morreu esta noite — parece que alguém foi salvo.</p>`;
      break;

    case 'day':
      $('dayGrid').innerHTML = grid(aliveIndices(state));
      break;

    case 'dayResult':
      $('dayResultInfo').innerHTML = state.lastEliminated !== null
        ? `<p><b>${esc(state.players[state.lastEliminated])}</b> foi expulso pela cidade. Era <b>${ROLE_LABEL[state.roles[state.lastEliminated]]}</b>.</p>`
        : `<p>A cidade não chegou a um consenso — ninguém foi expulso.</p>`;
      break;

    case 'gameOver': {
      const w = winner(state);
      $('gameOverCard').className = 'card ' + (w === 'mafia' ? 'bad' : 'ok');
      $('gameOverTitle').textContent = w === 'mafia' ? '🔪 A Máfia venceu!' : '🏘️ A Cidade venceu!';
      $('gameOverList').innerHTML = state.players.map((p, i) =>
        `<div class="qrow">${avatar(i)}<span>${esc(p)}</span><b>${ROLE_LABEL[state.roles[i]]}</b></div>`).join('');
      break;
    }
  }
}

function roundUrl() { return location.origin + location.pathname + '#' + encodeRound(state); }

function drawQr(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4 });
}

// setup
document.querySelector('.toggle').onclick = e => { if (e.target.dataset.mode) { setMode(state, e.target.dataset.mode); render(); } };
const addName = () => { addPlayer(state, $('nameInput').value); $('nameInput').value = ''; render(); $('nameInput').focus(); };
$('btnAdd').onclick = addName;
$('nameInput').onkeydown = e => { if (e.key === 'Enter') addName(); };
$('chips').onclick = e => { const b = e.target.closest('.x'); if (b) { removePlayer(state, +b.dataset.i); render(); } };
$('btnStart').onclick = () => { startGame(state); render(); };

// reveal (local)
$('btnShow').onclick = () => { show(state); render(); };
$('btnHide').onclick = () => { hide(state); render(); };

// share (qr)
$('btnShare').onclick = async () => {
  const url = roundUrl();
  try { await navigator.share({ url }); }
  catch (e) {
    try { await navigator.clipboard.writeText(url); $('btnShare').textContent = 'Link copiado'; } catch (e2) { prompt('Copie o link:', url); }
  }
};
$('btnAllSeen').onclick = () => { toNight(state); render(); };

// guest
$('guestNames').onclick = e => { const b = e.target.closest('button'); if (b) { pickGuest(state, +b.dataset.i); render(); } };
$('btnNotMe').onclick = () => { state.guest = { who: null, shown: false }; render(); };
$('btnMe').onclick = () => { state.guest.shown = true; render(); };

// night — host toca no nome apontado fisicamente; chooseInvestigadorTarget não troca de tela (vira card de resultado)
$('nightGrid').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = +b.dataset.i;
  if (state.phase === 'mafia') chooseMafiaTarget(state, i);
  else if (state.phase === 'medico') chooseMedicoTarget(state, i);
  else if (state.phase === 'investigador') chooseInvestigadorTarget(state, i);
  render();
};
$('btnFinishNight').onclick = () => { finishNight(state); render(); };

// nightResult
$('btnToDay').onclick = () => { toDay(state); render(); };

// day
$('dayGrid').onclick = e => { const b = e.target.closest('button'); if (b) { eliminateDay(state, +b.dataset.i); render(); } };
$('btnNoOne').onclick = () => { eliminateDay(state, null); render(); };

// dayResult
$('btnNextNight').onclick = () => { toNextNight(state); render(); };

// gameOver — "Jogar de novo" preserva os jogadores já cadastrados (spec: chips editáveis, como no setup do ito)
$('btnPlayAgain').onclick = () => {
  const players = state.players;
  const mode = state.mode;
  state = newGame();
  state.players = players;
  state.mode = mode;
  history.replaceState(null, '', location.pathname + location.search);
  render();
};

// convidado entra pelo hash do QR; hash inválido cai no setup
if (location.hash.length > 1) loadGuest(state, location.hash.slice(1));
render();
