// node test.js → imprime OK ou quebra com stack trace
const assert = require('assert');
const g = require('./game.js');

// rng: determinístico por semente
const seq = seed => Array.from({ length: 5 }, g.rng(seed));
assert.deepEqual(seq('abcd'), seq('abcd'), 'mesma semente → mesma sequência');
assert.notDeepEqual(seq('abcd'), seq('abce'), 'sementes diferentes → sequências diferentes');
seq('abcd').forEach(x => assert.ok(x >= 0 && x < 1));

// drawNumbers: n únicos em 1..100, determinístico
for (const n of [3, 12, 100]) {
  const nums = g.drawNumbers(n, 'zz9k');
  assert.equal(nums.length, n);
  assert.equal(new Set(nums).size, n, 'únicos');
  nums.forEach(x => assert.ok(Number.isInteger(x) && x >= 1 && x <= 100));
}
assert.deepEqual(g.drawNumbers(12, 'q1w2'), g.drawNumbers(12, 'q1w2'));
assert.notDeepEqual(g.drawNumbers(12, 'q1w2'), g.drawNumbers(12, 'q1w3'));
assert.match(g.newSeed(), /^[0-9a-z]{4}$/);

// addPlayer: trim, ignora vazio/duplicado/13º
let s = g.newGame();
assert.equal(s.screen, 'setup');
g.addPlayer(s, '  Ana  ');
g.addPlayer(s, '');
g.addPlayer(s, '   ');
g.addPlayer(s, 'Ana');
assert.deepEqual(s.players, ['Ana']);
for (let i = 0; i < 15; i++) g.addPlayer(s, 'P' + i);
assert.equal(s.players.length, 12, 'máximo 12');
g.removePlayer(s, 0);
assert.equal(s.players[0], 'P0');

// startGame: bloqueia com 2, passa com 3
s = g.newGame();
g.addPlayer(s, 'Ana'); g.addPlayer(s, 'Bruno');
g.startGame(s);
assert.equal(s.screen, 'setup');
g.addPlayer(s, 'Carla');
g.startGame(s);
assert.equal(s.screen, 'theme');

// startRound sem tema não muda screen; modo local → reveal; fluxo show/hide → discuss
g.startRound(s);
assert.equal(s.screen, 'theme');
g.setTheme(s, { label: 'Sabor de pizza', low: 'só queijo', high: 'bizarra' });
g.startRound(s);
assert.equal(s.screen, 'reveal');
assert.equal(s.secrets.length, 3);
assert.equal(new Set(s.secrets).size, 3);
assert.deepEqual(s.secrets, g.drawNumbers(3, s.seed));
assert.equal(s.revealIdx, 0);
assert.equal(s.revealed, false);
for (let i = 0; i < 3; i++) {
  g.show(s);
  assert.equal(s.revealed, true);
  g.hide(s);
  assert.equal(s.revealed, false);
}
assert.equal(s.screen, 'discuss');

// modo qr → share; toDiscuss
const q = g.newGame();
g.setMode(q, 'qr');
['Ana', 'Bruno', 'Carla'].forEach(n => g.addPlayer(q, n));
g.startGame(q);
g.setTheme(q, { label: 'X', low: 'menor', high: 'maior' });
g.startRound(q);
assert.equal(q.screen, 'share');
g.toDiscuss(q);
assert.equal(q.screen, 'discuss');

// encode/decode ida e volta com | e acentos
const h = g.newGame();
g.setMode(h, 'qr');
['Zé | Zezinho', 'Ção', 'Bruno'].forEach(n => g.addPlayer(h, n));
g.startGame(h);
g.setTheme(h, { label: 'Tema | com barra', low: 'só queijo', high: 'ação' });
g.startRound(h);
const hash = g.encodeRound(h);
const dec = g.decodeRound(hash);
assert.equal(dec.seed, h.seed);
assert.deepEqual(dec.theme, h.theme);
assert.deepEqual(dec.players, h.players);
assert.equal(g.decodeRound('abc'), null);
assert.equal(g.decodeRound('a|b|c|d|e|f'), null, 'menos de 7 campos');
assert.equal(g.decodeRound(''), null);

// loadGuest reproduz os secrets do host; hash inválido não muda nada
const guest = g.newGame();
g.loadGuest(guest, hash);
assert.equal(guest.screen, 'guest');
assert.deepEqual(guest.secrets, h.secrets);
assert.deepEqual(guest.players, h.players);
assert.deepEqual(guest.guest, { who: null, shown: false });
g.pickGuest(guest, 1);
assert.deepEqual(guest.guest, { who: 1, shown: false });
const bad = g.newGame();
g.loadGuest(bad, 'abc');
assert.equal(bad.screen, 'setup');
assert.equal(bad.guest, null);

// arrange: fila começa na ordem de cadastro; move reordena; submitOrder exige fila completa
g.toArrange(s);
assert.equal(s.screen, 'arrange');
assert.deepEqual(s.order, [0, 1, 2]);
g.move(s, 2, 0);
assert.deepEqual(s.order, [2, 0, 1]);
g.move(s, 0, 2);
assert.deepEqual(s.order, [0, 1, 2]);
g.move(s, 1, 1); g.move(s, 5, 0); g.move(s, 0, -1);
assert.deepEqual(s.order, [0, 1, 2], 'move inválido não altera');
s.order = [0, 1];
g.submitOrder(s);
assert.equal(s.screen, 'arrange', 'fila incompleta bloqueia');
s.order = [1, 0, 2];
g.submitOrder(s);
assert.equal(s.screen, 'result');

// pairsOk / errors com secrets fixos
const r = { secrets: [10, 50, 30, 90], order: [0, 2, 1, 3] };
assert.deepEqual(g.pairsOk(r), [true, true, true]);
assert.equal(g.errors(r), 0);
r.order = [3, 1, 2, 0];
assert.deepEqual(g.pairsOk(r), [false, false, false]);
assert.equal(g.errors(r), 3);
r.order = [0, 1, 2, 3];
assert.equal(g.errors(r), 1);

// newRound mantém players e mode, zera theme
g.newRound(q);
assert.equal(q.screen, 'theme');
assert.equal(q.mode, 'qr');
assert.equal(q.players.length, 3);
assert.equal(q.theme, null);

// randomTheme devolve elemento da lista
const T = [{ label: 'a' }, { label: 'b' }];
assert.ok(T.includes(g.randomTheme(T)));
assert.equal(g.randomTheme(T, () => 0.99), T[1]);

console.log('OK');
