// node test.js → imprime OK ou quebra com stack trace
const assert = require('assert');
const g = require('./game.js');
const W = { 1: ['a1', 'a2'], 2: ['b1', 'b2'], 3: ['c1', 'c2'], 4: ['d1', 'd2'], 5: ['e1', 'e2'] };

// drawWords: 5 palavras, uma por nível, sem repetir
let used = new Set();
const w1 = g.drawWords(used, W), w2 = g.drawWords(used, W);
assert.equal(w1.length, 5);
w1.forEach((w, i) => assert.ok(W[i + 1].includes(w), `nível ${i + 1}`));
assert.equal(new Set([...w1, ...w2]).size, 10, 'sem repetir');
assert.equal(g.drawWords(used, W).length, 5, 'nível esgotado libera as usadas');

// rodada perfeita: 1+2+3+4+5 = 15, termina antes do timer
let s = g.newGame('A', 'B');
assert.equal(s.screen, 'handoff');
g.startRound(s, 1000, W);
assert.equal(s.screen, 'playing');
assert.equal(s.endAt, 121000);
for (let i = 0; i < 5; i++) g.hit(s);
assert.equal(s.roundScore, 15);
assert.equal(s.teams[0].score, 15);
assert.equal(s.round, 1);
assert.equal(s.screen, 'roundEnd');
g.hit(s); // fora de 'playing' não faz nada
assert.equal(s.teams[0].score, 15);

// pular não pontua; rodada 2 é da equipe B
g.startRound(s, 0, W);
for (let i = 0; i < 5; i++) g.skip(s);
assert.equal(s.teams[1].score, 0);
assert.equal(s.round, 2);

// pula 2, acerta a 3ª = 3 pts; timer zera → endRound manual
g.startRound(s, 0, W);
g.skip(s); g.skip(s); g.hit(s);
assert.equal(s.roundScore, 3);
assert.equal(s.wordIndex, 3);
g.endRound(s);
assert.equal(s.round, 3);
assert.equal(s.screen, 'roundEnd');

// isOver: 8 rodadas + desempate em pares
const st = (round, a, b) => ({ round, teams: [{ score: a }, { score: b }] });
assert.equal(g.isOver(st(7, 10, 5)), false, 'faltam rodadas');
assert.equal(g.isOver(st(8, 10, 5)), true, '8 rodadas e placar diferente');
assert.equal(g.isOver(st(8, 10, 10)), false, 'empate → desempate');
assert.equal(g.isOver(st(9, 12, 10)), false, 'desempate: só A jogou, B ainda joga');
assert.equal(g.isOver(st(10, 12, 10)), true, 'desempate resolvido');
assert.equal(g.isOver(st(10, 12, 12)), false, 'ainda empatado → mais um par');
assert.equal(g.winner(st(10, 12, 10)), 0);
assert.equal(g.winner(st(10, 3, 10)), 1);

// timeLeft nunca negativo, arredonda para cima
assert.equal(g.timeLeft({ endAt: 5000 }, 3500), 2);
assert.equal(g.timeLeft({ endAt: 5000 }, 9000), 0);

console.log('OK');
