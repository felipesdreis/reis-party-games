// DOM e handlers. As regras estão em game.js.
let state = newGame();
let cat = THEMES[0].cat; // categoria filtrada na tela de tema (só UI)
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const avatar = (i, cls = '') => `<span class="avatar ${cls}" data-c="${i % 3}">${esc(state.players[i].slice(0, 2).toUpperCase())}</span>`;
const MODE_HINT = {
  local: 'Um celular passa de mão em mão a cada rodada.',
  qr: 'Cada pessoa escaneia um QR code e vê seu número no próprio celular.',
};

function render() {
  document.querySelectorAll('section').forEach(sec => { sec.hidden = sec.id !== state.screen; });
  $('btnHome').hidden = state.screen === 'setup' || state.screen === 'guest';
  const t = state.theme;
  const n = state.players.length;
  switch (state.screen) {
    case 'setup':
      document.querySelectorAll('.toggle button').forEach(b => b.classList.toggle('sel', b.dataset.mode === state.mode));
      $('modeHint').textContent = MODE_HINT[state.mode];
      $('chips').innerHTML = state.players.map((p, i) =>
        `<span class="chip" data-c="${i % 3}">${avatar(i)}${esc(p)}<button class="x" data-i="${i}" aria-label="Remover ${esc(p)}">✕</button></span>`).join('');
      $('playerCount').textContent = n < 3 ? `Adicione pelo menos 3 jogadores (${n}/3)` : `${n} jogadores`;
      $('playerCount').classList.toggle('warn', n < 3);
      $('btnStart').disabled = n < 3;
      break;
    case 'theme': {
      const cats = [...new Set(THEMES.map(x => x.cat))];
      $('catChips').innerHTML = cats.map(c => `<button class="cat${c === cat ? ' sel' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
      $('themeList').innerHTML = THEMES.filter(x => x.cat === cat).map(x =>
        `<button class="themeCard${t && t.label === x.label ? ' sel' : ''}" data-label="${esc(x.label)}">
          <b>${esc(x.label)}</b><small>1 · ${esc(x.low)} — ${esc(x.high)} · 100</small></button>`).join('');
      $('btnRound').disabled = !t;
      break;
    }
    case 'reveal': {
      const who = state.players[state.revealIdx];
      $('progressSeg').innerHTML = state.players.map((_, i) => `<i class="${i < state.revealIdx ? 'done' : ''}"></i>`).join('');
      $('revealTheme').textContent = t.label;
      $('revealLocked').hidden = state.revealed;
      $('revealOpen').hidden = !state.revealed;
      $('revealAvatar').textContent = who.slice(0, 2).toUpperCase();
      $('revealAvatar').dataset.c = state.revealIdx % 3;
      $('revealName').textContent = who;
      $('revealWho').textContent = `${who}, seu número é`;
      $('secret').textContent = state.secrets[state.revealIdx];
      $('revealLow').textContent = `1 · ${t.low}`;
      $('revealHigh').textContent = `${t.high} · 100`;
      break;
    }
    case 'share':
      $('shareTheme').textContent = t.label;
      $('fileWarn').hidden = location.protocol !== 'file:';
      drawQr(roundUrl());
      break;
    case 'guest': {
      const gst = state.guest;
      $('guestTheme').textContent = t.label;
      $('guestLow').textContent = `1 · ${t.low}`;
      $('guestHigh').textContent = `${t.high} · 100`;
      $('guestWho').hidden = gst.who !== null;
      $('guestConfirm').hidden = gst.who === null || gst.shown || gst.seen;
      $('guestOpen').hidden = gst.who === null || (!gst.shown && !gst.seen);
      $('guestNames').innerHTML = state.players.map((p, i) => `<button data-i="${i}">${avatar(i)}${esc(p)}</button>`).join('');
      if (gst.who !== null) {
        $('guestAsk').textContent = `Você é ${state.players[gst.who]}?`;
        $('guestName').textContent = gst.shown ? `${state.players[gst.who]}, seu número é` : `${state.players[gst.who]}, número escondido`;
        $('guestSecret').textContent = gst.shown ? state.secrets[gst.who] : '••';
        $('btnGuestToggle').textContent = gst.shown ? 'Esconder' : 'Mostrar de novo';
      }
      break;
    }
    case 'discuss':
      $('discussSub').textContent = state.mode === 'qr'
        ? 'Todo mundo já viu? Então é hora da dica.'
        : 'Todos já viram seu número. Devolvam o celular para a mesa.';
      $('discussTheme').textContent = t.label;
      $('discussLow').textContent = `1 · ${t.low}`;
      $('discussHigh').textContent = `${t.high} · 100`;
      $('discussChips').innerHTML = state.players.map((p, i) => `<span class="chip">${avatar(i)}${esc(p)}</span>`).join('');
      break;
    case 'arrange':
      // numeração 1, 2, 3… vem de um CSS counter, para não reescrever texto durante o arrasto
      $('queue').innerHTML = state.order.map(p => `<div class="qrow" data-i="${p}"><em></em>${avatar(p)}${esc(state.players[p])}<b class="handle">☰</b></div>`).join('');
      break;
    case 'result': {
      const errs = errors(state);
      const oks = pairsOk(state);
      $('resultCard').className = `card ${errs ? 'bad' : 'ok'}`;
      $('resultTitle').textContent = errs ? 'Quase lá' : '🎉 Ordem perfeita!';
      $('resultSub').textContent = errs
        ? `${errs} par${errs > 1 ? 'es' : ''} fora de ordem — vejam os ✕.`
        : 'Todo mundo acertou a leitura da mesa.';
      $('resultList').innerHTML = state.order.map((p, k) =>
        `<div class="qrow">${avatar(p)}<span>${esc(state.players[p])}</span><b class="num">${state.secrets[p]}</b></div>` +
        (k < oks.length ? `<div class="connector ${oks[k] ? 'ok' : 'bad'}">${oks[k] ? '✓ em ordem' : '✕ fora de ordem'}</div>` : '')).join('');
      break;
    }
  }
}

// ponytail: a URL base é a que o host abriu; em file:// o QR aponta para o disco do host e ninguém abre (a tela avisa)
function roundUrl() { return location.origin + location.pathname + '#' + encodeRound(state); }

function drawQr(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4 });
}

function goSetup() {
  state = newGame();
  history.replaceState(null, '', location.pathname + location.search);
  render();
}

// setup
document.querySelector('.toggle').onclick = e => { if (e.target.dataset.mode) { setMode(state, e.target.dataset.mode); render(); } };
const addName = () => { addPlayer(state, $('nameInput').value); $('nameInput').value = ''; render(); $('nameInput').focus(); };
$('btnAdd').onclick = addName;
$('nameInput').onkeydown = e => { if (e.key === 'Enter') addName(); };
$('chips').onclick = e => { const b = e.target.closest('.x'); if (b) { removePlayer(state, +b.dataset.i); render(); } };
$('btnStart').onclick = () => { startGame(state); render(); };

// theme
$('catChips').onclick = e => { const b = e.target.closest('.cat'); if (b) { cat = b.dataset.cat; render(); } };
$('themeList').onclick = e => {
  const b = e.target.closest('.themeCard');
  if (!b) return;
  setTheme(state, THEMES.find(x => x.label === b.dataset.label));
  $('customTheme').value = '';
  render();
};
$('btnRandom').onclick = () => {
  const t = randomTheme(THEMES);
  cat = t.cat;
  setTheme(state, t);
  $('customTheme').value = '';
  render();
  $('themeList').querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
};
$('customTheme').oninput = e => {
  const label = e.target.value.trim();
  setTheme(state, label ? { label, low: 'menor', high: 'maior' } : null);
  render();
};
$('btnRound').onclick = () => { startRound(state); render(); };

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
// host também joga: abre o link do QR em outra guia, onde ele entra como convidado e vê o próprio número
$('btnHostPlay').onclick = () => window.open(roundUrl(), '_blank');
$('btnAllSeen').onclick = () => { toDiscuss(state); render(); };

// guest
$('guestNames').onclick = e => { const b = e.target.closest('button'); if (b) { pickGuest(state, +b.dataset.i); render(); } };
$('btnNotMe').onclick = () => { state.guest = { who: null, shown: false }; render(); };
$('btnMe').onclick = () => { state.guest.shown = true; state.guest.seen = true; render(); };
$('btnGuestToggle').onclick = () => { state.guest.shown = !state.guest.shown; render(); };

// discuss / arrange / result
$('btnArrange').onclick = () => { toArrange(state); render(); };
// arrastar para reordenar (Pointer Events: funciona em toque e mouse; o drag-and-drop nativo não funciona em iOS)
// ponytail: a linha "pula" para o slot quando o dedo cruza outra linha, sem seguir o dedo pixel a pixel; se quiser
// o efeito de flutuar, aplicar translateY na linha arrastada e animar as outras com FLIP
// Sem setPointerCapture: reordenar o nó no DOM (appendChild) libera o capture; ouvir no document não depende disso.
let dragging = null;
$('queue').onpointerdown = e => {
  dragging = e.target.closest('.qrow');
  if (!dragging) return;
  e.preventDefault();
  dragging.classList.add('drag');
};
document.onpointermove = e => {
  if (!dragging) return;
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('#queue .qrow');
  if (!over || over === dragging) return;
  move(state, state.order.indexOf(+dragging.dataset.i), state.order.indexOf(+over.dataset.i));
  const rows = Object.fromEntries([...$('queue').children].map(r => [r.dataset.i, r]));
  state.order.forEach(i => $('queue').appendChild(rows[i]));
};
document.onpointerup = document.onpointercancel = () => { dragging?.classList.remove('drag'); dragging = null; };
$('btnSubmit').onclick = () => { submitOrder(state); render(); };
$('btnNewRound').onclick = () => { newRound(state); $('customTheme').value = ''; render(); };
$('btnNewGame').onclick = goSetup;
$('btnHome').onclick = () => { if (confirm('Cancelar o jogo e voltar ao início?')) goSetup(); };

// convidado entra pelo hash do QR; hash inválido cai no setup
if (location.hash.length > 1) loadGuest(state, location.hash.slice(1));
render();
